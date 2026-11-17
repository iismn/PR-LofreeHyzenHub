using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace HyzenControl {
 // A file handle may cross async threads; Windows releases it if either process exits.
 sealed class DeviceLease : IDisposable {
  FileStream handle;
  DeviceLease(FileStream handle){this.handle=handle;}
  public static DeviceLease TryAcquire(string root){
   Directory.CreateDirectory(root);
   try{return new DeviceLease(new FileStream(Path.Combine(root,"device.lock"),FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None));}
   catch(IOException){return null;}
  }
  public static async Task<DeviceLease> AcquireAsync(string root){
   for(int attempt=0;attempt<100;attempt++){var lease=TryAcquire(root);if(lease!=null)return lease;await Task.Delay(100);}
   throw new IOException("조명 예약이 장치와 통신 중입니다. 잠시 후 다시 연결하세요.");
  }
  public void Dispose(){var previous=Interlocked.Exchange(ref handle,null);if(previous!=null)previous.Dispose();}
 }
 sealed class ProcessSignals : IDisposable {
  readonly Mutex instance;
  readonly EventWaitHandle show,exit;
  public readonly bool First;
  public ProcessSignals(string name){
   bool created;instance=new Mutex(false,"Local\\"+name+".Instance",out created);First=created;
   show=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\"+name+".Show");
   exit=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\"+name+".Exit");
  }
  public void RequestShow(){show.Set();}
  public void RequestExit(){exit.Set();}
  public bool TakeShow(){return show.WaitOne(0);}
  public bool TakeExit(){return exit.WaitOne(0);}
  public void Dispose(){show.Dispose();exit.Dispose();instance.Dispose();}
 }
}
