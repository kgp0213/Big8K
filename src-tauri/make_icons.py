from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

icons_dir = Path(__file__).resolve().parent / "icons"
icons_dir.mkdir(parents=True, exist_ok=True)

base = Image.new("RGBA", (512, 512), (24, 24, 27, 255))
draw = ImageDraw.Draw(base)
draw.ellipse((48, 48, 464, 464), fill=(59, 130, 246, 255))

try:
    font = ImageFont.truetype("arial.ttf", 180)
except Exception:
    font = ImageFont.load_default()

text = "8K"
bbox = draw.textbbox((0, 0), text, font=font)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]
draw.text(((512 - text_w) / 2, (512 - text_h) / 2 - 10), text, fill=(255, 255, 255, 255), font=font)

for size, name in [
    ((32, 32), "32x32.png"),
    ((128, 128), "128x128.png"),
    ((256, 256), "128x128@2x.png"),
    ((512, 512), "icon.png"),
]:
    img = base.resize(size, Image.Resampling.LANCZOS)
    img.save(icons_dir / name)

base.save(icons_dir / "icon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

# 占位 icns，避免配置缺文件；真实 mac 打包时再生成也行
base.save(icons_dir / "icon.icns", format="PNG")
print("icons regenerated")
