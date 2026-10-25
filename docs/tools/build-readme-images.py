"""Arrange real app captures into the README preview; requires Pillow."""
import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument("capture", type=Path)
parser.add_argument("--language", choices=["ko", "en"], default="en")
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
output = root / "docs/images"
output.mkdir(parents=True, exist_ok=True)
fonts = root / "source/web"
font = lambda size: ImageFont.truetype(str(fonts / "Manrope-Regular.ttf"), size)
def source_path(name):
    if args.language == "en":
        name = {"landing.png": "en-connection.png", "keyboard.png": "en-keyboard.png", "depth-controls.png": "en-actuation.png", "light.png": "en-light.png", "home.png": "en-home.png"}.get(name, name)
    return args.capture / name

for source, name in {"landing.png": "connection.png", "keyboard.png": "key-mapping.png", "depth-controls.png": "actuation.png", "light.png": "lighting.png"}.items():
    with Image.open(source_path(source)) as image:
        image.convert("RGB").resize((1280, round(image.height * 1280 / image.width)), Image.Resampling.LANCZOS).save(output / name, optimize=True)

W, H = 1280, 800
background = Image.composite(Image.new("RGB", (W, H), "#111724"), Image.new("RGB", (W, H), "#283653"), Image.linear_gradient("L").resize((W, H)))
glow = Image.new("RGBA", (W, H))
ImageDraw.Draw(glow).ellipse((650, -290, 1500, 550), fill=(112, 97, 197, 100))
background = Image.alpha_composite(background.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(130)))
draw = ImageDraw.Draw(background)
draw.rounded_rectangle((.5, .5, W-1, H-1), radius=29, outline="#4a536d", width=1)
draw.text((64, 44), "Windows", font=font(13), fill="#adb9d4")
draw.text((62, 104), "Lofree HUB", font=font(60), fill="#f3f1ff")
for index, label in enumerate(("Actuation", "Key Mapping", "Lighting")):
    y = 290 + index * 76
    draw.text((66, y + 6), f"0{index+1}", font=font(12), fill="#a1accd")
    draw.text((108, y), label, font=font(23), fill="#e2e6f7")
    draw.line((66, y+47, 345, y+47), fill="#424b65", width=1)
draw.text((65, 706), "HYZEN67", font=font(17), fill="#c9d1e8")
draw.text((65, 738), "USB · 2.4 GHz", font=font(13), fill="#a7b3d0")
draw.rounded_rectangle((1092, 34, 1224, 70), radius=18, outline="#495273", fill="#2c3455")
draw.text((1109, 43), "Windows x64", font=font(12), fill="#d0d7ed")

def panel(filename, width, angle):
    with Image.open(source_path(filename)) as capture:
        image = capture.convert("RGBA").resize((width, round(capture.height * width / capture.width)), Image.Resampling.LANCZOS)
    mask = Image.new("L", image.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width-1, image.height-1), radius=13, fill=255)
    image.putalpha(mask)
    ImageDraw.Draw(image).rounded_rectangle((.5, .5, image.width-1, image.height-1), radius=13, outline=(209, 218, 255, 95), width=1)
    image = image.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    shadow = Image.new("RGBA", (image.width+64, image.height+64))
    shadow.paste((0, 0, 0, 150), (32, 40), image.getchannel("A"))
    shadow = shadow.filter(ImageFilter.GaussianBlur(15))
    shadow.alpha_composite(image, (32, 32))
    return shadow

rear = panel("depth-controls.png", 570, -8)
front = panel("home.png", 760, 6)
frames = []
for index in range(40):
    phase = index * math.tau / 40
    frame = background.copy()
    frame.alpha_composite(rear, (588, 60 + round(4 * math.sin(phase + .8))))
    frame.alpha_composite(front, (359, 167 + round(6 * math.sin(phase))))
    frames.append(frame.convert("RGB"))

frames[0].save(output / "hero.png", optimize=True)
palette = frames[0].quantize(colors=256, method=Image.Quantize.MEDIANCUT)
encoded = [frame.quantize(palette=palette, dither=Image.Dither.FLOYDSTEINBERG) for frame in frames]
encoded[0].save(output / "hero.gif", save_all=True, append_images=encoded[1:], duration=130, loop=0, disposal=1, optimize=True)
with Image.open(output / "hero.gif") as gif:
    total = 0
    for index in range(gif.n_frames):
        gif.seek(index)
        gif.load()
        total += gif.info["duration"]
    report = {"frames": gif.n_frames, "durationMs": total, "size": gif.size, "bytes": (output / "hero.gif").stat().st_size,
              "source": "Lofree HUB 1.2.0 read-only native app captures", "method": "Position animation of unchanged real screenshots"}
print(json.dumps(report))
for language in ["ko", "en"]:
    with Image.open(args.capture / f"{language}-general.png") as image:
        image.convert("RGB").resize((1280, round(image.height * 1280 / image.width)), Image.Resampling.LANCZOS).save(output / f"settings-{language}.png", optimize=True)
