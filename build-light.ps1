param([string]$OutputDirectory)
$ErrorActionPreference='Stop'
$project=$PSScriptRoot
if(-not $OutputDirectory){$OutputDirectory=Join-Path $project 'build'}
New-Item -ItemType Directory -Path $OutputDirectory -Force|Out-Null
$destination=[IO.Path]::GetFullPath($OutputDirectory)
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$arguments=@('/nologo','/target:winexe','/platform:x64','/optimize+','/codepage:65001',"/out:$destination\LofreeLight.exe","/win32manifest:$project\source\app.manifest","/win32icon:$project\source\assets\LofreeHUB.ico","/resource:$project\source\assets\LofreeHUB.ico,Hyzen.AppIcon.ico",'/reference:System.dll','/reference:System.Core.dll','/reference:System.Drawing.dll','/reference:System.Windows.Forms.dll','/reference:System.Web.Extensions.dll')
$arguments+=@('LightApp.cs','HidDevice.cs','UserPreferences.cs','BackgroundSupport.cs','LightScheduler.cs')|ForEach-Object {Join-Path $project ('source\'+$_)}
& $compiler $arguments
if($LASTEXITCODE -ne 0){throw 'Lofree Light build failed'}
Write-Output "Built $destination\LofreeLight.exe"
