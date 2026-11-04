# Validation

## 1.3.3 return range and connection-screen size

- **51 Node tests** and **96/96 native UI checks** at both 1320×900 and 1040×720 passed. Reports: [default](validation/v1.3.3-windows.json) / [minimum](validation/v1.3.3-windows-min.json).
- Motion checks cover the new 30° boundary on both views. Native interaction returned from about 23° while preserving zoom; a rotation beyond 30° stayed until reset.
- Changing the saved settings-view size between 80% and 160% left the connection-screen scale at 160% with identical dimensions and no size selector. Its model region fit between the title and connection controls at both window sizes.
- An initial enlarged layout extended into the connection indicator area. Grid sizing was corrected before the passing final runs. Intermediate hardware reads also timed out; the final runs were performed after the user woke the keyboard.
- Native verification recorded zero physical setting writes. Device communication, Blender geometry and preference storage are unchanged from 1.3.2.

## 1.3.2 3D navigation

- **51 Node tests**, **14 native preference checks**, and **94/94 native UI checks** at both 1320×900 and 1040×720 passed. Reports: [default](validation/v1.3.2-windows.json) / [minimum](validation/v1.3.2-windows-min.json).
- Wheel input smoothly changed camera zoom and consumed page scrolling. Horizontal drag followed the hand. A small drag returned through intermediate spring positions to the exact default angle while preserving zoom; a larger drag retained its rotation until reset.
- Pure motion checks cover the 10° boundary relative to both connection and settings views, zoom bounds and line-mode wheel deltas, and spring convergence at 20/30/60/120 fps.
- The first minimum-window attempt hit one physical macro-read timeout, also preventing that page's transition check. A fresh minimum-window run passed all 94 checks. No protocol or timeout behavior was changed.
- Both passing native runs recorded zero physical setting writes. Key hit targets, lighting, idle rendering, context recovery and KO/EN layout checks remained passing. The Blender geometry and the physical validation scope below are unchanged.

## 1.3.1 lighting and graphic size

- **47 Node tests**, **14 native preference checks**, and **91/91 native UI checks** at both default and minimum sizes passed. Reports: [default](validation/v1.3.1-windows.json) / [minimum](validation/v1.3.1-windows-min.json).
- The visible model uses the HDR bloom pipeline, and shader compilation failures return to the photograph fallback. The rendered lighting was visually reviewed in native WebView2, including a low-brightness cyan fixture and the front-strip halo.
- The size toolbar changed the Lighting view's maximum width from 720 px at 100% to 864 px at 120%. All 67 projected key hit targets remained correct. Smaller windows fit the available width.
- Size persistence, old language-only preference files, invalid values, atomic updates and write failures were checked. Changing size preserved language and pending device edits and caused no HID requests.
- Native captures recorded zero physical setting writes. Lighting fixtures remain local to verification. The Blender model and the physical validation scope below are unchanged.

## 1.3.0 3D keyboard and lighting preview

- **47 Node.js tests** passed, including the 67-key GLB/device-code match, photo regions, Backspace/Enter proportions, bundled dependencies, color/brightness limits, direction and reactive-effect decay.
- **87/87 read-only native UI checks** passed at both 1320×900 and 1040×720. Reports: [default](validation/v1.3.0-windows.json) / [minimum](validation/v1.3.0-windows-min.json).
- The native checks loaded the real bundled model before manual connection, ray-tested all 67 keys on all six keyboard views, selected a key, rotated/reset the model, animated a pressed cap, and checked idle rendering and WebGL loss/recovery.
- Lighting controls were checked against the key and strip preview independently, including zero brightness. Colorful screenshots use local, read-only lighting fixtures. The native bridge blocked physical setting writes, and the reports recorded **zero verification writes**.
- Eight native preference checks passed. The minimum-window run started from the previously saved EN preference in a new process. Both runs use isolated preference and WebView2 folders.
- **11 Blender geometry checks** passed: planar and watertight caps, the 0.8 mm row dip, clipped watertight housing, wide-key dimensions and complete per-key photograph regions. See the [geometry report](../models/review/geometry-validation.json).
- A separate browser check confirmed moving LED effects animate while visible and stop when hidden. Static scenes stopped rendering after settling.
- Device protocol and HID input behavior were not changed. The physical validation scope below remains applicable. Preview effect phases are local and do not measure or synchronize hardware animation timing.

## 1.2.0 language update

- **40 pure Node.js tests** passed, including translation patterns and existing device-control tests.
- **78/78 read-only UI checks** passed in both default and minimum windows. Reports: [default](validation/v1.2.0-windows.json) / [minimum](validation/v1.2.0-windows-min.json).
- English text and accessibility labels were audited on every page, expanded section, key palette, advanced type and lighting group, including simulated USB-only controls. Layouts were checked for overflow.
- KO/EN switching preserved field values and pending device edits, with no HID requests caused by switching.
- Eight native preference-file checks passed: persistence across instances, invalid values, corrupt files and failed writes. The minimum-window run started with the previously saved EN preference in a new process.
- Language-file checks and UI runs use isolated verification folders and leave the actual user language unchanged.

## Earlier validation

- The earlier 1.1.2 pure suite passed **33 tests**, using memory devices and fixtures with no physical HID writes.
- A clean repository build was checked with the included PowerShell build script.
- Release UI capture runs in native read-only verification mode. The native bridge rejects hardware writes, while automatic-apply controls use a recording executor.
- The 1.1.2 release default-window UI run passed **68/68**. Its [JSON report](validation/v1.1.2-windows.json) is included.
- The earlier 1.1.1 default/minimum window checks passed **68/68 each**, including round indicator geometry at ruler widths 260, 360 and 500 CSS pixels. Control behavior and layout are retained in 1.1.2; 1.1.2 adds the app name, icon and Start menu identity.
- Native 1.1.2 identity was checked: process `LofreeHUB`, title `Lofree HUB`, a nonempty window icon, matching shortcut target/icon, and Start menu ID `Lofree.HUB`.

## Physical scope

Actual hardware: `HYZEN67@Lofree`, VID `388D`, PID `0025`, 2.4 GHz. Keyboard firmware V132 and receiver V401 were read.

An earlier bounded live-apply check wrote the current light-bar brightness byte unchanged and compared the entire 64-byte function block before and after. No function bytes changed. This does not validate every advanced hardware write.

Physical USB insertion/removal, polling-rate changes, calibration and firmware writes were not performed. USB/MEC visibility and switching decisions use fixtures. Calibration, firmware update and factory reset continue to open the official tool.

JSON backup contains the current profile's basic mapping and function settings. It is not a complete device backup. Input timestamps do not measure hardware latency or polling rate.
