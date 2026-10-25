param([string]$OutputDirectory,[string]$WebViewSdkDirectory)
$ErrorActionPreference='Stop'
$project=$PSScriptRoot
if(-not(Test-Path (Join-Path $project 'source\assets\LofreeHUB.ico'))){& (Join-Path $project 'build-icon.ps1')}
if(-not $OutputDirectory){$OutputDirectory=Join-Path $project 'build'}
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$OutputDirectory=[IO.Path]::GetFullPath($OutputDirectory)
$sdk=if($WebViewSdkDirectory){$WebViewSdkDirectory}else{Join-Path $project '.build\webview2'}
if(-not(Test-Path "$sdk\lib\net462\Microsoft.Web.WebView2.Wpf.dll")){
 $existing=Join-Path (Split-Path $project) 'MonitorShade-auto-monitoring\.build\webview2'
 if(Test-Path "$existing\lib\net462\Microsoft.Web.WebView2.Wpf.dll"){$sdk=$existing}
 else {
  New-Item -ItemType Directory -Path $sdk -Force | Out-Null
  $archive=Join-Path $sdk 'sdk.zip'
  Invoke-WebRequest -Uri 'https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/1.0.4258.31/microsoft.web.webview2.1.0.4258.31.nupkg' -OutFile $archive
  if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne '56F7F4B8BF9AEE4B8EFEFBBDD4F67D5F74EBD1B100ED0806DA71BF76AF481AA9'){throw 'WebView2 SDK checksum mismatch'}
  Expand-Archive -LiteralPath $archive -DestinationPath $sdk -Force
 }
}
$framework=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$refs=@('System.dll','System.Core.dll','System.Drawing.dll','System.Windows.Forms.dll','System.Web.Extensions.dll','System.Xaml.dll')
$refs+=@('PresentationCore.dll','PresentationFramework.dll','WindowsBase.dll')|ForEach-Object{Join-Path "$framework\WPF" $_}
$refs+=@('Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.Wpf.dll')|ForEach-Object{Join-Path "$sdk\lib\net462" $_}
$argsList=@('/nologo','/target:winexe','/platform:x64','/optimize+','/codepage:65001',"/out:$OutputDirectory\LofreeHUB.exe","/win32manifest:$project\source\app.manifest","/win32icon:$project\source\assets\LofreeHUB.ico","/resource:$project\source\assets\LofreeHUB.ico,Hyzen.AppIcon.ico")
$argsList+=$refs|ForEach-Object{'/reference:'+$_}
$argsList+=@("$project\source\App.cs","$project\source\HidDevice.cs")
foreach($name in @('Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.Wpf.dll')){$argsList+="/resource:$sdk\lib\net462\$name,Hyzen.Runtime.$name"}
$argsList+="/resource:$sdk\runtimes\win-x64\native\WebView2Loader.dll,Hyzen.Runtime.WebView2Loader.dll"
Get-ChildItem "$project\source\web" -File | ForEach-Object{$argsList+="/resource:$($_.FullName),Hyzen.Web.$($_.Name)"}
& "$framework\csc.exe" $argsList
if($LASTEXITCODE -ne 0){throw 'Build failed'}
Write-Output "Built $OutputDirectory\LofreeHUB.exe"
