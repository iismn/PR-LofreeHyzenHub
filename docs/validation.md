# Validation

## 1.5.0 tray and lightweight front-bar scheduling

- **67 Node tests**, **36 native lighting checks**, and **23 native preference checks** passed. Cases cover midnight/year boundaries, startup catch-up, manual overrides, disconnection, sleeping devices, HID ownership, stale profile/time/config jobs, failed verification, single-flight timers and cross-instance preference merging.
- **107/107 read-only native HUB UI checks** passed at both 1320×900 and 1040×720. The actual close handler hid the window, the clock continued, 3D rendering paused, and restore succeeded. Reports: [default](validation/v1.5.0-windows.json) / [minimum](validation/v1.5.0-windows-min.json).
- **13/13 native Lofree Light UI checks** passed: field alignment, KO/EN persistence, edited times/brightness, front-only targets, closing without exit, restoration, and no browser/WPF assemblies loaded. [Report](validation/v1.5.0-light-ui.json). Its settings UI was inspected at 150% Windows DPI.
- Device writes are limited to the current profile's key-brightness byte 30 (zero) and front-bar brightness byte 31 (night level or zero); colors, effects, receiver settings, sleep and mappings are preserved. Tests exercise failed transfers and reject stale writes before sending.
- The installed lighting app starts with `--background`, with no settings window, and its exact sign-in command was read back from HKCU Run. Existing KO language and 160% graphic scale were preserved. Duplicate launch exited, a tray-resident update exited gracefully, closing the installed HUB hid it to the tray, and explicit HUB exit left Light running. [Installation/lifecycle report](validation/v1.5.0-background.json).
- Read-only before/after probes of the connected HYZEN67 found profile 0, key brightness **0** and front-bar brightness **50**; all 64 function bytes were unchanged because the requested night state was already set. [Hardware report](validation/v1.5.0-light-hardware.json).
- Reboot, a full overnight run, and physical system sleep/resume were not performed. Registration and the exact `--background` launch path are checked separately during installation; time boundaries and catch-up are simulated.

## 1.4.0 scheduled night lighting

- **66 Node tests**, **19 native preference checks**, and **106/106 native UI checks** at both 1320×900 and 1040×720 passed. Reports: [default](validation/v1.4.0-windows.json) / [minimum](validation/v1.4.0-windows-min.json).
- Pure tests cover exact on/off boundaries, overnight and same-day intervals, local date changes, reconnect/profile changes, duplicate suppression, manual overrides, stale jobs, failed application and closing without losing pending manual edits. In-memory protocol checks changed only the selected profile's brightness bytes and preserved all other bytes.
- Native preference checks cover restart persistence, old files, invalid settings, atomic failure behavior and preservation across language/size changes.
- Native UI checks saved schedule values, recorded night-on/day-off jobs using the read-only executor, updated the 3D lighting and brightness control, and preserved colors/effects. The host timer executed its JavaScript check while the native window was minimized.
- All native verification runs recorded zero physical setting writes. Clock boundaries were simulated; actual overnight operation and a physical system suspend/resume cycle were not performed. The feature is disabled by default and requires HUB to remain running and connected.

## 1.3.5 live 3D continuity

- **57 Node tests** and **101/101 native UI checks** at both 1320×900 and 1040×720 passed. Reports: [default](validation/v1.3.5-windows.json) / [minimum](validation/v1.3.5-windows-min.json).
- Native checks require a live connection handoff with intermediate canvas rectangles and camera poses, then the same canvas mounted in the keyboard overview. The transition does not call the View Transition snapshot API.
- Every 3D tab retained the same viewport position, width, height and camera zoom. Frame sampling found no photograph flash, loading-state reset or faded canvas during tab changes. Controls and the sidebar continued to animate.
- A separate browser test used actual pointer drag and wheel events, preserving a nondefault rotation and zoom through all six tabs. It observed one canvas, one model load and zero photograph flashes. See the [browser report](validation/v1.3.5-browser.json).
- Existing key hit targets, lighting, battery, context loss/recovery and KO/EN checks remained passing. Native verification recorded zero physical setting writes. Blender geometry, HID communication and local preference storage are unchanged.

## 1.3.4 battery overview

- **56 Node tests** and **99/99 native UI checks** at both 1320×900 and 1040×720 passed. Reports: [default](validation/v1.3.4-windows.json) / [minimum](validation/v1.3.4-windows-min.json).
- The connected HYZEN67 receiver returned **23%** through the official empty-payload online and battery queries. The current profile's complete 64-byte function block matched before and after the queries; no setting writes were made. See the [read-only battery report](validation/v1.3.4-battery.json).
- Native fixtures checked 0%, 23% and 100%, the dot halo, unavailable readings and English USB-power text. Updating the card preserved the existing 3D canvas and did not issue HID requests.
- Pure tests cover invalid replies, failed queries, USB behavior, replies from a previous connection, the minimum 30-second refresh interval, and suppression before manual connection, off-screen or during editing.
- Native verification recorded zero physical setting writes. Existing sleep controls remain in General; the change replaces only the overview card. USB battery percentages and charging state are not fabricated.

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
