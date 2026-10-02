#!/usr/bin/env python3
# ساخت آیکون ۱۰۲۴ و اسپلش ۲۷۳۲ برای اپ اندروید از لوگوی موجود
from PIL import Image, ImageDraw

src = Image.open("/home/z/my-project/public/icon-512.png").convert("RGBA")

# آیکون 1024x1024 (با پس‌زمینه)
icon = Image.new("RGBA", (1024, 1024), (240, 253, 244, 255))  # #f0fdf4
s = src.resize((760, 760), Image.LANCZOS)
icon.paste(s, ((1024 - 760) // 2, (1024 - 760) // 2), s)
icon.save("/home/z/my-project/assets/icon.png", "PNG")

# اسپلش 2732x2732 (اندروید)
splash = Image.new("RGBA", (2732, 2732), (240, 253, 244, 255))
d = ImageDraw.Draw(splash)
# حلقه سبز ملایم دور لوگو برای زیبایی
cx, cy = 2732 // 2, 2732 // 2
logo = src.resize((560, 560), Image.LANCZOS)
splash.paste(logo, (cx - 280, cy - 280), logo)
splash.convert("RGB").save("/home/z/my-project/assets/splash.png", "PNG")
print("assets/icon.png + assets/splash.png generated")
