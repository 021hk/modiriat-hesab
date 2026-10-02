#!/usr/bin/env python3
"""Convert all oklch() colors in globals.css to hex (old Android browser compatibility)."""
import re, math, sys

SRC = "/home/z/my-project/src/app/globals.css"

def oklch_to_hex(L, C, H):
    # oklch -> oklab
    hr = math.radians(H)
    a = C * math.cos(hr)
    b = C * math.sin(hr)
    # oklab -> lms' (cube root domain)
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_**3, m_**3, s_**3
    # lms -> linear sRGB
    r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    def gamma(c):
        c = max(0.0, min(1.0, c))
        return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
    r, g, bl = gamma(r), gamma(g), gamma(bl)
    return "#{:02x}{:02x}{:02x}".format(round(r * 255), round(g * 255), round(bl * 255))

PAT = re.compile(r"oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)")

with open(SRC) as f:
    css = f.read()

def repl(m):
    return oklch_to_hex(float(m.group(1)), float(m.group(2)), float(m.group(3)))

out = PAT.sub(repl, css)
n = len(PAT.findall(css))
with open(SRC, "w") as f:
    f.write(out)
print(f"converted {n} oklch() colors to hex")
if "--oklch-left" in sys.argv:
    print("remaining oklch:", len(PAT.findall(out)))
