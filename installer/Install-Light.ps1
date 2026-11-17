param(
 [string]$ExecutablePath=(Join-Path $PSScriptRoot 'LofreeLight.exe'),
 [string]$InstallDirectory=(Join-Path $env:LOCALAPPDATA 'Programs\LofreeHUB'),
 [string]$PreferencePath=(Join-Path $env:LOCALAPPDATA 'HyzenControl\preferences.json'),
 [switch]$NoLaunch,
 [switch]$NoStartup,
 [switch]$PreserveSchedule
)
$ErrorActionPreference='Stop'
$sourceExe=[IO.Path]::GetFullPath($ExecutablePath)
if(-not(Test-Path -LiteralPath $sourceExe -PathType Leaf)){throw 'LofreeLight.exe was not found'}
$installRoot=[IO.Path]::GetFullPath($InstallDirectory)
$installedExe=Join-Path $installRoot 'LofreeLight.exe'
$running=@(Get-Process LofreeLight -ErrorAction SilentlyContinue)
if($running.Count){
 $signal=Start-Process -FilePath $sourceExe -ArgumentList '--exit' -WindowStyle Hidden -PassThru
 if(-not $signal.WaitForExit(10000)){throw 'Could not contact Lofree Light'}
 foreach($process in $running){if(-not $process.WaitForExit(30000)){throw 'Lofree Light is still applying lighting. Try installation again shortly.'}}
}
New-Item -ItemType Directory -Path $installRoot -Force|Out-Null
if($sourceExe -ne $installedExe){Copy-Item -LiteralPath $sourceExe -Destination $installedExe -Force}
$preferenceFile=[IO.Path]::GetFullPath($PreferencePath)
$hash=[Security.Cryptography.SHA256]::Create()
try{$mutexName='Local\Lofree.Preferences.'+[BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($preferenceFile.ToUpperInvariant()))).Replace('-','')}finally{$hash.Dispose()}
$mutex=New-Object Threading.Mutex($false,$mutexName);$held=$false;$temporary=$preferenceFile+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
try{
 try{$held=$mutex.WaitOne(5000)}catch [Threading.AbandonedMutexException]{$held=$true}
 if(-not $held){throw 'Preferences are busy'}
 $preferences=$null
 if(Test-Path -LiteralPath $preferenceFile){try{$preferences=Get-Content -LiteralPath $preferenceFile -Raw|ConvertFrom-Json}catch{}}
 if(-not $preferences){$preferences=[pscustomobject]@{language='ko';keyboardScale=120}}
 $old=$preferences.lightingSchedule
 $on='20:00';$off='08:00';$level=50;$enabled=$false
 if($old){
  if($old.onTime -cmatch '^([01][0-9]|2[0-3]):[0-5][0-9]$'){$on=$old.onTime}
  if($old.offTime -cmatch '^([01][0-9]|2[0-3]):[0-5][0-9]$' -and $old.offTime -ne $on){$off=$old.offTime}
  if($on -eq $off){$on='20:00';$off='08:00'}
  if($old.brightness -is [ValueType] -and $old.brightness -ge 1 -and $old.brightness -le 100 -and $old.brightness -eq [Math]::Truncate($old.brightness)){$level=[int]$old.brightness}
  $enabled=$old.enabled -is [bool] -and $old.enabled
 }
 if(-not $PreserveSchedule){$enabled=$true}
 $schedule=[pscustomobject]@{enabled=$enabled;onTime=$on;offTime=$off;brightness=$level;back=$false;front=$true;receiver=$false}
 $preferences|Add-Member -NotePropertyName lightingSchedule -NotePropertyValue $schedule -Force
 New-Item -ItemType Directory -Path (Split-Path $preferenceFile) -Force|Out-Null
 [IO.File]::WriteAllText($temporary,($preferences|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
 if(Test-Path -LiteralPath $preferenceFile){[IO.File]::Replace($temporary,$preferenceFile,[NullString]::Value)}else{[IO.File]::Move($temporary,$preferenceFile)}
}finally{if(Test-Path -LiteralPath $temporary){Remove-Item -LiteralPath $temporary -Force};if($held){$mutex.ReleaseMutex()};$mutex.Dispose()}
if(-not $NoStartup){
 $key=[Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Software\Microsoft\Windows\CurrentVersion\Run')
 try{$key.SetValue('LofreeLight',('"'+$installedExe+'" --background'),[Microsoft.Win32.RegistryValueKind]::String)}finally{$key.Dispose()}
}
$shortcutPath=Join-Path ([Environment]::GetFolderPath('Programs')) 'Lofree Light.lnk'
$shell=New-Object -ComObject WScript.Shell
try{$shortcut=$shell.CreateShortcut($shortcutPath);$shortcut.TargetPath=$installedExe;$shortcut.WorkingDirectory=$installRoot;$shortcut.IconLocation=$installedExe+',0';$shortcut.Description='Lofree HYZEN front bar schedule';$shortcut.Save();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut)}finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)}
$startupKey=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Run')
try{$startsWithWindows=$startupKey -and [string]::Equals([string]$startupKey.GetValue('LofreeLight'),('"'+$installedExe+'" --background'),[StringComparison]::OrdinalIgnoreCase)}finally{if($startupKey){$startupKey.Dispose()}}
[pscustomobject]@{Executable=$installedExe;Shortcut=$shortcutPath;StartsWithWindows=$startsWithWindows;ScheduleEnabled=$schedule.enabled;FrontBarOnly=$true;OnTime=$on;OffTime=$off;NightBrightness=$level}
if(-not $NoLaunch){Start-Process -FilePath $installedExe -ArgumentList '--background' -WindowStyle Hidden}
