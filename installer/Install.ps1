param(
 [string]$ExecutablePath=(Join-Path $PSScriptRoot 'LofreeHUB.exe'),
 [string]$InstallDirectory=(Join-Path $env:LOCALAPPDATA 'Programs\LofreeHUB'),
 [switch]$NoLaunch
)
$ErrorActionPreference='Stop'
$sourceExe=[IO.Path]::GetFullPath($ExecutablePath)
if(-not(Test-Path -LiteralPath $sourceExe -PathType Leaf)){throw 'LofreeHUB.exe was not found'}
$installRoot=[IO.Path]::GetFullPath($InstallDirectory)
$installedExe=Join-Path $installRoot 'LofreeHUB.exe'
foreach($runningApp in (Get-Process LofreeHUB -ErrorAction SilentlyContinue|Where-Object {$_.Path -eq $installedExe})){
 [void]$runningApp.CloseMainWindow()
 if(-not $runningApp.WaitForExit(15000)){throw 'Lofree HUB is still applying changes. Close it and run installation again.'}
}
New-Item -ItemType Directory -Path $installRoot -Force|Out-Null
if($sourceExe -ne $installedExe){Copy-Item -LiteralPath $sourceExe -Destination $installedExe -Force}
$programs=[Environment]::GetFolderPath('Programs')
$shortcutPath=Join-Path $programs 'Lofree HUB.lnk'
$shell=New-Object -ComObject WScript.Shell
$shortcut=$shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath=$installedExe
$shortcut.WorkingDirectory=$installRoot
$shortcut.IconLocation=$installedExe+',0'
$shortcut.Description='Lofree HUB'
$shortcut.WindowStyle=1
$shortcut.Save()
[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut)
[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
if(-not ('LofreeHubShortcutProperties' -as [type])){
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class LofreeHubShortcutProperties {
 [StructLayout(LayoutKind.Sequential)] public struct PropertyKey {public Guid Format;public uint Id;}
 [StructLayout(LayoutKind.Explicit,Size=24)] public struct PropVariant {
  [FieldOffset(0)] public ushort Type;
  [FieldOffset(8)] public IntPtr Pointer;
 }
 [ComImport,Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IPropertyStore {
  [PreserveSig]int GetCount(out uint count);
  [PreserveSig]int GetAt(uint index,out PropertyKey key);
  [PreserveSig]int GetValue(ref PropertyKey key,out PropVariant value);
  [PreserveSig]int SetValue(ref PropertyKey key,ref PropVariant value);
  [PreserveSig]int Commit();
 }
 [DllImport("shell32.dll",CharSet=CharSet.Unicode,PreserveSig=false)]
 static extern void SHGetPropertyStoreFromParsingName(string path,IntPtr bind,uint flags,ref Guid iid,out IPropertyStore store);
 [DllImport("ole32.dll")]static extern int PropVariantClear(ref PropVariant value);
 [DllImport("shell32.dll")]static extern void SHChangeNotify(uint eventId,uint flags,IntPtr item1,IntPtr item2);
 public static string SetAndReadAppId(string path,string appId){
  Guid iid=typeof(IPropertyStore).GUID;IPropertyStore store;
  SHGetPropertyStoreFromParsingName(path,IntPtr.Zero,2,ref iid,out store);
  var key=new PropertyKey{Format=new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),Id=5};
  var value=new PropVariant{Type=31,Pointer=Marshal.StringToCoTaskMemUni(appId)};
  try{Marshal.ThrowExceptionForHR(store.SetValue(ref key,ref value));Marshal.ThrowExceptionForHR(store.Commit());}
  finally{PropVariantClear(ref value);Marshal.FinalReleaseComObject(store);}
  SHGetPropertyStoreFromParsingName(path,IntPtr.Zero,0,ref iid,out store);
  try{Marshal.ThrowExceptionForHR(store.GetValue(ref key,out value));return value.Type==31?Marshal.PtrToStringUni(value.Pointer):null;}
  finally{PropVariantClear(ref value);Marshal.FinalReleaseComObject(store);SHChangeNotify(0x08000000,0,IntPtr.Zero,IntPtr.Zero);}
 }
}
'@
}
$actualId=[LofreeHubShortcutProperties]::SetAndReadAppId($shortcutPath,'Lofree.HUB')
if($actualId -ne 'Lofree.HUB'){throw 'Shortcut application ID did not match'}
[pscustomobject]@{Executable=$installedExe;Shortcut=$shortcutPath;AppUserModelId=$actualId}
if(-not $NoLaunch){Start-Process -FilePath $installedExe -WindowStyle Hidden}
