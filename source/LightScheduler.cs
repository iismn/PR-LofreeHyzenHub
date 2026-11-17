using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace HyzenControl {
 sealed class LightPhase {
  public readonly bool Night;
  public readonly int Percent;
  public readonly string Period;
  public LightPhase(bool night,int percent,string period){Night=night;Percent=percent;Period=period;}
  public static LightPhase At(LightingScheduleSettings settings,DateTime now){
   DateTime on=Boundary(settings.onTime,now),off=Boundary(settings.offTime,now);bool night=on>off;
   return new LightPhase(night,night?settings.brightness:0,(night?"night:":"day:")+(night?on:off).Ticks);
  }
  static DateTime Boundary(string time,DateTime now){var parts=time.Split(':');var result=now.Date.AddHours(int.Parse(parts[0])).AddMinutes(int.Parse(parts[1]));return result>now?result.AddDays(-1):result;}
 }
 interface ILightDevice : IDisposable {
  Task<byte[]> Read(int offset,int length);
  Task Write(int offset,byte value);
  Task<bool> Online();
 }
 sealed class LightDevice : ILightDevice {
  readonly HidDevice device;
  public LightDevice(DeviceInfo info){device=new HidDevice(info);}
  public Task<byte[]> Read(int offset,int length){return device.Transfer(5,offset,length,null);}
  public async Task Write(int offset,byte value){await device.Transfer(6,offset,1,new[]{value});}
  public async Task<bool> Online(){return device.Info.productId!=37||await device.QueryStatus(0xaa)!=0;}
  public void Dispose(){device.Dispose();}
 }
 sealed class LightScheduleEngine {
  readonly Func<IList<DeviceInfo>> enumerate;
  readonly Func<DeviceInfo,ILightDevice> open;
  readonly Func<IDisposable> lease;
  readonly Func<LightingScheduleSettings> settings;
  readonly Func<DateTime> clock;
  int running;
  string applied;
  DateTime profileProbe;
  public string Status {get;private set;}
  public string DeviceName {get;private set;}
  public int Writes {get;private set;}
  public LightScheduleEngine(string root,Func<LightingScheduleSettings> settings):this(()=>HidDevice.Enumerate(),info=>new LightDevice(info),()=>DeviceLease.TryAcquire(root),settings,()=>DateTime.Now){}
  public LightScheduleEngine(Func<IList<DeviceInfo>> enumerate,Func<DeviceInfo,ILightDevice> open,Func<IDisposable> lease,Func<LightingScheduleSettings> settings,Func<DateTime> clock){this.enumerate=enumerate;this.open=open;this.lease=lease;this.settings=settings;this.clock=clock;Status="waiting";}
  static string Signature(LightingScheduleSettings value){return value.enabled+":"+value.onTime+":"+value.offTime+":"+value.brightness;}
  public void Invalidate(){applied=null;}
  public async Task<bool> Tick(){
   if(Interlocked.Exchange(ref running,1)!=0)return false;
   try{
    var config=settings();if(!config.enabled){applied=null;Status="disabled";return false;}
    DateTime now=clock();var phase=LightPhase.At(config,now);string signature=Signature(config);
    using(var held=lease()){
     if(held==null){applied=null;Status="hub";return false;}
     var info=enumerate().FirstOrDefault();
     if(info==null){applied=null;DeviceName=null;Status="waiting";return false;}
     DeviceName=info.name;string prefix=signature+":"+phase.Period+":"+info.path+":";
     if(applied!=null&&applied.StartsWith(prefix,StringComparison.Ordinal)&&now<profileProbe){Status=phase.Night?"on":"off";return false;}
     using(var device=open(info)){
      if(!await device.Online()){applied=null;Status="waiting";return false;}
      var global=await device.Read(0,1);if(global.Length!=1||global[0]>6)throw new IOException("Unsupported keyboard profile");
      int profile=global[0],offset=profile*64;string key=prefix+profile;
      if(applied==key){profileProbe=now.AddSeconds(60);Status=phase.Night?"on":"off";return false;}
      var data=await device.Read(offset,64);if(data.Length!=64)throw new IOException("Incomplete lighting settings");
      // Only the two brightness bytes are touched. Effects, color, mapping and sleep stay intact.
      foreach(var change in new[]{new KeyValuePair<int,byte>(30,0),new KeyValuePair<int,byte>(31,(byte)phase.Percent)}){
       if(data[change.Key]==change.Value)continue;
       if(Signature(settings())!=signature||LightPhase.At(config,clock()).Period!=phase.Period)throw new IOException("Lighting schedule changed during transfer");
       var current=await device.Read(0,1);if(current.Length!=1||current[0]!=profile)throw new IOException("Keyboard profile changed during transfer");
       await device.Write(offset+change.Key,change.Value);Writes++;
       var actual=await device.Read(offset+change.Key,1);if(actual.Length!=1||actual[0]!=change.Value)throw new IOException("Lighting verification failed");
      }
      applied=key;profileProbe=now.AddSeconds(60);Status=phase.Night?"on":"off";return true;
     }
    }
   }catch{applied=null;Status="retry";return false;}
   finally{Interlocked.Exchange(ref running,0);}
  }
 }
}
