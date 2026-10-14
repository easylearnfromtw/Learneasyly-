#!/usr/bin/env python3
"""Generate binary favicon, Apple touch, PWA and social-share images from SVG masters.

Run during GitHub Pages deployment so LINE/FB/Google receive real PNG/JPEG
responses, not SVG-only URLs or client-side rendered canvas elements.
"""
from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"


def render(source: Path, width: int, height: int) -> Image.Image:
    data = cairosvg.svg2png(
        url=str(source), output_width=width, output_height=height
    )
    return Image.open(BytesIO(data)).convert("RGBA")


def png(img: Image.Image, name: str) -> None:
    img.save(ASSETS / name, "PNG", optimize=True)


def jpg(img: Image.Image, name: str) -> None:
    rgb = Image.new("RGB", img.size, (14, 23, 36))
    rgb.paste(img, mask=img.getchannel("A"))
    rgb.save(
        ASSETS / name, "JPEG", quality=87, subsampling=0,
        optimize=True, progressive=True
    )


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    master = ROOT / "icon.svg"
    maskable = ROOT / "icon-maskable.svg"

    for size in [16, 32, 48, 96, 120, 144, 152, 167, 180, 192, 256, 384, 512]:
        image = render(master, size, size)
        png(image, f"icon-{size}.png")
    png(render(master, 180, 180), "apple-touch-icon.png")
    for size in [192, 512]:
        png(render(maskable, size, size), f"icon-maskable-{size}.png")

    # Multi-resolution .ico used by older desktop browsers and crawlers.
    ico = Image.open(ASSETS / "icon-48.png").convert("RGBA")
    ico.save(ASSETS / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

    jpg(render(ROOT / "brand/og-wide.svg", 1200, 630), "og-image.jpg")
    jpg(render(ROOT / "brand/og-square.svg", 800, 800), "social-square.jpg")

    expected = [
        "favicon.ico", "icon-16.png", "icon-32.png", "icon-48.png",
        "apple-touch-icon.png", "icon-192.png", "icon-512.png",
        "icon-maskable-192.png", "icon-maskable-512.png",
        "og-image.jpg", "social-square.jpg"
    ]
    for filename in expected:
        path = ASSETS / filename
        if not path.is_file() or path.stat().st_size < 100:
            raise RuntimeError(f"Missing or empty brand asset: {filename}")

    assert Image.open(ASSETS / "og-image.jpg").size == (1200, 630)
    assert Image.open(ASSETS / "social-square.jpg").size == (800, 800)
    assert Image.open(ASSETS / "icon-512.png").size == (512, 512)
    print(f"Generated {len(list(ASSETS.iterdir()))} branding files in {ASSETS}")


if __name__ == "__main__":
    argparse.ArgumentParser(description=__doc__).parse_args()
    main()
