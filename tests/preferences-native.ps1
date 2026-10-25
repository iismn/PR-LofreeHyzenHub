$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot
$testRoot=Join-Path $project '.build\preferences-check'
New-Item -ItemType Directory -Path $testRoot -Force|Out-Null
$harness=Join-Path $testRoot 'Check.cs'
Set-Content -LiteralPath $harness -Encoding UTF8 -Value @'
using System;
using System.IO;
using HyzenControl;
class Check {
 static int checks;
 static void Require(bool ok,string name){if(!ok)throw new Exception(name);checks++;}
 static void Main(string[] args){
  string path=Path.Combine(args[0],Guid.NewGuid().ToString("N")+".json");
  var prefs=new UserPreferences(path);Require(prefs.Language=="ko","Default language");
  prefs.SetLanguage("en");Require(new UserPreferences(path).Language=="en","English survives a new instance");
  prefs.SetLanguage("ko");Require(new UserPreferences(path).Language=="ko","Korean survives a new instance");
  string before=File.ReadAllText(path);bool rejected=false;
  try{prefs.SetLanguage("zh");}catch(ArgumentException){rejected=true;}
  Require(rejected&&File.ReadAllText(path)==before&&prefs.Language=="ko","Invalid language leaves file and state unchanged");
  File.WriteAllText(path,"{broken");Require(new UserPreferences(path).Language=="ko","Corrupt preference fallback");
  File.WriteAllText(path,"{\"language\":\"fr\"}");Require(new UserPreferences(path).Language=="ko","Unknown preference fallback");
  prefs.SetLanguage("en");Require(File.ReadAllText(path)=="{\"language\":\"en\"}","Only UI language is stored");
  string blocked=Path.Combine(args[0],Guid.NewGuid().ToString("N"));Directory.CreateDirectory(blocked);var invalid=new UserPreferences(blocked);rejected=false;
  try{invalid.SetLanguage("en");}catch(IOException){rejected=true;}
  Require(rejected&&invalid.Language=="ko"&&!File.Exists(blocked+".tmp"),"Failed save keeps old state and removes temporary file");
  Console.WriteLine("{\"nativePreferenceChecks\":"+checks+",\"passed\":true}");
 }
}
'@
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$executable=Join-Path $testRoot 'Check.exe'
& $compiler /nologo /codepage:65001 /target:exe /platform:x64 /reference:System.Web.Extensions.dll ("/out:"+$executable) (Join-Path $project 'source\UserPreferences.cs') $harness
if($LASTEXITCODE -ne 0){throw 'Native preferences test build failed'}
& $executable $testRoot
if($LASTEXITCODE -ne 0){throw 'Native preference checks failed'}
