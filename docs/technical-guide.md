# 빌드와 구성

Windows x64, .NET Framework 4.8과 PowerShell을 사용합니다. 테스트에는 Node.js가 필요합니다.

```powershell
git clone https://github.com/iismn/PR-LofreeHyzenHub.git
cd PR-LofreeHyzenHub
.\build.ps1 -OutputDirectory .\build
node --test .\tests\*.test.cjs
.\tests\preferences-native.ps1
```

결과는 `build\LofreeHUB.exe`입니다. Windows에 포함된 C# 컴파일러를 사용하며, Visual Studio를 요구하지 않습니다. WebView2 SDK 1.0.4258.31은 캐시가 없으면 NuGet에서 내려받고 SHA-256을 확인합니다. 이미 받은 SDK는 `-WebViewSdkDirectory`로 지정할 수 있습니다.

아이콘을 다시 만들려면 `build-icon.ps1`을 실행하세요. XAML 벡터에서 16~256px ICO와 미리보기 PNG를 생성합니다. 실행에는 WebView2 Runtime이 별도로 필요합니다.

`build-light.ps1`은 Windows 기본 컴파일러와 .NET Framework 4.8만 사용해 별도 `LofreeLight.exe`를 만듭니다. WebView2 SDK·Three.js·모델을 포함하지 않으며 런타임 다운로드도 없습니다. `--background`는 설정창 없이 시작하고, `--exit`는 실행 중인 동일 앱에 정상 종료를 요청합니다. 두 앱 모두 중복 실행은 기존 창을 복원합니다.

