using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

namespace HyzenControl {
 sealed class UserPreferences {
  readonly string path;
  public string Language {get;private set;}
  public int KeyboardScale {get;private set;}
  public UserPreferences(string filePath) {
   path=filePath;Language="ko";KeyboardScale=120;
   try {
    if(!File.Exists(path))return;
    var data=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(path));
    object value;
    if(data!=null&&data.TryGetValue("language",out value)&&(Convert.ToString(value)=="en"||Convert.ToString(value)=="ko"))Language=Convert.ToString(value);
    if(data!=null&&data.TryGetValue("keyboardScale",out value)){
     double scale;
     if(double.TryParse(Convert.ToString(value),out scale)&&scale==Math.Truncate(scale)&&ValidScale((int)scale))KeyboardScale=(int)scale;
    }
   }catch{Language="ko";}
  }
  public void SetLanguage(string language) {
   SetValues(language,KeyboardScale);
  }
  public void SetKeyboardScale(int scale){SetValues(Language,scale);}
  public static bool ValidScale(int scale){return scale>=80&&scale<=160&&scale%10==0;}
  public void SetValues(string language,int scale) {
   if(language!="ko"&&language!="en")throw new ArgumentException("지원하지 않는 언어입니다.");
   if(!ValidScale(scale))throw new ArgumentException("보기 크기가 올바르지 않습니다.");
   string temporary=path+".tmp";
   try {
    Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
    var text=new JavaScriptSerializer().Serialize(new{language=language,keyboardScale=scale});
    File.WriteAllText(temporary,text,new UTF8Encoding(false));
    if(File.Exists(path))File.Replace(temporary,path,null);else File.Move(temporary,path);
    Language=language;KeyboardScale=scale;
   }catch(Exception error){
    try{if(File.Exists(temporary))File.Delete(temporary);}catch{}
    throw new IOException("앱 설정을 저장하지 못했습니다.",error);
   }
  }
 }
}
