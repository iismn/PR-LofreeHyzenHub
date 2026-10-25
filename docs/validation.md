# Validation

- Pure Node.js tests: **33 passed**. These use memory devices and fixtures, with no physical HID writes.
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