`Install-Light.ps1`은 현재 사용자의 Programs 폴더와 시작 메뉴에 설치하고 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\LofreeLight`에 따옴표로 감싼 EXE 경로와 `--background`를 등록합니다. 설정에서 자동 실행을 해제할 수 있습니다. 기본 설치는 하단 바 예약을 켜며, 전체 HUB 설치는 `-EnableLightSchedule`을 지정하면 이를 켭니다. 언어·크기는 보존합니다.

## 파일

| 경로 | 역할 |
| --- | --- |
| `source/App.cs` | WPF 창, WebView2, 메시지 검증, 종료 전 적용 처리, 앱 ID·아이콘 |
| `source/HidDevice.cs` | Windows HID 열거, 보고서 전송과 온라인·배터리 상태 조회 |
| `source/UserPreferences.cs` | UI 언어의 저장·초기 로드·오류 복구 |
| `source/LightApp.cs` | 가벼운 KO/EN 설정창, 트레이, 자동 실행, 절전 복귀 처리 |
| `source/LightScheduler.cs` | 네이티브 시간 예약, 자동 HID 연결, 밝기 30·31 바이트만 검증하여 변경 |
| `source/BackgroundSupport.cs` | 두 앱의 HID 배타적 임대, 단일 인스턴스·복원·종료 신호 |
| `source/web/lighting-schedule.js` | 현지 시간의 야간 구간·프로필별 중복 방지·오래된 예약 거부 |
| `source/web/lighting-schedule-ui.js` | 예약 입력, 로컬 저장, 밝기 큐 연결과 실패 재시도 |
| `source/web/translations.js` | KO 원문과 EN 번역·동적 문구 패턴 |
| `source/web/i18n.js` | 문구·접근성 속성 번역과 로캘 선택 |
| `source/web/protocol.js` | 프로필·매핑·조명·입력 깊이·매크로와 재읽기 확인 |
| `source/web/live-apply.js` | 병합·직렬 처리·오류 재시도 큐 |
| `source/web/auto-ui.js` | 설정 입력, 연결별 항목 표시, 연결 감지 |
| `source/web/app.js` | 페이지, 키 선택, 테스트·검증 진입점 |
| `source/web/instruments.js` | 도트와 눈금 SVG·값 변환 |
| `source/web/instrument-motion.js` | 눈금 이동과 틱 안착 |
| `source/web/block-glow.js` | 블록별 도트·눈금 발광 |
| `source/web/page-motion.js` | 메뉴 표시와 페이지 전환 |
| `source/web/keyboard3d.js` | 로컬 GLB, 키 선택, 회전·눌림, 필요할 때만 렌더링 |
| `source/web/keyboard-motion.js` | 회전 방향, 휠 줌, 기본 각도 ±30° 안착과 감쇠 스프링 |
| `source/web/keyboard-lighting.js` | 키·LED 바의 색·밝기·효과 샘플링 |
| `source/web/keyboard-post.js` | HDR 발광 추출·가우시안 블룸·투명 배경 합성 |
| `source/web/hyzen-67.glb` | 승인된 Blender 모델의 앱용 내보내기 |
| `models/` | Blender 원본, 생성·형상 검증 스크립트와 출처 |
| `source/assets/` | 벡터 아이콘과 ICO·PNG |
| `installer/Install.ps1` | 사용자 폴더 설치와 시작 메뉴 바로가기 |
| `tests/` | 하드웨어 없이 실행하는 테스트 |

## 통신과 자동 적용

장치 VID는 `388D`, PID는 USB `0024` / 수신기 `0025` / 단일 모드 `0029`입니다. 공식 자산과 통신 기준은 [REFERENCE.md](../REFERENCE.md)를 참고하세요.

연속 입력은 180ms 대기 후 전송하며, 입력이 계속되어도 약 240ms마다 가능한 최신 값을 전송합니다. 장치 응답이 늦으면 대기 중인 값을 병합합니다. 입력 당시의 프로필·레이어·선택 키·조명 영역을 복사하고, 문맥을 바꾸거나 창을 닫기 전에 큐를 처리합니다.

일반 쓰기는 장치 응답 후 같은 주소를 다시 읽어 비교합니다. 폴링레이트는 재연결한 뒤 확인합니다. 읽기 확인을 마친 입력 깊이 캐시는 해당 바이트만 갱신합니다.

## UI 검사

조명 예약 설정은 언어·크기와 함께 보존합니다. WPF `DispatcherTimer`와 `SystemEvents.PowerModeChanged`가 예약 확인을 요청합니다. X를 누르면 대기 중 변경을 처리한 뒤 트레이에 숨고, 예약은 계속 확인하며 3D 렌더링은 멈춥니다. 트레이 종료와 `--exit`는 정상 종료 경로를 사용합니다.

Lofree Light는 별도 타이머에서 15초마다 현재 구간을 확인합니다. 같은 구간에는 밝기를 반복 저장하지 않으며, 프로필은 60초마다 확인합니다. 장치 재연결·절전 복귀·설정 변경은 현재 구간을 재적용합니다. `device.lock`의 배타적 파일 핸들로 HUB와 HID 세션이 겹치지 않게 하며, 충돌 시 HUB에 양보합니다. async 스레드가 바뀌어도 임대를 해제할 수 있고, 프로세스가 비정상 종료되어도 Windows가 핸들을 회수합니다.

설정은 경로별 뮤텍스로 직렬화하고 마지막 파일을 다시 읽은 뒤 변경 필드만 병합하여 교체합니다. 한 프로그램에서 언어를 바꾸어도 다른 프로그램의 최신 예약·크기를 덮어쓰지 않습니다. 쓰기 직전에 시간 구간·활성 상태·현재 프로필을 다시 확인하고 밝기 바이트만 전송 후 재읽기로 검증합니다.

언어 선택은 `%LOCALAPPDATA%\HyzenControl\preferences.json`에 저장하고, 시작할 때 WebView2 문서 생성 전에 읽어 화면에 전달합니다. 저장 실패 시 이전 선택을 유지합니다. 장치 프로필과 UI 언어는 별도로 관리하며, 언어 변경은 HID 요청을 발생시키지 않습니다.

새 문구는 `translations.js`에 추가하세요. 동적 숫자·키·버전 값은 패턴의 자리에 그대로 넣고, 명령 바이트와 입력 값은 번역하지 않습니다. 번역은 렌더링 경계에서 수행하며 전역 DOM 변경 감시기를 사용하지 않습니다.

Node.js 검사는 번역·동적 문구·오류 안내를 포함합니다. `preferences-native.ps1`은 별도 폴더에서 저장 후 새 인스턴스 로드, 잘못된 언어·손상 파일·저장 실패를 검사합니다. `--verify`와 `--verify-min`은 검증 폴더의 별도 언어 파일을 사용해 실제 사용자 선택을 보존합니다. EN 화면, 접힌 항목, 키 팔레트, 모든 고급 키·조명 영역과 KO 복귀를 검사합니다.

```powershell
.\build\LofreeHUB.exe --verify C:\Temp\LofreeHubCheck
.\build\LofreeHUB.exe --verify-min C:\Temp\LofreeHubSmallCheck
```

실제 키보드 연결이 필요합니다. 결과 JSON·PNG를 저장한 뒤 종료하며, 장치 쓰기는 네이티브 계층에서 차단합니다. 자동 적용 이벤트는 기록용 실행기로 분리합니다. 시작 전에 다른 드라이버의 연결을 해제하세요.

`--verify-live`는 현재 라이트 바 밝기와 같은 원시 값 1바이트만 허용하는 추가 검사입니다. 다른 주소와 다른 값은 거부합니다. 실행 중 공식 드라이버와 HID 연결을 공유하지 마세요.
