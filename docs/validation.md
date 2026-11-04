# Validation

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
