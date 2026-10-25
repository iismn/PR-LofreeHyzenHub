using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shell;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

[assembly:AssemblyTitle("Lofree HUB")]
[assembly:AssemblyProduct("Lofree HUB")]
[assembly:AssemblyDescription("Lofree HYZEN 67 keyboard settings")]
[assembly:AssemblyVersion("1.1.2.0")]
[assembly:AssemblyFileVersion("1.1.2.0")]
namespace HyzenControl {
 static class Program {
  internal const string AppUserModelId="Lofree.HUB";
  [DllImport("shell32.dll",CharSet=CharSet.Unicode)]
  static extern int SetCurrentProcessExplicitAppUserModelID(string appId);
  internal static readonly string DataPath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"HyzenControl");
  internal static string VerifyDirectory;
  internal static bool VerifySmall;
  internal static bool VerifyLive;
  internal static int VerifyWrites;
  [STAThread] static void Main(string[] args) {
   Marshal.ThrowExceptionForHR(SetCurrentProcessExplicitAppUserModelID(AppUserModelId));
   Directory.CreateDirectory(DataPath);
   AppDomain.CurrentDomain.AssemblyResolve+=delegate(object sender,ResolveEventArgs e) {
    string name=new AssemblyName(e.Name).Name;
    if(name=="Microsoft.Web.WebView2.Core"||name=="Microsoft.Web.WebView2.Wpf")return Assembly.LoadFrom(Extract(name+".dll"));
    return null;
   };
   if(args.Length==2&&(args[0]=="--verify"||args[0]=="--verify-min"||args[0]=="--verify-live")){VerifyDirectory=args[1];VerifySmall=args[0]=="--verify-min";VerifyLive=args[0]=="--verify-live";}
   try { Run(); } catch(Exception e) { File.WriteAllText(Path.Combine(DataPath,"startup-error.txt"),e.ToString());MessageBox.Show(e.Message,"Lofree HUB"); }
  }
  [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
  static void Run(){new Application().Run(new MainWindow());}
  internal static string Extract(string name) {
   string dir=Path.Combine(DataPath,"Runtime");Directory.CreateDirectory(dir);string target=Path.Combine(dir,name);
   using(var input=Assembly.GetExecutingAssembly().GetManifestResourceStream("Hyzen.Runtime."+name)) {
    if(input==null)throw new FileNotFoundException(name);
    if(File.Exists(target)&&new FileInfo(target).Length==input.Length)return target;
    using(var output=File.Create(target))input.CopyTo(output);
   }return target;
  }
 }
 sealed class MainWindow : Window {
  const string Origin="https://hyzen.internal";
  readonly WebView2 web=new WebView2();
  readonly JavaScriptSerializer json=new JavaScriptSerializer { MaxJsonLength=2097152 };
  readonly System.Threading.SemaphoreSlim operations=new System.Threading.SemaphoreSlim(1,1);
  HidDevice device; bool closing,closePending,closeReady;
  static readonly HashSet<int> ReadCommands=new HashSet<int>(new[]{3,5,7,8,0x14,0x1b,0x25,0x26,0x28,0x29,0x51,0x52,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x5b,0x5c,0x5d,0x5e,0x5f,0x60,0x61,0x67});
  static readonly HashSet<int> WriteCommands=new HashSet<int>(new[]{6,9,0x15,0x1c,0x27,0x41,0x42,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4a,0x4b,0x4c,0x4d,0x4e,0x4f,0x63,0x66});
  public MainWindow() {
   Title="Lofree HUB";Width=1320;Height=900;MinWidth=1040;MinHeight=720;WindowStartupLocation=WindowStartupLocation.CenterScreen;
   using(var icon=Assembly.GetExecutingAssembly().GetManifestResourceStream("Hyzen.AppIcon.ico"))Icon=BitmapFrame.Create(icon,BitmapCreateOptions.PreservePixelFormat,BitmapCacheOption.OnLoad);
   if(Program.VerifySmall){Width=1040;Height=720;}
   Background=new SolidColorBrush(Color.FromRgb(23,33,51));WindowStyle=WindowStyle.None;
   WindowChrome.SetWindowChrome(this,new WindowChrome { CaptionHeight=0,ResizeBorderThickness=new Thickness(6),CornerRadius=new CornerRadius(0),GlassFrameThickness=new Thickness(0) });
   web.Margin=new Thickness(0);web.DefaultBackgroundColor=System.Drawing.Color.FromArgb(255,23,33,51);Content=web;
   Loaded+=async delegate {await Start();};
   Closing+=async delegate(object sender,System.ComponentModel.CancelEventArgs e) {
    if(closeReady||Program.VerifyDirectory!=null||web.CoreWebView2==null)return;
    e.Cancel=true;if(closePending)return;closePending=true;
    try{await web.CoreWebView2.ExecuteScriptAsync("Promise.resolve(window.hyzenApp?.prepareClose?window.hyzenApp.prepareClose():true).then(ready=>chrome.webview.postMessage({id:0,action:'closeReady',ready})).catch(()=>chrome.webview.postMessage({id:0,action:'closeReady',ready:false}))");}
    catch{closeReady=true;Close();}
   };
   Closed+=delegate{closing=true;if(device!=null)device.Dispose();web.Dispose();};
  }
  async Task Start() {
   try {
    Program.Extract("WebView2Loader.dll");CoreWebView2Environment.SetLoaderDllFolderPath(Path.Combine(Program.DataPath,"Runtime"));
    var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(Program.DataPath,"WebView2"));await web.EnsureCoreWebView2Async(env);
    var core=web.CoreWebView2;
    core.Settings.IsStatusBarEnabled=false;core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.AreDevToolsEnabled=false;core.Settings.IsZoomControlEnabled=false;
    core.Settings.IsGeneralAutofillEnabled=false;core.Settings.IsPasswordAutosaveEnabled=false;core.Settings.AreHostObjectsAllowed=false;core.Settings.IsNonClientRegionSupportEnabled=true;
    core.AddWebResourceRequestedFilter("*",CoreWebView2WebResourceContext.All);
    core.WebResourceRequested+=delegate(object sender,CoreWebView2WebResourceRequestedEventArgs e) {
     string name=e.Request.Uri.StartsWith(Origin+"/")?e.Request.Uri.Substring(Origin.Length+1).Split('?')[0]:"";
     var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("Hyzen.Web."+name);
     string type=name.EndsWith(".html")?"text/html; charset=utf-8":name.EndsWith(".js")?"text/javascript; charset=utf-8":name.EndsWith(".css")?"text/css; charset=utf-8":name.EndsWith(".ttf")?"font/ttf":name.EndsWith(".webp")?"image/webp":name.EndsWith(".png")?"image/png":"application/octet-stream";
     string headers="Content-Type: "+type+"\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'\r\n";
     e.Response=env.CreateWebResourceResponse(stream??new MemoryStream(),stream==null?404:200,stream==null?"Not Found":"OK",headers);
    };
    core.NavigationStarting+=delegate(object sender,CoreWebView2NavigationStartingEventArgs e){e.Cancel=e.Uri!=Origin+"/index.html";};
    core.FrameNavigationStarting+=delegate(object sender,CoreWebView2NavigationStartingEventArgs e){e.Cancel=true;};
    core.PermissionRequested+=delegate(object sender,CoreWebView2PermissionRequestedEventArgs e){e.State=CoreWebView2PermissionState.Deny;};
    core.NewWindowRequested+=delegate(object sender,CoreWebView2NewWindowRequestedEventArgs e){e.Handled=true;};
    core.WebMessageReceived+=Message;
    core.NavigationCompleted+=async delegate {
     if(Program.VerifyDirectory==null)return;
     try {
      Directory.CreateDirectory(Program.VerifyDirectory);await Task.Delay(1200);
      await core.ExecuteScriptAsync("window.runVerification().then(result=>chrome.webview.postMessage({id:-1,action:'verification',result})).catch(error=>chrome.webview.postMessage({id:-1,action:'verification',result:{error:String(error)}}))");
     } catch(Exception e){File.WriteAllText(Path.Combine(Program.VerifyDirectory,"error.txt"),e.ToString());}
    };
    core.Navigate(Origin+"/index.html");
   }catch(Exception e){MessageBox.Show(this,"화면을 열지 못했습니다. Microsoft Edge WebView2 Runtime이 필요합니다.\n"+e.Message,"Lofree HUB");Close();}
  }
  async void Message(object sender,CoreWebView2WebMessageReceivedEventArgs e) {
   if(e.Source!=Origin+"/index.html"||e.WebMessageAsJson.Length>1048576||closing)return;
   int id=0;
   try {
    var m=json.Deserialize<Dictionary<string,object>>(e.WebMessageAsJson);id=Convert.ToInt32(m["id"]);string action=Convert.ToString(m["action"]);
    if(action=="closeReady"){closePending=false;if(Convert.ToBoolean(m["ready"])){closeReady=true;Close();}return;}
    if(action=="verification"&&Program.VerifyDirectory!=null) {
     File.WriteAllText(Path.Combine(Program.VerifyDirectory,"ui-result.json"),json.Serialize(m["result"]),Encoding.UTF8);
     using(var screenshot=File.Create(Path.Combine(Program.VerifyDirectory,"hyzen-control.png")))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,screenshot);
     Close();return;
    }
    if(action=="windowMetrics"&&Program.VerifyDirectory!=null) {
     var origin=web.TranslatePoint(new Point(0,0),this);
     web.CoreWebView2.PostWebMessageAsJson(json.Serialize(new{id=id,result=new{left=origin.X,top=origin.Y,width=web.ActualWidth,height=web.ActualHeight,windowWidth=ActualWidth,windowHeight=ActualHeight,margin=web.Margin.Left,verifyLive=Program.VerifyLive,verifyWrites=Program.VerifyWrites}}));return;
    }
    if(action=="capture"&&Program.VerifyDirectory!=null) {
     string name=Convert.ToString(m["name"]);
     if(!System.Text.RegularExpressions.Regex.IsMatch(name,"^[a-z-]{1,24}$"))throw new ArgumentException("Invalid capture name");
     using(var screenshot=File.Create(Path.Combine(Program.VerifyDirectory,name+".png")))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,screenshot);
     web.CoreWebView2.PostWebMessageAsJson(json.Serialize(new{id=id,result=true}));return;
    }
    object value=null;
    if(action=="caption") {
     string cmd=Convert.ToString(m["command"]);if(cmd=="close"){Close();return;}if(cmd=="minimize")WindowState=WindowState.Minimized;if(cmd=="maximize")WindowState=WindowState==WindowState.Maximized?WindowState.Normal:WindowState.Maximized;
    } else if(action=="official") {Process.Start(new ProcessStartInfo("https://hyzen.lofree.tech/#/"){UseShellExecute=true});}
    else if(action=="export") {
     var dialog=new Microsoft.Win32.SaveFileDialog{FileName="Hyzen-profile.json",Filter="Hyzen 설정 (*.json)|*.json"};
     if(dialog.ShowDialog(this)==true){File.WriteAllText(dialog.FileName,Convert.ToString(m["text"]),new UTF8Encoding(false));value=true;}
    } else if(action=="import") {
     var dialog=new Microsoft.Win32.OpenFileDialog{Filter="Hyzen 설정 (*.json)|*.json"};
     if(dialog.ShowDialog(this)==true){if(new FileInfo(dialog.FileName).Length>1048576)throw new ArgumentException("설정 파일이 너무 큽니다.");value=File.ReadAllText(dialog.FileName);}
    } else {
     await operations.WaitAsync();
     try {
      value=await Task.Run(async delegate {
       if(action=="scan")return (object)HidDevice.Enumerate().Select(d=>new{d.name,d.connection,d.productId,d.vendorId}).ToArray();
       if(action=="connect") {
        if(device!=null){device.Dispose();device=null;}
        var devices=HidDevice.Enumerate();if(devices.Count==0)throw new IOException("Hyzen을 찾지 못했습니다. USB 케이블 또는 2.4GHz 수신기를 연결하세요.");
        device=new HidDevice(devices[0]);return (object)new{device.Info.name,device.Info.connection,device.Info.productId};
       }
       if(action=="disconnect"){if(device!=null)device.Dispose();device=null;return (object)true;}
       if(device==null)throw new IOException("키보드를 먼저 연결하세요.");
       int cmd=Convert.ToInt32(m["command"]),offset=Convert.ToInt32(m["offset"]);
       if(action=="read") {
        if(!ReadCommands.Contains(cmd))throw new ArgumentException("허용되지 않은 읽기 명령입니다.");
        return (object)Array.ConvertAll(await device.Transfer((byte)cmd,offset,Convert.ToInt32(m["length"]),null),b=>(int)b);
       }
       if(action=="write") {
        if(!WriteCommands.Contains(cmd))throw new ArgumentException("허용되지 않은 쓰기 명령입니다.");
        var values=(System.Collections.IEnumerable)m["data"];var bytes=new List<byte>();foreach(object v in values){int b=Convert.ToInt32(v);if(b<0||b>255)throw new ArgumentException("잘못된 데이터입니다.");bytes.Add((byte)b);}
        if(Program.VerifyDirectory!=null){
         if(!Program.VerifyLive||cmd!=6||bytes.Count!=1)throw new InvalidOperationException("검증 모드는 읽기 전용입니다.");
         var current=await device.Transfer(5,0,64,null);int profile=current[0];
         if(profile>6||offset!=profile*64+31)throw new InvalidOperationException("동일한 라이트 바 밝기만 검증할 수 있습니다.");
         var old=await device.Transfer(5,offset,1,null);
         if(bytes[0]!=old[0])throw new InvalidOperationException("검증 중 설정 값 변경은 허용되지 않습니다.");
         Program.VerifyWrites++;
        }
        await device.Transfer((byte)cmd,offset,bytes.Count,bytes.ToArray());return (object)true;
       }
       throw new ArgumentException("알 수 없는 요청입니다.");
      });
     }finally{operations.Release();}
    }
    if(!closing)web.CoreWebView2.PostWebMessageAsJson(json.Serialize(new{id=id,result=value}));
   }catch(Exception error){if(!closing)web.CoreWebView2.PostWebMessageAsJson(json.Serialize(new{id=id,error=error.Message}));}
  }
 }
}
