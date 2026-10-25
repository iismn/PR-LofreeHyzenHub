using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

namespace HyzenControl {
 sealed class UserPreferences {
  readonly string path;
  public string Language {get;private set;}
  public UserPreferences(string filePath) {
   path=filePath;Language="ko";
   try {
    if(!File.Exists(path))return;
    var data=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(path));
    object value;
    if(data!=null&&data.TryGetValue("language",out value)&&(Convert.ToString(value)=="en"||Convert.ToString(value)=="ko"))Language=Convert.ToString(value);
   }catch{Language="ko";}
  }
  public void SetLanguage(string language) {
   if(language!="ko"&&language!="en")throw new ArgumentException("지원하지 않는 언어입니다.");
   string temporary=path+".tmp";
   try {
    Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
    var text=new JavaScriptSerializer().Serialize(new{language=language});
    File.WriteAllText(temporary,text,new UTF8Encoding(false));
    if(File.Exists(path))File.Replace(temporary,path,null);else File.Move(temporary,path);
    Language=language;
   }catch(Exception error){
    try{if(File.Exists(temporary))File.Delete(temporary);}catch{}
    throw new IOException("언어 설정을 저장하지 못했습니다.",error);
   }
  }
 }
}
