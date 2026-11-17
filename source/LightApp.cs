using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly:AssemblyTitle("Lofree Light")]
[assembly:AssemblyProduct("Lofree Light")]
[assembly:AssemblyDescription("Lofree HYZEN front light bar schedule")]
[assembly:AssemblyVersion("1.5.0.0")]
[assembly:AssemblyFileVersion("1.5.0.0")]
namespace HyzenControl {
 static class LightProgram {
  [STAThread] static void Main(string[] args){
   Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
   if(args.Length==2&&args[0]=="--verify-ui"){
    Directory.CreateDirectory(args[1]);Application.Run(new LightContext(args[1],null,false,true));return;
   }
   using(var signals=new ProcessSignals("Lofree.Light")){
    if(args.Contains("--exit")){signals.RequestExit();return;}
    if(!signals.First){if(!args.Contains("--background"))signals.RequestShow();return;}
    string root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"HyzenControl");Directory.CreateDirectory(root);
    Application.Run(new LightContext(root,signals,args.Contains("--background"),false));
   }
  }
 }
 static class LightStartup {
  const string Key="Software\\Microsoft\\Windows\\CurrentVersion\\Run";
  public static string Command(string executable){return "\""+Path.GetFullPath(executable)+"\" --background";}
  public static bool Enabled {
   get{using(var key=Registry.CurrentUser.OpenSubKey(Key))return key!=null&&string.Equals(key.GetValue("LofreeLight") as string,Command(Application.ExecutablePath),StringComparison.OrdinalIgnoreCase);}
  }
  public static void Set(bool enabled){
   using(var key=Registry.CurrentUser.CreateSubKey(Key)){if(enabled)key.SetValue("LofreeLight",Command(Application.ExecutablePath),RegistryValueKind.String);else key.DeleteValue("LofreeLight",false);}
  }
 }
 sealed class LightContext : ApplicationContext {
  readonly string root;
  readonly ProcessSignals signals;
  readonly bool verify;
  readonly NotifyIcon tray;
  readonly Icon icon;
  readonly ToolStripMenuItem statusItem,openItem,toggleItem,exitItem;
  readonly Timer timer=new Timer{Interval=1000};
  readonly LightScheduleEngine engine;
  LightForm form;
  Task<bool> active;
  DateTime next=DateTime.MinValue;
  DateTime nextText=DateTime.MinValue;
  string locale="ko";
  bool exiting;
  int pulses;
  public LightContext(string root,ProcessSignals signals,bool background,bool verify){
   this.root=root;this.signals=signals;this.verify=verify;
   using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("Hyzen.AppIcon.ico"))using(var loaded=new Icon(stream))icon=(Icon)loaded.Clone();
   engine=new LightScheduleEngine(root,ReadSchedule);
   var menu=new ContextMenuStrip{BackColor=Color.FromArgb(24,29,43),ForeColor=Color.FromArgb(231,233,245),ShowImageMargin=false};
   statusItem=new ToolStripMenuItem{Enabled=false};openItem=new ToolStripMenuItem();toggleItem=new ToolStripMenuItem();exitItem=new ToolStripMenuItem();
   openItem.Click+=delegate{ShowSettings();};toggleItem.Click+=delegate{Toggle();};exitItem.Click+=async delegate{await ExitAsync();};
   menu.Items.AddRange(new ToolStripItem[]{statusItem,new ToolStripSeparator(),openItem,toggleItem,new ToolStripSeparator(),exitItem});
   menu.Opening+=delegate{RefreshText();};
   tray=new NotifyIcon{Icon=icon,Text="Lofree Light",ContextMenuStrip=menu,Visible=!verify};tray.DoubleClick+=delegate{ShowSettings();};
   timer.Tick+=async delegate{
    if(exiting)return;
    if(signals!=null&&signals.TakeExit()){await ExitAsync();return;}
    if(signals!=null&&signals.TakeShow())ShowSettings();
    if(DateTime.UtcNow>=next)Check();
    if(DateTime.UtcNow>=nextText){RefreshText();nextText=DateTime.UtcNow.AddSeconds(5);}
   };
   SystemEvents.PowerModeChanged+=Resume;SystemEvents.TimeChanged+=TimeChanged;
   timer.Start();if(!background)ShowSettings();
   if(verify){var test=new Timer{Interval=600};test.Tick+=async delegate{test.Stop();test.Dispose();await Verify();};test.Start();}
   else Check();
  }
  UserPreferences Preferences(){return new UserPreferences(Path.Combine(root,"preferences.json"));}
  LightingScheduleSettings ReadSchedule(){return Preferences().LightingSchedule;}
  internal string Text(string ko,string en){return locale=="en"?en:ko;}
  internal string StatusText {
   get{
    if(!ReadSchedule().enabled)return Text("예약 꺼짐","Schedule off");
    switch(engine.Status){case "on":return Text("하단 바 켜짐","Front bar on");case "off":return Text("하단 바 꺼짐","Front bar off");case "hub":return Text("HUB에서 제어 중","Controlled by HUB");case "retry":return Text("장치 응답 대기 · 자동 재시도","Waiting for device · retrying");default:return Text("키보드 연결 대기","Waiting for keyboard");}
   }
  }
  void RefreshText(){
   locale=Preferences().Language;
   string status=StatusText;statusItem.Text=status;openItem.Text=Text("설정 열기","Open settings");toggleItem.Text=ReadSchedule().enabled?Text("예약 끄기","Disable schedule"):Text("예약 켜기","Enable schedule");exitItem.Text=Text("종료","Exit");
   string caption="Lofree Light · "+status;tray.Text=caption.Length>63?caption.Substring(0,63):caption;
   if(form!=null&&!form.IsDisposed)form.UpdateStatus(status);
  }
  void Check(){
   if(verify||exiting||active!=null&&!active.IsCompleted)return;
   next=DateTime.UtcNow.AddSeconds(15);pulses++;active=Task.Run(()=>engine.Tick());
  }
  void Resume(object sender,PowerModeChangedEventArgs e){if(e.Mode==PowerModes.Resume){engine.Invalidate();next=DateTime.MinValue;}}
  void TimeChanged(object sender,EventArgs e){next=DateTime.MinValue;}
  void Toggle(){
   try{var prefs=Preferences();var old=prefs.LightingSchedule;prefs.SetLightingSchedule(new LightingScheduleSettings(!old.enabled,old.onTime,old.offTime,old.brightness,false,true,false));next=DateTime.MinValue;RefreshText();if(form!=null&&!form.IsDisposed)form.LoadPreferences();}
   catch(Exception error){MessageBox.Show(error.Message,"Lofree Light");}
  }
  void ShowSettings(){
   if(exiting)return;
   if(form==null||form.IsDisposed)form=new LightForm(this,Preferences,verify,icon);
   form.LoadPreferences();form.Show();if(form.WindowState==FormWindowState.Minimized)form.WindowState=FormWindowState.Normal;form.Activate();RefreshText();
  }
  internal void Saved(){next=DateTime.MinValue;Check();RefreshText();}
  async Task ExitAsync(){
   if(exiting)return;exiting=true;timer.Stop();
   try{if(active!=null)await active;}finally{ExitThread();}
  }
  protected override void ExitThreadCore(){
   exiting=true;timer.Stop();timer.Dispose();SystemEvents.PowerModeChanged-=Resume;SystemEvents.TimeChanged-=TimeChanged;
   if(form!=null){form.AllowExit=true;form.Close();form.Dispose();}
   tray.Visible=false;tray.ContextMenuStrip.Dispose();tray.Dispose();icon.Dispose();base.ExitThreadCore();
  }
  async Task Verify(){
   try{
    var checks=form.VerifyFields();
    using(var bitmap=new Bitmap(form.Width,form.Height)){form.DrawToBitmap(bitmap,new Rectangle(Point.Empty,bitmap.Size));bitmap.Save(Path.Combine(root,"lofree-light.png"));}
    foreach(var result in form.VerifyEdits())checks[result.Key]=result.Value;
    using(var bitmap=new Bitmap(form.Width,form.Height)){form.DrawToBitmap(bitmap,new Rectangle(Point.Empty,bitmap.Size));bitmap.Save(Path.Combine(root,"lofree-light-en.png"));}
    form.Close();checks["closeHidesSettingsWithoutExiting"]=!form.Visible&&!form.IsDisposed&&!exiting;
    ShowSettings();checks["trayRestoresSettings"]=form.Visible&&!form.IsDisposed;
    checks["noBrowserAssemblies"]=!AppDomain.CurrentDomain.GetAssemblies().Any(a=>a.GetName().Name.Contains("WebView")||a.GetName().Name=="PresentationFramework");
    checks["verificationMakesNoDeviceWrites"]=engine.Writes==0&&pulses==0;
    File.WriteAllText(Path.Combine(root,"light-ui-result.json"),new JavaScriptSerializer().Serialize(new{checks=checks,passed=checks.Values.All(value=>value),workingSetBytes=Process.GetCurrentProcess().WorkingSet64}));
   }catch(Exception error){File.WriteAllText(Path.Combine(root,"light-ui-error.txt"),error.ToString());}
   await ExitAsync();
  }
 }
 sealed class LightForm : Form {
  [System.Runtime.InteropServices.DllImport("dwmapi.dll")]static extern int DwmSetWindowAttribute(IntPtr window,int attribute,ref int value,int size);
  readonly LightContext context;
  readonly Func<UserPreferences> preferences;
  readonly bool verify;
  readonly CheckBox enabled=new CheckBox(),startup=new CheckBox();
  readonly TextBox on=new TextBox(),off=new TextBox(),brightness=new TextBox();
  readonly Button language=new Button();
  readonly Label status=new Label(),hint=new Label(),onLabel=new Label(),offLabel=new Label(),brightnessLabel=new Label();
  readonly Button save=new Button();
  readonly Color ink=Color.FromArgb(235,237,247),muted=Color.FromArgb(164,173,195),field=Color.FromArgb(34,41,61);
  public bool AllowExit;
  protected override void OnHandleCreated(EventArgs e){base.OnHandleCreated(e);try{int dark=1;DwmSetWindowAttribute(Handle,20,ref dark,4);}catch{}}
  public LightForm(LightContext context,Func<UserPreferences> preferences,bool verify,Icon icon){
   this.context=context;this.preferences=preferences;this.verify=verify;
   Text="Lofree Light";Icon=icon;ClientSize=new Size(416,380);StartPosition=FormStartPosition.CenterScreen;FormBorderStyle=FormBorderStyle.None;MaximizeBox=false;
   AutoScaleMode=AutoScaleMode.None;Font=new Font("Segoe UI",11);BackColor=Color.FromArgb(17,23,38);ForeColor=ink;
   var heading=new Label{Text="Lofree Light",Font=new Font("Segoe UI",19,FontStyle.Regular),AutoSize=true,Location=new Point(24,18)};heading.MouseDown+=DragWindow;Controls.Add(heading);MouseDown+=DragWindow;
   var close=new Button{Text="×",FlatStyle=FlatStyle.Flat,BackColor=BackColor,ForeColor=muted,TabStop=false};close.FlatAppearance.BorderSize=0;close.SetBounds(371,14,28,28);close.Click+=delegate{Close();};Controls.Add(close);
   status.SetBounds(25,67,365,24);status.ForeColor=muted;Controls.Add(status);
   enabled.SetBounds(26,105,330,28);enabled.AutoSize=false;Controls.Add(enabled);
   Field(onLabel,on,150);Field(offLabel,off,195);Field(brightnessLabel,brightness,240);
   on.MaxLength=5;off.MaxLength=5;brightness.MaxLength=3;on.AccessibleName="On time";off.AccessibleName="Off time";brightness.AccessibleName="Night brightness";
   hint.SetBounds(26,282,365,24);hint.Font=new Font("Segoe UI",9);hint.ForeColor=muted;Controls.Add(hint);
   startup.SetBounds(26,324,260,28);Controls.Add(startup);
   language.SetBounds(289,24,64,29);language.Text="KO";language.BackColor=field;language.ForeColor=ink;language.FlatStyle=FlatStyle.Flat;language.FlatAppearance.BorderSize=0;language.Click+=delegate{language.Text=English?"KO":"EN";Localize();};Controls.Add(language);
   save.SetBounds(294,319,96,36);save.FlatStyle=FlatStyle.Flat;save.FlatAppearance.BorderSize=0;save.BackColor=Color.FromArgb(63,67,105);save.ForeColor=ink;save.Click+=delegate{Save();};Controls.Add(save);AcceptButton=save;
   enabled.FlatStyle=FlatStyle.Flat;startup.FlatStyle=FlatStyle.Flat;
   FormClosing+=delegate(object sender,FormClosingEventArgs e){if(!AllowExit&&e.CloseReason==CloseReason.UserClosing){e.Cancel=true;Hide();}};
   AutoScaleMode=AutoScaleMode.None;
  }
  protected override void OnLoad(EventArgs e){
   using(var graphics=CreateGraphics()){float scale=graphics.DpiX/96f;if(scale>1.01f)Scale(new SizeF(scale,scale));}
   base.OnLoad(e);
  }
  void Field(Label label,TextBox input,int y){
   label.SetBounds(26,y+3,212,28);label.ForeColor=muted;Controls.Add(label);
   input.SetBounds(276,y,114,29);input.BorderStyle=BorderStyle.FixedSingle;input.TextAlign=HorizontalAlignment.Center;input.BackColor=field;input.ForeColor=ink;Controls.Add(input);
  }
  [System.Runtime.InteropServices.DllImport("user32.dll")]static extern bool ReleaseCapture();
  [System.Runtime.InteropServices.DllImport("user32.dll")]static extern IntPtr SendMessage(IntPtr hwnd,int message,IntPtr wParam,IntPtr lParam);
  void DragWindow(object sender,MouseEventArgs e){if(e.Button==MouseButtons.Left){ReleaseCapture();SendMessage(Handle,0xA1,new IntPtr(2),IntPtr.Zero);}}
  protected override void OnPaint(PaintEventArgs e){base.OnPaint(e);using(var pen=new Pen(Color.FromArgb(49,59,83)))e.Graphics.DrawRectangle(pen,0,0,ClientSize.Width-1,ClientSize.Height-1);}
  bool English {get{return language.Text=="EN";}}
  string T(string ko,string en){return English?en:ko;}
  void Localize(){
   enabled.Text=T("하단 바 예약","Front bar schedule");onLabel.Text=T("켜지는 시간","Turn on at");offLabel.Text=T("꺼지는 시간","Turn off at");brightnessLabel.Text=T("밤 밝기 (%)","Night brightness (%)");
   startup.Text=T("Windows 시작 시 실행","Start with Windows");save.Text=T("적용","Apply");hint.Text=T("PC 시간 기준 · 키 조명 꺼짐","PC clock · Key lights off");
  }
  internal void LoadPreferences(){var prefs=preferences();var value=prefs.LightingSchedule;enabled.Checked=value.enabled;on.Text=value.onTime;off.Text=value.offTime;brightness.Text=value.brightness.ToString();startup.Checked=!verify&&LightStartup.Enabled;language.Text=prefs.Language=="en"?"EN":"KO";Localize();}
  internal void UpdateStatus(string value){status.Text=value;}
  void Save(){
   try{
    int level;if(!int.TryParse(brightness.Text,out level))throw new ArgumentException(T("밝기는 1~100으로 입력하세요.","Enter a brightness from 1 to 100."));
    var value=new LightingScheduleSettings(enabled.Checked,on.Text.Trim(),off.Text.Trim(),level,false,true,false);
    var prefs=preferences();prefs.SetPartial(English?"en":"ko",null,value);if(!verify)LightStartup.Set(startup.Checked);
    context.Saved();LoadPreferences();
   }catch(Exception error){MessageBox.Show(this,T("설정을 저장하지 못했습니다. 시간은 HH:mm, 밝기는 1~100으로 입력하세요.\n","Could not save. Use HH:mm for times and 1–100 for brightness.\n")+error.Message,"Lofree Light",MessageBoxButtons.OK,MessageBoxIcon.Warning);}
  }
  internal System.Collections.Generic.Dictionary<string,bool> VerifyFields(){return new System.Collections.Generic.Dictionary<string,bool>{
   {"defaultHours",on.Text=="20:00"&&off.Text=="08:00"},{"defaultBrightness",brightness.Text=="50"},{"barOnlyDefault",!preferences().LightingSchedule.back&&preferences().LightingSchedule.front&&!preferences().LightingSchedule.receiver},{"fieldsAligned",on.Left==off.Left&&off.Left==brightness.Left&&on.Width==off.Width&&off.Width==brightness.Width},{"startupOffInIsolatedVerification",!startup.Checked},{"allControlsFit",Controls.Cast<Control>().All(c=>c.Right<=ClientSize.Width&&c.Bottom<=ClientSize.Height)}};}
  internal System.Collections.Generic.Dictionary<string,bool> VerifyEdits(){
   enabled.Checked=true;on.Text="21:30";off.Text="07:45";brightness.Text="35";language.Text="EN";Localize();save.PerformClick();
   var stored=preferences();return new System.Collections.Generic.Dictionary<string,bool>{{"settingsApplyPersistsHoursAndBrightness",stored.LightingSchedule.enabled&&stored.LightingSchedule.onTime=="21:30"&&stored.LightingSchedule.offTime=="07:45"&&stored.LightingSchedule.brightness==35&&!stored.LightingSchedule.back&&stored.LightingSchedule.front&&!stored.LightingSchedule.receiver},{"englishPersistsAndUpdatesLabels",stored.Language=="en"&&onLabel.Text=="Turn on at"&&enabled.Text=="Front bar schedule"},{"englishLabelsFit",new Control[]{onLabel,offLabel,brightnessLabel,enabled,startup}.All(c=>TextRenderer.MeasureText(c.Text,c.Font).Width+24<c.Width)}};
  }
 }
}
