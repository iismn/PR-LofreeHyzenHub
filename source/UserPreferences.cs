using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

namespace HyzenControl {
 sealed class LightingScheduleSettings {
  public bool enabled {get;private set;}
  public string onTime {get;private set;}
  public string offTime {get;private set;}
  public int brightness {get;private set;}
  public bool back {get;private set;}
  public bool front {get;private set;}
  public bool receiver {get;private set;}
  public LightingScheduleSettings(bool enabled,string onTime,string offTime,int brightness,bool back,bool front,bool receiver){
   if(!ValidTime(onTime)||!ValidTime(offTime)||onTime==offTime||brightness<1||brightness>100||enabled&&!back&&!front&&!receiver)throw new ArgumentException("조명 예약 설정이 올바르지 않습니다.");
   this.enabled=enabled;this.onTime=onTime;this.offTime=offTime;this.brightness=brightness;this.back=back;this.front=front;this.receiver=receiver;
  }
  static bool ValidTime(string value){return value!=null&&System.Text.RegularExpressions.Regex.IsMatch(value,"^([01][0-9]|2[0-3]):[0-5][0-9]$");}
  public static LightingScheduleSettings Default(){return new LightingScheduleSettings(false,"20:00","08:00",50,false,true,false);}
  public static LightingScheduleSettings Parse(object value){
   try{
    var data=value as Dictionary<string,object>;
    if(data==null||!(data["enabled"] is bool)||!(data["back"] is bool)||!(data["front"] is bool)||!(data["receiver"] is bool)||!(data["onTime"] is string)||!(data["offTime"] is string))throw new ArgumentException();
    object raw=data["brightness"];if(!(raw is int)&&!(raw is long)&&!(raw is double))throw new ArgumentException();
    double level=Convert.ToDouble(raw);if(double.IsNaN(level)||double.IsInfinity(level)||level!=Math.Truncate(level)||level<1||level>100)throw new ArgumentException();
    return new LightingScheduleSettings((bool)data["enabled"],(string)data["onTime"],(string)data["offTime"],(int)level,(bool)data["back"],(bool)data["front"],(bool)data["receiver"]);
   }catch{throw new ArgumentException("조명 예약 설정이 올바르지 않습니다.");}
  }
 }
 sealed class UserPreferences {
  readonly string path;
  public string Language {get;private set;}
  public int KeyboardScale {get;private set;}
  public LightingScheduleSettings LightingSchedule {get;private set;}
  public UserPreferences(string filePath) {path=filePath;Reload();}
  public void Reload() {
   Language="ko";KeyboardScale=120;LightingSchedule=LightingScheduleSettings.Default();
   try {
    if(!File.Exists(path))return;
    var data=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(path));
    object value;
    if(data!=null&&data.TryGetValue("language",out value)&&(Convert.ToString(value)=="en"||Convert.ToString(value)=="ko"))Language=Convert.ToString(value);
    if(data!=null&&data.TryGetValue("keyboardScale",out value)){
     double scale;
     if(double.TryParse(Convert.ToString(value),out scale)&&scale==Math.Truncate(scale)&&ValidScale((int)scale))KeyboardScale=(int)scale;
    }
    if(data!=null&&data.TryGetValue("lightingSchedule",out value))try{LightingSchedule=LightingScheduleSettings.Parse(value);}catch{}
   }catch{Language="ko";}
  }
  public void SetLanguage(string language) {
   SetPartial(language,null,null);
  }
  public void SetKeyboardScale(int scale){SetPartial(null,scale,null);}
  public void SetLightingSchedule(LightingScheduleSettings schedule){if(schedule==null)throw new ArgumentException("조명 예약 설정이 올바르지 않습니다.");SetPartial(null,null,schedule);}
  public static bool ValidScale(int scale){return scale>=80&&scale<=160&&scale%10==0;}
  public void SetValues(string language,int scale){SetPartial(language,scale,null);}
  public void SetValues(string language,int scale,LightingScheduleSettings schedule) {
   if(schedule==null)throw new ArgumentException("조명 예약 설정이 올바르지 않습니다.");
   SetPartial(language,scale,schedule);
  }
  public void SetPartial(string language,int? scale,LightingScheduleSettings schedule) {
   if(language!=null&&language!="ko"&&language!="en")throw new ArgumentException("지원하지 않는 언어입니다.");
   if(scale.HasValue&&!ValidScale(scale.Value))throw new ArgumentException("보기 크기가 올바르지 않습니다.");
   string temporary=path+"."+Guid.NewGuid().ToString("N")+".tmp";
   string mutexName;
   using(var hash=System.Security.Cryptography.SHA256.Create())mutexName="Local\\Lofree.Preferences."+BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(Path.GetFullPath(path).ToUpperInvariant()))).Replace("-","");
   using(var mutex=new System.Threading.Mutex(false,mutexName)){
   bool held=false;
   try {
    try{held=mutex.WaitOne(5000);}catch(System.Threading.AbandonedMutexException){held=true;}
    if(!held)throw new IOException("앱 설정이 사용 중입니다.");
    var latest=new UserPreferences(path);language=language??latest.Language;int newScale=scale??latest.KeyboardScale;schedule=schedule??latest.LightingSchedule;
    Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
    var text=new JavaScriptSerializer().Serialize(new{language=language,keyboardScale=newScale,lightingSchedule=schedule});
    File.WriteAllText(temporary,text,new UTF8Encoding(false));
    if(File.Exists(path))File.Replace(temporary,path,null);else File.Move(temporary,path);
    Language=language;KeyboardScale=newScale;LightingSchedule=schedule;
   }catch(Exception error){
    try{if(File.Exists(temporary))File.Delete(temporary);}catch{}
    throw new IOException("앱 설정을 저장하지 못했습니다.",error);
   }finally{if(held)mutex.ReleaseMutex();}
   }
  }
 }
}
