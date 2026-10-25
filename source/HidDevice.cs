using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32.SafeHandles;

namespace HyzenControl {
 public sealed class DeviceInfo {
  public string path, name, connection;
  public int vendorId, productId, usagePage, usage, inputLength, outputLength;
 }
 public sealed class HidDevice : IDisposable {
  const int Vendor = 0x388d;
  FileStream stream;
  readonly BlockingCollection<byte[]> incoming = new BlockingCollection<byte[]>();
  readonly SemaphoreSlim gate = new SemaphoreSlim(1,1);
  volatile bool disposed;
  public DeviceInfo Info { get; private set; }
  public event Action<byte[]> Report;
  public static List<DeviceInfo> Enumerate() {
   var result = new List<DeviceInfo>(); Guid guid; HidD_GetHidGuid(out guid);
   IntPtr set = SetupDiGetClassDevs(ref guid, null, IntPtr.Zero, 0x12);
   if(set == new IntPtr(-1)) throw new Win32Exception();
   try { for(uint i=0;;i++) {
    var data = new InterfaceData { cbSize = Marshal.SizeOf(typeof(InterfaceData)) };
    if(!SetupDiEnumDeviceInterfaces(set,IntPtr.Zero,ref guid,i,ref data)) break;
    uint size; SetupDiGetDeviceInterfaceDetail(set, ref data, IntPtr.Zero,0,out size,IntPtr.Zero);
    if(size < 8) continue;
    IntPtr detail=Marshal.AllocHGlobal((int)size);
    try {
     Marshal.WriteInt32(detail, IntPtr.Size==8?8:6);
     if(!SetupDiGetDeviceInterfaceDetail(set,ref data,detail,size,out size,IntPtr.Zero)) continue;
     string path=Marshal.PtrToStringUni(IntPtr.Add(detail,4));
     if(path==null || !path.ToLowerInvariant().Contains("vid_388d")) continue;
     using(var handle=CreateFile(path,0,3,IntPtr.Zero,3,0,IntPtr.Zero)) {
      if(handle.IsInvalid) continue;
      var attr=new Attributes { Size=Marshal.SizeOf(typeof(Attributes)) };
      if(!HidD_GetAttributes(handle,ref attr)||attr.VendorID!=Vendor||!new[]{36,37,41}.Contains((int)attr.ProductID)) continue;
      IntPtr preparsed;
      if(!HidD_GetPreparsedData(handle,out preparsed)) continue;
      try {
       Caps caps; if(HidP_GetCaps(preparsed,out caps)<0 || caps.UsagePage!=65308 || caps.Usage!=146) continue;
       var product=new StringBuilder(128); HidD_GetProductString(handle,product,256);
       result.Add(new DeviceInfo { path=path,name=product.Length>0?product.ToString():"Lofree HYZEN",vendorId=attr.VendorID,productId=attr.ProductID,usagePage=caps.UsagePage,usage=caps.Usage,inputLength=caps.InputReportByteLength,outputLength=caps.OutputReportByteLength,connection=attr.ProductID==37?"2.4 GHz":"USB" });
      } finally { HidD_FreePreparsedData(preparsed); }
     }
    } finally { Marshal.FreeHGlobal(detail); }
   }} finally { SetupDiDestroyDeviceInfoList(set); }
   return result.OrderBy(x=>x.productId==37?1:0).ToList();
  }
  public HidDevice(DeviceInfo info) {
   Info=info;
   var handle=CreateFile(info.path,0xC0000000,3,IntPtr.Zero,3,0x40000000,IntPtr.Zero);
   if(handle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error(),"Hyzen 장치를 열지 못했습니다. 공식 웹 드라이버 등 다른 제어 프로그램을 닫고 다시 연결하세요.");
   stream=new FileStream(handle,FileAccess.ReadWrite,1,true);
   Task.Run((Func<Task>)ReadLoop);
  }
  async Task ReadLoop() {
   try { while(!disposed) {
    byte[] buffer=new byte[Math.Max(32,Info.inputLength)]; int n=await stream.ReadAsync(buffer,0,buffer.Length);
    if(n==0) break;
    byte[] p=buffer.Take(n).ToArray();
    if(p[0]!=4) continue;
    incoming.Add(p);
    var listener=Report; if(listener!=null) listener(p);
   }} catch(Exception) { if(!disposed) incoming.CompleteAdding(); }
  }
  public static byte[] BuildPacket(bool wired, byte command, int offset, int length, byte[] payload) {
   int total=wired?64:32;
   if(offset<0||offset>65535||length<0||length>total-8||payload!=null&&payload.Length!=length) throw new ArgumentOutOfRangeException();
   byte[] p=new byte[total];p[0]=4;p[3]=command;p[4]=(byte)length;p[5]=(byte)offset;p[6]=(byte)(offset>>8);
   if(payload!=null) Buffer.BlockCopy(payload,0,p,8,length);
   return p;
  }
  async Task Send(byte[] packet) {
   if(disposed) throw new IOException("장치 연결이 해제되었습니다.");
   if(packet.Length!=Info.outputLength) { var padded=new byte[Info.outputLength];Buffer.BlockCopy(packet,0,padded,0,Math.Min(packet.Length,padded.Length));packet=padded; }
   await stream.WriteAsync(packet,0,packet.Length);
  }
  byte[] Wait(byte command, int offset=-1) {
   var sw=Stopwatch.StartNew();byte[] p;
   while(sw.ElapsedMilliseconds<3000) {
    if(incoming.TryTake(out p,Math.Max(1,3000-(int)sw.ElapsedMilliseconds))) {
     if(p.Length<4||p[0]!=4||p[3]!=command&&!(offset>=0&&p[3]==0)) continue;
     if(offset>=0&&(p.Length<8||p[5]!=(byte)offset||p[6]!=(byte)(offset>>8))) continue;
     return p;
    }
    if(incoming.IsCompleted) throw new IOException("키보드 연결이 끊어졌습니다.");
   }
   throw new TimeoutException("Hyzen 응답 시간이 초과되었습니다 (명령 0x"+command.ToString("X2")+"). 키보드를 깨우거나 다른 드라이버를 닫은 뒤 다시 연결하세요.");
  }
  public async Task<byte[]> Transfer(byte command,int offset,int length,byte[] payload) {
   if(offset<0||length<0||offset+length>65536||length>4096) throw new ArgumentOutOfRangeException();
   await gate.WaitAsync(); bool started=false;
   try {
    byte[] old;while(incoming.TryTake(out old)){}
    bool wired=Info.productId!=37;int chunk=wired?56:24;
    byte[] control=BuildPacket(wired,1,0,24,null);
    await Send(control);Wait(1);started=true;
    var output=new List<byte>();
    for(int pos=0;pos<length||pos==0&&payload!=null&&length==0;pos+=chunk) {
     int count=Math.Min(chunk,length-pos),at=offset+pos;
     byte[] slice=payload==null?null:payload.Skip(pos).Take(count).ToArray();
     await Send(BuildPacket(wired,command,at,count,slice));
     byte[] reply=Wait(command,at);
     if(payload==null) {
      if(reply.Length<8+count||reply[4]!=count) throw new IOException("장치가 불완전한 데이터를 반환했습니다.");
      output.AddRange(reply.Skip(8).Take(count));
     }
    }
    await Send(BuildPacket(wired,2,0,24,null));Wait(2);started=false;
    return output.ToArray();
   } finally {
    if(started&&!disposed) try {Send(BuildPacket(Info.productId!=37,2,0,24,null)).GetAwaiter().GetResult();}catch{}
    gate.Release();
   }
  }
  public void Dispose() { if(disposed)return;disposed=true;if(stream!=null)stream.Dispose();incoming.CompleteAdding(); }
  [StructLayout(LayoutKind.Sequential)] struct InterfaceData { public int cbSize;public Guid guid;public int flags;public IntPtr reserved; }
  [StructLayout(LayoutKind.Sequential)] struct Attributes { public int Size;public ushort VendorID,ProductID,VersionNumber; }
  [StructLayout(LayoutKind.Sequential)] struct Caps { public ushort Usage,UsagePage,InputReportByteLength,OutputReportByteLength,FeatureReportByteLength;[MarshalAs(UnmanagedType.ByValArray,SizeConst=17)] public ushort[] Reserved;public ushort NumberLinkCollectionNodes,NumberInputButtonCaps,NumberInputValueCaps,NumberInputDataIndices,NumberOutputButtonCaps,NumberOutputValueCaps,NumberOutputDataIndices,NumberFeatureButtonCaps,NumberFeatureValueCaps,NumberFeatureDataIndices; }
  [DllImport("hid.dll")] static extern void HidD_GetHidGuid(out Guid guid);
  [DllImport("hid.dll")] static extern bool HidD_GetAttributes(SafeFileHandle device,ref Attributes attr);
  [DllImport("hid.dll")] static extern bool HidD_GetPreparsedData(SafeFileHandle device,out IntPtr data);
  [DllImport("hid.dll")] static extern bool HidD_FreePreparsedData(IntPtr data);
  [DllImport("hid.dll")] static extern int HidP_GetCaps(IntPtr data,out Caps caps);
  [DllImport("hid.dll",CharSet=CharSet.Unicode)] static extern bool HidD_GetProductString(SafeFileHandle device,StringBuilder text,int length);
  [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr SetupDiGetClassDevs(ref Guid guid,string enumerator,IntPtr hwnd,int flags);
  [DllImport("setupapi.dll",SetLastError=true)] static extern bool SetupDiEnumDeviceInterfaces(IntPtr set,IntPtr dev,ref Guid guid,uint index,ref InterfaceData data);
  [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr set,ref InterfaceData data,IntPtr detail,uint size,out uint required,IntPtr dev);
  [DllImport("setupapi.dll")] static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern SafeFileHandle CreateFile(string path,uint access,uint sharing,IntPtr security,uint creation,uint flags,IntPtr template);
 }
}
