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

## 파일

| 경로 | 역할 |
| --- | --- |
| `source/App.cs` | WPF 창, WebView2, 메시지 검증, 종료 전 적용 처리, 앱 ID·아이콘 |
| `source/HidDevice.cs` | Windows HID 열거와 보고서 전송 |
| `source/UserPreferences.cs` | UI 언어의 저장·초기 로드·오류 복구 |
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
| `source/assets/` | 벡터 아이콘과 ICO·PNG |
| `installer/Install.ps1` | 사용자 폴더 설치와 시작 메뉴 바로가기 |
| `tests/` | 하드웨어 없이 실행하는 테스트 |

## 통신과 자동 적용

장치 VID는 `388D`, PID는 USB `0024` / 수신기 `0025` / 단일 모드 `0029`입니다. 공식 자산과 통신 기준은 [REFERENCE.md](../REFERENCE.md)를 참고하세요.

연속 입력은 180ms 대기 후 전송하며, 입력이 계속되어도 약 240ms마다 가능한 최신 값을 전송합니다. 장치 응답이 늦으면 대기 중인 값을 병합합니다. 입력 당시의 프로필·레이어·선택 키·조명 영역을 복사하고, 문맥을 바꾸거나 창을 닫기 전에 큐를 처리합니다.

일반 쓰기는 장치 응답 후 같은 주소를 다시 읽어 비교합니다. 폴링레이트는 재연결한 뒤 확인합니다. 읽기 확인을 마친 입력 깊이 캐시는 해당 바이트만 갱신합니다.

## UI 검사

언어 선택은 `%LOCALAPPDATA%\HyzenControl\preferences.json`에 저장하고, 시작할 때 WebView2 문서 생성 전에 읽어 화면에 전달합니다. 저장 실패 시 이전 선택을 유지합니다. 장치 프로필과 UI 언어는 별도로 관리하며, 언어 변경은 HID 요청을 발생시키지 않습니다.

새 문구는 `translations.js`에 추가하세요. 동적 숫자·키·버전 값은 패턴의 자리에 그대로 넣고, 명령 바이트와 입력 값은 번역하지 않습니다. 번역은 렌더링 경계에서 수행하며 전역 DOM 변경 감시기를 사용하지 않습니다.

Node.js 검사는 번역·동적 문구·오류 안내를 포함합니다. `preferences-native.ps1`은 별도 폴더에서 저장 후 새 인스턴스 로드, 잘못된 언어·손상 파일·저장 실패를 검사합니다. `--verify`와 `--verify-min`은 검증 폴더의 별도 언어 파일을 사용해 실제 사용자 선택을 보존합니다. EN 화면, 접힌 항목, 키 팔레트, 모든 고급 키·조명 영역과 KO 복귀를 검사합니다.

```powershell
.\build\LofreeHUB.exe --verify C:\Temp\LofreeHubCheck
.\build\LofreeHUB.exe --verify-min C:\Temp\LofreeHubSmallCheck
```

실제 키보드 연결이 필요합니다. 결과 JSON·PNG를 저장한 뒤 종료하며, 장치 쓰기는 네이티브 계층에서 차단합니다. 자동 적용 이벤트는 기록용 실행기로 분리합니다. 시작 전에 다른 드라이버의 연결을 해제하세요.

`--verify-live`는 현재 라이트 바 밝기와 같은 원시 값 1바이트만 허용하는 추가 검사입니다. 다른 주소와 다른 값은 거부합니다. 실행 중 공식 드라이버와 HID 연결을 공유하지 마세요.
