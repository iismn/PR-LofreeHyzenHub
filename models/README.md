# HYZEN67 model

The app uses [source/web/hyzen-67.glb](../source/web/hyzen-67.glb). The editable Blender file is [review/Hyzen67.blend](review/Hyzen67.blend); fonts and the English Lofree marking are packed into it.

The model is an exterior reconstruction from [Lofree Japan product photographs](https://lofree.co.jp/products/hyzen-gaming-keyboard), not manufacturer CAD. Reference image URLs are recorded in [references/sources.json](references/sources.json). Downloaded reference photographs and generated renders are excluded from Git.

- 67 separately addressable keys, with the same key codes as the device configuration.
- A 16U layout at 19.05 mm pitch, calibrated to the product photograph. Backspace is 2U and Enter is 2.25U; the official web UI's clickable rectangles are not used as physical cap dimensions.
- 330.9 mm body width, 130.2 mm housing depth, 12° deck angle.
- Individual key tops are planar. The five rows form a shallow dip: the middle is 0.8 mm lower than the end rows relative to the deck.
- The main side face has a horizontally clipped lower front section. It is not a rectangular tilted slab.
- Smoked hollow PC shells, internal switch shapes, rear controls and left MAG/MEC barrel.

Generate and inspect with Blender 4.5 or newer:

```powershell
blender -b --factory-startup --python models/build_hyzen.py -- --render --quick
blender -b --factory-startup --python models/validate_model.py
blender -b --factory-startup --python models/review_rows.py
```

Generation writes only to `models/review`. After approval, copy `models/review/Hyzen67.glb` to `source/web/hyzen-67.glb` and rebuild the app. The [geometry report](review/geometry-validation.json) checks planar tops, watertight caps and housing, row heights and the actual lower-side cut.

The WebGL viewer uses the exported geometry, real-time clearcoat and smoked side walls, and a bundled studio HDRI. Roof color is mapped from the original official product photograph to preserve the dark smoked finish, moulding and legends in the reference. This is a photograph-derived color texture on 3D geometry; the viewer still rotates, reflects light and animates keys.

Each key contains its own photograph roof region, aligned to the physical cap. Backlight and front-strip previews use the current profile or the lighting controls being adjusted. The strip has a color texture and a soft Gaussian bloom projected from the actual emitter, without a separate floor stripe. Effect phase is local to the preview and is not synchronized to the keyboard's internal timer. Key-reactive previews use events delivered to this app. See [asset notices](../licenses/Model-assets.txt) and the [HDRI notice](../licenses/Studio-HDRI-CC0.txt).
