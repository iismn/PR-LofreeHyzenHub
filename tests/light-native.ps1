$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot
$testRoot=Join-Path $project '.build\light-native-check'
New-Item -ItemType Directory -Path $testRoot -Force|Out-Null
$harness=Join-Path $testRoot 'Check.cs'
Set-Content -LiteralPath $harness -Encoding UTF8 -Value @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using HyzenControl;
class Check {
 static int checks;
 static void Require(bool ok,string name){if(!ok)throw new Exception(name);checks++;}
 static LightingScheduleSettings Settings(bool enabled=true,int brightness=50){return new LightingScheduleSettings(enabled,"20:00","08:00",brightness,false,true,false);}
 sealed class Hold:IDisposable{public void Dispose(){}}
 sealed class Device:ILightDevice {
  public byte[] Memory=Enumerable.Range(0,448).Select(i=>(byte)(i*7%256)).ToArray();
  public List<int> Writes=new List<int>();public bool IsOnline=true,FailWrite,FailVerify;public Action<int,int> BeforeRead;public TaskCompletionSource<bool> Block;
  public Device(){Memory[0]=2;}
  public async Task<byte[]> Read(int offset,int length){if(Block!=null){var block=Block;Block=null;await block.Task;}if(BeforeRead!=null)BeforeRead(offset,length);return Memory.Skip(offset).Take(length).ToArray();}
  public Task Write(int offset,byte value){if(FailWrite)throw new IOException("sleep");Writes.Add(offset);if(!FailVerify)Memory[offset]=value;return Task.FromResult(0);}
  public Task<bool> Online(){return Task.FromResult(IsOnline);}
  public void Dispose(){}
 }
 sealed class Fixture {
  public Device Device=new Device();public LightingScheduleSettings Config=Settings();public DateTime Now=new DateTime(2026,11,17,21,0,0);public bool Available=true,Busy;public int Opens;public LightScheduleEngine Engine;
  public Fixture(){Engine=new LightScheduleEngine(()=>Available?(IList<DeviceInfo>)new List<DeviceInfo>{new DeviceInfo{path="test-hyzen",name="HYZEN67",productId=37}}:new List<DeviceInfo>(),info=>{Opens++;return Device;},()=>Busy?null:new Hold(),()=>Config,()=>Now);}
 }
 static void Main(string[] args){Run(args[0]).GetAwaiter().GetResult();Console.WriteLine("{\"nativeLightChecks\":"+checks+",\"passed\":true}");}
 static async Task Run(string root){
  var config=Settings();
  Require(!LightPhase.At(config,new DateTime(2026,11,17,19,59,59)).Night,"Before night boundary");
  Require(LightPhase.At(config,new DateTime(2026,11,17,20,0,0)).Percent==50,"On boundary inclusive");
  Require(LightPhase.At(config,new DateTime(2026,11,18,7,59,59)).Night,"Night crosses midnight");
  Require(LightPhase.At(config,new DateTime(2026,11,18,8,0,0)).Percent==0,"Off boundary inclusive");
  Require(LightPhase.At(config,new DateTime(2026,12,31,23,0,0)).Period==LightPhase.At(config,new DateTime(2027,1,1,7,0,0)).Period,"Year boundary keeps the same night");
  var sameDay=new LightingScheduleSettings(true,"06:30","22:00",35,false,true,false);
  Require(LightPhase.At(sameDay,new DateTime(2026,11,17,6,30,0)).Night&&!LightPhase.At(sameDay,new DateTime(2026,11,17,22,0,0)).Night,"Same-day interval");
  var f=new Fixture();var before=f.Device.Memory.ToArray();Require(await f.Engine.Tick(),"Applies on startup without a UI connection");
  Require(f.Device.Memory[158]==0&&f.Device.Memory[159]==50,"Only front bar comes on; keys stay off");
  Require(f.Device.Memory.Where((value,index)=>index!=158&&index!=159).SequenceEqual(before.Where((value,index)=>index!=158&&index!=159)),"Colors effects sleep receiver and mappings preserved");
  Require(f.Device.Writes.SequenceEqual(new[]{158,159}),"Only two verified brightness bytes written");
  Require(!await f.Engine.Tick()&&f.Opens==1,"Same period avoids repeated HID opens and writes");
  f.Device.Memory[159]=22;f.Now=f.Now.AddMinutes(2);Require(!await f.Engine.Tick()&&f.Device.Memory[159]==22,"Manual brightness override kept in the same period");
  f.Now=new DateTime(2026,11,18,8,0,0);Require(await f.Engine.Tick()&&f.Device.Memory[159]==0,"Morning turns bar off");
  f.Now=new DateTime(2026,11,18,23,0,0);Require(await f.Engine.Tick()&&f.Device.Memory[159]==50,"Sleep or delayed timer catches up to current night");
  f.Config=Settings(true,35);Require(await f.Engine.Tick()&&f.Device.Memory[159]==35,"Edited brightness catches up");
  f.Available=false;Require(!await f.Engine.Tick()&&f.Engine.Status=="waiting","Unplug waits without writing");f.Available=true;Require(await f.Engine.Tick(),"Reconnect reapplies current phase");
  f.Busy=true;int count=f.Device.Writes.Count;Require(!await f.Engine.Tick()&&f.Engine.Status=="hub"&&f.Device.Writes.Count==count,"Yields while HUB owns device");f.Busy=false;Require(await f.Engine.Tick(),"Continues when HUB releases device");
  f.Config=Settings(false);count=f.Device.Writes.Count;Require(!await f.Engine.Tick()&&f.Engine.Status=="disabled"&&f.Device.Writes.Count==count,"Disabled schedule does not touch device");
  f=new Fixture();f.Device.IsOnline=false;Require(!await f.Engine.Tick()&&f.Device.Writes.Count==0,"Sleeping wireless keyboard waits without writes");
  f=new Fixture();f.Device.FailWrite=true;Require(!await f.Engine.Tick()&&f.Engine.Status=="retry","Transfer error leaves period pending");f.Device.FailWrite=false;Require(await f.Engine.Tick(),"Failed transfer retried");
  f=new Fixture();f.Device.FailVerify=true;Require(!await f.Engine.Tick()&&f.Engine.Status=="retry","Read-back mismatch rejects application");f.Device.FailVerify=false;Require(await f.Engine.Tick(),"Failed verification can recover");
  f=new Fixture();f.Device.BeforeRead=(offset,length)=>{if(length==64)f.Config=Settings(false);};Require(!await f.Engine.Tick()&&f.Device.Writes.Count==0,"Disable during read rejects stale writes");
  f=new Fixture();f.Device.BeforeRead=(offset,length)=>{if(length==64)f.Now=new DateTime(2026,11,18,8,0,0);};Require(!await f.Engine.Tick()&&f.Device.Writes.Count==0,"Morning during read rejects stale night writes");
  f=new Fixture();f.Device.BeforeRead=(offset,length)=>{if(length==64)f.Device.Memory[0]=3;};Require(!await f.Engine.Tick()&&f.Device.Writes.Count==0,"Profile changes reject writes to an old profile");
  f=new Fixture();f.Device.Memory[0]=9;Require(!await f.Engine.Tick()&&f.Device.Writes.Count==0,"Unsupported profile rejected");
  f=new Fixture();f.Device.Block=new TaskCompletionSource<bool>();var blocker=f.Device.Block;var pending=f.Engine.Tick();Require(!await f.Engine.Tick()&&f.Opens==1,"Concurrent timer calls stay single-flight");blocker.SetResult(true);Require(await pending,"Single flight completes");
  string leaseRoot=Path.Combine(root,Guid.NewGuid().ToString("N"));var first=DeviceLease.TryAcquire(leaseRoot);Require(first!=null&&DeviceLease.TryAcquire(leaseRoot)==null,"Exclusive cross-program HID lease");await Task.Run(()=>first.Dispose());using(var second=DeviceLease.TryAcquire(leaseRoot))Require(second!=null,"Lease releases from another async thread");
  string name="Lofree.Test."+Guid.NewGuid().ToString("N");using(var primary=new ProcessSignals(name))using(var secondary=new ProcessSignals(name)){
   Require(primary.First&&!secondary.First,"Single instance signals");secondary.RequestShow();Require(primary.TakeShow()&&!primary.TakeShow(),"Second launch signals show once");secondary.RequestExit();Require(primary.TakeExit(),"Installer exit signal");
  }
 }
}
'@
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$executable=Join-Path $testRoot 'Check.exe'
& $compiler /nologo /codepage:65001 /target:exe /platform:x64 /reference:System.Core.dll /reference:System.Web.Extensions.dll ("/out:"+$executable) (Join-Path $project 'source\UserPreferences.cs') (Join-Path $project 'source\HidDevice.cs') (Join-Path $project 'source\BackgroundSupport.cs') (Join-Path $project 'source\LightScheduler.cs') $harness
if($LASTEXITCODE -ne 0){throw 'Native light test build failed'}
& $executable $testRoot
if($LASTEXITCODE -ne 0){throw 'Native light checks failed'}
