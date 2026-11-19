#!/usr/bin/env python3
"""Soft mesh-gradient orb avatars on matching pale tinted backgrounds.
Adapted from the user-provided Grok generate.py; retains seeded OKLab fields and density.

Usage:
  python3 generate.py             # write 50 avatars + contact sheets
  python3 generate.py --count 50 --seed-start 1 --outdir /path
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


def srgb_to_linear(c: np.ndarray) -> np.ndarray:
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c: np.ndarray) -> np.ndarray:
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def _cbrt(x: np.ndarray) -> np.ndarray:
    return np.sign(x) * np.power(np.abs(x), 1.0 / 3.0)


def linear_to_oklab(rgb_lin: np.ndarray) -> np.ndarray:
    """Linear sRGB → OKLab. rgb_lin shape (..., 3)."""
    r = rgb_lin[..., 0]
    g = rgb_lin[..., 1]
    b = rgb_lin[..., 2]
    l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l = _cbrt(l_)
    m = _cbrt(m_)
    s = _cbrt(s_)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    b2 = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return np.stack([L, a, b2], axis=-1)


def oklab_to_linear(lab: np.ndarray) -> np.ndarray:
    """OKLab → linear sRGB. lab shape (..., 3)."""
    L = lab[..., 0]
    a = lab[..., 1]
    b = lab[..., 2]
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l = l_ * l_ * l_
    m = m_ * m_ * m_
    s = s_ * s_ * s_
    r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    b2 = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return np.stack([r, g, b2], axis=-1)


def srgb_to_oklab(rgb: np.ndarray) -> np.ndarray:
    return linear_to_oklab(srgb_to_linear(np.asarray(rgb, dtype=np.float64)))


def oklab_to_srgb(lab: np.ndarray) -> np.ndarray:
    return np.clip(linear_to_srgb(oklab_to_linear(lab)), 0.0, 1.0)



def hsv_to_rgb(h, s, v) -> np.ndarray:
    h = np.asarray(h, dtype=np.float64)
    s = np.asarray(s, dtype=np.float64)
    v = np.asarray(v, dtype=np.float64)
    i = np.floor(h * 6.0).astype(int)
    f = h * 6.0 - i
    p = v * (1.0 - s)
    q = v * (1.0 - f * s)
    t = v * (1.0 - (1.0 - f) * s)
    i = i % 6
    r = np.choose(i, [v, q, p, p, t, v])
    g = np.choose(i, [t, v, v, q, p, p])
    b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], axis=-1)


def rgb_to_hsv(rgb: np.ndarray):
    """Vectorized RGB→HSV. rgb shape (..., 3) in [0,1]. Returns H,S,V arrays."""
    r = rgb[..., 0]
    g = rgb[..., 1]
    b = rgb[..., 2]
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    v = maxc
    d = maxc - minc
    s = np.where(maxc > 1e-8, d / np.maximum(maxc, 1e-8), 0.0)
    h = np.zeros_like(maxc)
    mask = d > 1e-8
    rc = (maxc - r) / np.maximum(d, 1e-8)
    gc = (maxc - g) / np.maximum(d, 1e-8)
    bc = (maxc - b) / np.maximum(d, 1e-8)
    h = np.where((maxc == r) & mask, ((bc - gc) / 6.0) % 1.0, h)
    h = np.where((maxc == g) & mask, ((2.0 + rc - bc) / 6.0) % 1.0, h)
    h = np.where((maxc == b) & mask, ((4.0 + gc - rc) / 6.0) % 1.0, h)
    return h, s, v


# Hard floor: every pigment and every non-background pixel HSV Value >= 0.95
MIN_V = 0.95
# 0.95*255 = 242.25; clamp to 243/255 so uint8 round-trip stays >= 0.95
SAFE_MIN_V = 243 / 255.0


def clamp_min_value(img: np.ndarray, min_v: float = SAFE_MIN_V) -> np.ndarray:
    """Raise Value of pigmented pixels below min_v by uniform RGB scale.

    Skip near-background pixels so the cool-white field is untouched.
    Prefer lift_oklab_L before this so almost nothing hits the hard floor —
    a large V=floor plateau reads as a horizontal/vertical ridge.
    """
    v = np.maximum(np.maximum(img[..., 0], img[..., 1]), img[..., 2])
    bg = np.array([245 / 255.0, 1.0, 1.0], dtype=np.float64)
    pigmented = np.linalg.norm(img - bg, axis=-1) > 0.035
    too_dark = pigmented & (v < min_v)
    if not np.any(too_dark):
        return img
    target = min_v / np.maximum(v, 1e-8)
    t = np.clip((min_v - v) / 0.06, 0.0, 1.0)
    t = t * t * (3.0 - 2.0 * t)
    factor = np.where(too_dark, 1.0 + (target - 1.0) * t, 1.0)
    out = np.clip(img * factor[..., None], 0.0, 1.0)
    v2 = np.maximum(np.maximum(out[..., 0], out[..., 1]), out[..., 2])
    still = pigmented & (v2 < min_v)
    if np.any(still):
        out = np.where(still[..., None], out * (min_v / np.maximum(v2, 1e-8))[..., None], out)
        out = np.clip(out, 0.0, 1.0)
    return out


def lift_oklab_L(lab: np.ndarray, L_floor: float = 0.74) -> np.ndarray:
    """Soft-raise OKLab L so mixed colors stay high-key without a V-floor plateau.

    Saturated blues have low perceptual L even at HSV V≈1; OKLab mixes then
    drop below SAFE_MIN_V and the RGB clamp flattens them into a visible ridge.
    """
    out = lab.copy()
    L = out[..., 0]
    t = np.clip((L_floor - L) / 0.18, 0.0, 1.0)
    t = t * t * (3.0 - 2.0 * t)
    out[..., 0] = L + (L_floor - L) * t
    return out


def render_orb(seed: int, size: int = 640, match_reference: bool = False) -> Image.Image:
    """Render one soft, slightly irregular gradient orb on a very pale background matched to its pigment hue.

    Three pigment centers (light / mid / deep) form a normalized soft mesh
    (barycentric Gaussians mixed in OKLab) so hues dissolve across a broad
    region — mint / cyan / blue in the reference — while ink density still
    thins on the lit limb and densifies on the far edge with a short
    airbrushed rim. All pigments stay high-key (HSV Value >= 0.95).
    """
    rng = np.random.default_rng(10_000 + seed)

    light_rgb = mid_rgb = deep_rgb = None
    if match_reference:
        # High-key mint / cyan / blue: same hues as the reference, all V >= 0.95.
        # (Original dark cobalt ~V 0.67 is intentionally lifted — no muddy deep mass.)
        # Lower S on deep blue so OKLab L stays high (S≈0.86 → L≈0.49 → V-floor ridge).
        light_rgb = hsv_to_rgb(0.38, 0.72, 1.00)    # mint (greener, matches ref top ~0.42)
        mid_rgb = hsv_to_rgb(0.51, 0.78, 0.995)     # cyan
        deep_rgb = hsv_to_rgb(0.66, 0.62, 0.99)     # cobalt; S capped for OKLab L
        light_ang = np.deg2rad(225)  # lit from upper-left; dark mass lower-right
        aspect = 0.98
        rot = np.deg2rad(12)
        radius = 0.86
        cx, cy = 0.02, 0.05
        bump_amp = (0.03, 0.018, 0.01)
        bump_ph = (np.deg2rad(50), np.deg2rad(210), np.deg2rad(90))
        contrast = 0.55  # enough shade for deep pigment to fill the tight rim
        core = 0.96
        # (u, v) in light-aligned frame: u toward lit, v = CCW perp.
        # Tuned so at 225° → mint top, cyan left, cobalt lower-right.
        # Keep mint slightly off the thinnest lit limb so it survives white composite.
        # Accent-on-wash: huge cyan mid field + smaller mint/blue accents.
        # Equal-sigma triangles make a flat mid-plane iso-contour (the "ridge").
        tmpl_light = (0.32, 0.28)   # UL mint accent
        tmpl_mid = (0.00, -0.08)    # cyan wash near center
        tmpl_deep = (-0.40, 0.22)   # LR blue accent
        sig_l, sig_m, sig_d = 0.36, 0.78, 0.40
        mid_boost = 1.15
        light_boost = 1.35
        deep_boost = 1.40
        blend_gamma = 1.0
        color_blur_radius = 8.0
        weight_blur_radius = 11.0
        weight_wash = 0.08
        weight_noise = 0.05
    else:
        # Analogous three-hue families only (like the reference mint→cyan→blue).
        # Never pair warm (red/orange/peach) with lime/green — that arc crosses
        # high-chroma yellow and reads as a crescent seam even with soft weights.
        def _hue_dist(a, b):
            d = abs(float(a) - float(b)) % 1.0
            return min(d, 1.0 - d)

        def _arc_crosses_yellow(h0, h1):
            """True if shortest arc from h0→h1 passes through hue ~0.12–0.20."""
            # Walk shortest direction in steps; flag yellow band.
            d = (float(h1) - float(h0)) % 1.0
            if d > 0.5:
                d -= 1.0
            steps = max(8, int(abs(d) * 64))
            for i in range(steps + 1):
                h = (float(h0) + d * (i / steps)) % 1.0
                if 0.08 <= h <= 0.25:
                    return True
            return False

        def _is_warm(h):
            return (h < 0.08) or (h > 0.92) or (0.0 <= h <= 0.08)

        def _is_limey(h):
            return 0.22 <= h <= 0.45

        # Pick base + span; reject warm↔lime / yellow-crossing arcs.
        base_h = (seed * 0.6180339887498949 + 0.04 * rng.random()) % 1.0
        for _try in range(24):
            span = rng.uniform(0.22, 0.32)  # ~80–115° neighboring family
            # Keep order light ← mid → deep along the arc (no wrap through yellow).
            mid_h = base_h
            light_h = (base_h - 0.38 * span) % 1.0
            deep_h = (base_h + 0.62 * span) % 1.0
            bad = (
                _arc_crosses_yellow(light_h, mid_h)
                or _arc_crosses_yellow(mid_h, deep_h)
                or _arc_crosses_yellow(light_h, deep_h)
                or (_is_warm(light_h) and _is_limey(deep_h))
                or (_is_warm(mid_h) and _is_limey(deep_h))
                or (_is_warm(light_h) and _is_limey(mid_h))
            )
            if not bad:
                break
            # Rotate family away from the yellow danger zone.
            base_h = (base_h + 0.17 + 0.03 * rng.random()) % 1.0
        else:
            # Deterministic safe fallback: mint–cyan–blue family.
            mid_h, light_h, deep_h = 0.52, 0.42, 0.64
            span = 0.22

        # Keep S moderate: high-S blues/violets have low OKLab L and force V-floor.
        light_s = rng.uniform(0.48, 0.70)
        mid_s = rng.uniform(0.52, 0.74)
        deep_s = rng.uniform(0.42, 0.62)
        light_v = rng.uniform(0.99, 1.00)
        mid_v = rng.uniform(0.985, 1.00)
        deep_v = rng.uniform(0.98, 1.00)

        light_rgb = hsv_to_rgb(light_h, light_s, light_v)
        mid_rgb = hsv_to_rgb(mid_h, mid_s, mid_v)
        deep_rgb = hsv_to_rgb(deep_h, deep_s, deep_v)
        light_ang = rng.uniform(0, 2 * np.pi)
        aspect = rng.uniform(0.94, 1.06)
        rot = rng.uniform(-0.30, 0.30)
        radius = rng.uniform(0.64, 0.72)
        cx = rng.uniform(-0.04, 0.04)
        cy = rng.uniform(-0.04, 0.04)
        bump_amp = tuple(float(rng.uniform(-0.028, 0.028)) for _ in range(3))
        bump_ph = tuple(float(rng.uniform(0, 2 * np.pi)) for _ in range(3))
        contrast = rng.uniform(0.48, 0.70)
        core = rng.uniform(0.90, 0.97)
        # Separated triangular layout so each pigment owns a broad region.
        tmpl_light = (
            0.14 + float(rng.uniform(-0.05, 0.05)),
            0.46 + float(rng.uniform(-0.05, 0.05)),
        )
        tmpl_mid = (
            0.10 + float(rng.uniform(-0.05, 0.05)),
            -0.40 + float(rng.uniform(-0.05, 0.05)),
        )
        # Keep deep inside the dense body (not on the thin rim) so lime survives white composite.
        tmpl_deep = (
            -0.42 + float(rng.uniform(-0.05, 0.05)),
            0.08 + float(rng.uniform(-0.05, 0.05)),
        )
        # Unequal sigmas: one wide wash + two accents — avoids flat mid-plane ridges.
        wash = float(rng.uniform(0.62, 0.82))
        accent = float(rng.uniform(0.32, 0.44))
        # Randomly assign which pigment is the wash (usually mid).
        role = int(rng.integers(0, 3))
        sigs = [accent, accent, accent]
        sigs[role] = wash
        sig_l, sig_m, sig_d = (float(s) for s in sigs)
        mid_boost = float(rng.uniform(0.95, 1.15))
        light_boost = float(rng.uniform(1.05, 1.35))
        deep_boost = float(rng.uniform(1.05, 1.40))
        blend_gamma = 1.05
        color_blur_radius = 5.0
        weight_blur_radius = 9.0
        weight_wash = 0.08
        weight_noise = 0.04


    yy, xx = np.mgrid[-1 : 1 : size * 1j, -1 : 1 : size * 1j]
    x = xx - cx
    y = yy - cy
    ca, sa = np.cos(rot), np.sin(rot)
    xr = ca * x + sa * y
    yr = -sa * x + ca * y
    rx = radius * np.sqrt(aspect)
    ry = radius / np.sqrt(aspect)

    theta = np.arctan2(yr, xr)
    r_mod = (
        1.0
        + bump_amp[0] * np.cos(2 * theta + bump_ph[0])
        + bump_amp[1] * np.cos(3 * theta + bump_ph[1])
        + bump_amp[2] * np.cos(5 * theta + bump_ph[2])
    )
    r = np.sqrt((xr / rx) ** 2 + (yr / ry) ** 2) / np.clip(r_mod, 0.82, 1.18)

    lx, ly = np.cos(light_ang), np.sin(light_ang)
    # +1 on the lit side, -1 on the dark side, in a soft range across the body.
    shade = np.clip((xr * lx + yr * ly) / radius, -1.3, 1.3) / 1.3

    def smoothstep(t):
        t = np.clip(t, 0.0, 1.0)
        return t * t * (3.0 - 2.0 * t)

    # Anisotropic opacity falloff (the reference silhouette):
    # deep/unlit limb → tight rim (~0.08–0.14 of radius); lit limb → wide soft
    # feather. Vary continuously with shade (cosine of angle from light) — no
    # quadrant switches that put a corner in the outline.
    # Fade width carries most of the anisotropy; inner inset on the lit limb is
    # moderate (diagonal light → avoids a horizontal density "cap" shelf).
    t = 0.5 * (1.0 + np.clip(shade, -1.0, 1.0))  # 0 = deep/unlit, 1 = lit
    t = t * t * (3.0 - 2.0 * t)  # smoothstep — gentler mid-arc transition
    fade_dark = 0.08  # tight circular rim on the deep pigment side
    fade_lit = 0.78   # fluffy feather on the highlight side
    fade_width = fade_dark + (fade_lit - fade_dark) * t
    # Deep core reaches near the rim; lit core pulls in so the soft limb
    # dissolves earlier (matches reference lit r70 << deep r70).
    inner = 0.88 - 0.32 * t
    outer = inner + fade_width
    mask = 1.0 - smoothstep((r - inner) / np.maximum(outer - inner, 1e-6))

    # Translucent volume: thin ink on the lit limb, dense against the far rim so
    # deep pigment fills up to the tighter edge. Shallow linear shade only —
    # steep smoothstep(0.5-0.5*shade) had max slope at mid and read as a ridge.
    ink = 0.50 + contrast * 0.70 * (0.5 - 0.5 * shade)
    density = np.clip(mask * ink * core, 0.0, 0.98)

    # --- Three spatial color centers (mesh / soft barycentric) ---
    # Place centers in orb-centered image coords, oriented by light angle.
    # u = lit direction, v = CCW perpendicular.
    def uv_to_xy(u, v):
        return (u * lx + v * (-ly), u * ly + v * lx)

    plx, ply = uv_to_xy(*tmpl_light)
    pmx, pmy = uv_to_xy(*tmpl_mid)
    pdx, pdy = uv_to_xy(*tmpl_deep)

    # Soft mesh / barycentric blend: wide low-contrast Gaussians + light blur,
    # mild gamma so three masses read without iso-contour creases.
    def soft_blob(px, py, sigma):
        d2 = (x - px) ** 2 + (y - py) ** 2
        return np.exp(-d2 / (2.0 * sigma ** 2))

    def blur_weight(w, radius=8.0):
        peak = float(np.max(w)) + 1e-8
        u8 = (np.clip(w / peak, 0.0, 1.0) * 255.0).round().astype(np.uint8)
        soft = np.asarray(
            Image.fromarray(u8, "L").filter(ImageFilter.GaussianBlur(radius=radius)),
            dtype=np.float64,
        ) / 255.0
        return soft * peak

    # No hard weight clips — flat cores caused yellow/light crescent seams.
    w_l = blur_weight(soft_blob(plx, ply, sig_l) * light_boost, radius=weight_blur_radius)
    w_m = blur_weight(soft_blob(pmx, pmy, sig_m) * mid_boost, radius=weight_blur_radius)
    w_d = blur_weight(soft_blob(pdx, pdy, sig_d) * deep_boost, radius=weight_blur_radius)
    w_sum = w_l + w_m + w_d + 1e-8
    w_l = w_l / w_sum
    w_m = w_m / w_sum
    w_d = w_d / w_sum
    # Break straight iso-contours: wash toward equal thirds + soft spatial noise.
    wash = float(weight_wash)
    w_l = (1.0 - wash) * w_l + wash / 3.0
    w_m = (1.0 - wash) * w_m + wash / 3.0
    w_d = (1.0 - wash) * w_d + wash / 3.0
    if weight_noise > 0:
        n = rng.normal(0.0, weight_noise, w_l.shape)
        # blur noise so it doesn't speck; reuse blur_weight path via PIL
        n_u8 = ((np.clip(n / (4.0 * weight_noise) + 0.5, 0, 1)) * 255).astype(np.uint8)
        n_soft = (
            np.asarray(
                Image.fromarray(n_u8, "L").filter(ImageFilter.GaussianBlur(radius=6.0)),
                dtype=np.float64,
            )
            / 255.0
            - 0.5
        ) * (4.0 * weight_noise)
        w_l = np.clip(w_l + n_soft, 1e-4, None)
        w_m = np.clip(w_m - 0.5 * n_soft, 1e-4, None)
        w_d = np.clip(w_d + 0.35 * n_soft, 1e-4, None)
        w_sum = w_l + w_m + w_d + 1e-8
        w_l, w_m, w_d = w_l / w_sum, w_m / w_sum, w_d / w_sum
    gamma = blend_gamma
    w_l = np.power(np.clip(w_l, 0.0, 1.0), gamma)
    w_m = np.power(np.clip(w_m, 0.0, 1.0), gamma)
    w_d = np.power(np.clip(w_d, 0.0, 1.0), gamma)
    w_sum = w_l + w_m + w_d + 1e-8
    w_l = w_l / w_sum
    w_m = w_m / w_sum
    w_d = w_d / w_sum

    # Mix in OKLab (smooth for analogous families). No chroma-ridge postprocess.
    lab = (
        w_l[..., None] * srgb_to_oklab(light_rgb)
        + w_m[..., None] * srgb_to_oklab(mid_rgb)
        + w_d[..., None] * srgb_to_oklab(deep_rgb)
    )
    # Soft L lift BEFORE sRGB — kills V-floor plateau that read as a ridge.
    lab = lift_oklab_L(lab, L_floor=0.78)
    color = oklab_to_srgb(lab)
    color = clamp_min_value(color, SAFE_MIN_V)
    # Mild color-field blur — kill residual junctions without monochrome mush.
    color_u8 = (np.clip(color, 0.0, 1.0) * 255.0).round().astype(np.uint8)
    color = (
        np.asarray(
            Image.fromarray(color_u8, "RGB").filter(ImageFilter.GaussianBlur(radius=color_blur_radius)),
            dtype=np.float64,
        )
        / 255.0
    )
    # Extra vertical smear on match_reference: kills residual horizontal iso-contour bands
    # (horizontal ridges = strong ∂/∂y). Mild — preserves readable masses.
    if match_reference:
        cu8 = (np.clip(color, 0.0, 1.0) * 255.0).round().astype(np.uint8)
        # Approximate anisotropic blur: blur, then blend with a stronger vertical-only pass.
        vert = np.asarray(
            Image.fromarray(cu8, "RGB").filter(ImageFilter.GaussianBlur(radius=color_blur_radius * 1.6)),
            dtype=np.float64,
        ) / 255.0
        # Prefer vertical neighbors: average with a shifted copy.
        shift = 6
        vert2 = vert.copy()
        vert2[shift:] = (vert2[shift:] + vert[:-shift]) * 0.5
        vert2[:-shift] = (vert2[:-shift] + vert[shift:]) * 0.5
        color = 0.40 * color + 0.60 * vert2
    color = clamp_min_value(color, SAFE_MIN_V)

    # Derive the background hue from the visible pigment, weighted by ink density.
    # High OKLab lightness and low chroma keep the colored field very pale.
    dominant = (lab * density[..., None]).sum(axis=(0, 1)) / density.sum()
    chroma = max(float(np.hypot(dominant[1], dominant[2])), 1e-8)
    background_lab = np.array([0.975, dominant[1] / chroma * 0.016,
                               dominant[2] / chroma * 0.016])
    background = oklab_to_srgb(background_lab)
    grain = rng.normal(0, 0.55 / 255.0, (size, size, 1))
    pigment = clamp_min_value(np.clip(color + grain, 0, 1), SAFE_MIN_V)
    img = background * (1 - density[..., None]) + pigment * density[..., None]
    return Image.fromarray((np.clip(img, 0, 1) * 255).round().astype(np.uint8), "RGB")


def make_sheet(
    images: list[Image.Image],
    labels: list[str] | None = None,
    cell: int = 200,
    cols: int = 10,
    title: str = "Soft gradient orbs  ·  50 seeds",
) -> Image.Image:
    n = len(images)
    rows = (n + cols - 1) // cols
    pad_x, pad_top, pad_bot = 48, 96, 40
    gap = 12
    label_h = 28 if labels else 0
    w = pad_x * 2 + cols * cell + (cols - 1) * gap
    h = pad_top + rows * (cell + label_h) + (rows - 1) * gap + pad_bot
    bg = (247, 246, 243)
    canvas = Image.new("RGB", (w, h), bg)
    draw = ImageDraw.Draw(canvas)
    try:
        font_title = ImageFont.truetype(
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf", 32, index=0
        )
        font_sub = ImageFont.truetype(
            "/System/Library/Fonts/Supplemental/Arial.ttf", 18, index=0
        )
        font_lab = ImageFont.truetype(
            "/System/Library/Fonts/Supplemental/Arial.ttf", 14, index=0
        )
    except OSError:
        font_title = font_sub = font_lab = ImageFont.load_default()
    draw.text((pad_x, 28), title, font=font_title, fill=(28, 28, 28))
    draw.text(
        (pad_x, 68),
        "OKLab pigment fields / matching pale backgrounds / seeded variations",
        font=font_sub,
        fill=(110, 110, 110),
    )
    for i, im in enumerate(images):
        r, c = divmod(i, cols)
        x = pad_x + c * (cell + gap)
        y = pad_top + r * (cell + label_h + gap)
        tile = ImageOps.contain(im, (cell, cell), Image.Resampling.LANCZOS)
        ox = x + (cell - tile.width) // 2
        oy = y + (cell - tile.height) // 2
        canvas.paste(tile, (ox, oy), tile if tile.mode == "RGBA" else None)
        if labels:
            text = labels[i]
            bbox = draw.textbbox((0, 0), text, font=font_lab)
            tw = bbox[2] - bbox[0]
            draw.text(
                (x + (cell - tw) / 2, y + cell + 4),
                text,
                font=font_lab,
                fill=(120, 120, 120),
            )
    return canvas


def make_size_test(images: list[Image.Image], sizes=(96, 48, 32, 24)) -> Image.Image:
    """Show the same first 12 orbs at typical avatar sizes."""
    sample = images[:12]
    pad, gap, label_w, title_h = 48, 16, 80, 80
    cols = len(sample)
    rows = len(sizes)
    max_s = max(sizes)
    w = pad * 2 + label_w + cols * max_s + (cols - 1) * gap
    h = title_h + pad + rows * max_s + (rows - 1) * 28
    canvas = Image.new("RGB", (w, h), (247, 246, 243))
    draw = ImageDraw.Draw(canvas)
    font_title = ImageFont.truetype(
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf", 28, index=0
    )
    font_lab = ImageFont.truetype(
        "/System/Library/Fonts/Supplemental/Arial.ttf", 16, index=0
    )
    draw.text((pad, 24), "Avatar size comparison", font=font_title, fill=(28, 28, 28))
    y = title_h
    for s in sizes:
        draw.text((pad, y + s / 2 - 8), f"{s}px", font=font_lab, fill=(110, 110, 110))
        for i, im in enumerate(sample):
            tile = im.resize((s, s), Image.Resampling.LANCZOS)
            x = pad + label_w + i * (max_s + gap) + (max_s - s) // 2
            yy = y + (max_s - s) // 2
            canvas.paste(tile, (x, yy), tile if tile.mode == "RGBA" else None)
        y += max_s + 28
    return canvas


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--count", type=int, default=50)
    p.add_argument("--seed-start", type=int, default=1)
    p.add_argument("--size", type=int, default=640)
    p.add_argument("--outdir", type=Path, default=Path("assets/subagent-soft-gradient-tinted"))
    p.add_argument("--test-only", action="store_true")
    args = p.parse_args()

    outdir: Path = args.outdir
    (outdir / "avatars").mkdir(parents=True, exist_ok=True)
    (outdir / "tests").mkdir(parents=True, exist_ok=True)

    # Style anchor next to the real reference, for visual QA.
    ref_path = Path("/workspace/subagent-avatar-inspo/pins/02-mesh-cyan-blue-soft-orb.jpg")
    anchor = render_orb(0, size=args.size, match_reference=True)
    anchor.save(outdir / "tests" / "reference-recreation.png")
    if ref_path.exists():
        ref = Image.open(ref_path).convert("RGB")
        # Square-crop the reference around the orb for a fair side-by-side.
        w, h = ref.size
        side = min(w, h)
        ref_sq = ref.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
        ref_sq = ref_sq.resize((args.size, args.size), Image.Resampling.LANCZOS)
        compare = Image.new("RGB", (args.size * 2 + 72, args.size + 80), (250, 250, 248))
        compare.paste(ref_sq, (24, 56))
        compare.paste(anchor, (24 + args.size + 24, 56))
        d = ImageDraw.Draw(compare)
        font = ImageFont.truetype(
            "/System/Library/Fonts/Supplemental/Arial.ttf", 20, index=0
        )
        d.text((24, 20), "参考原图", font=font, fill=(80, 80, 80))
        d.text((24 + args.size + 24, 20), "语法复现", font=font, fill=(80, 80, 80))
        compare.save(outdir / "tests" / "reference-compare.jpg", quality=92)

    if args.test_only:
        # A few palette previews for iteration.
        previews = [anchor] + [
            render_orb(s, size=args.size) for s in range(args.seed_start, args.seed_start + 7)
        ]
        make_sheet(previews, [ "ref-style"] + [str(i) for i in range(args.seed_start, args.seed_start + 7)], cell=240, cols=8, title="Style test").save(
            outdir / "tests" / "preview.jpg", quality=92
        )
        print("wrote tests only")
        return

    images = []
    labels = []
    for i in range(args.count):
        seed = args.seed_start + i
        im = render_orb(seed, size=args.size)
        name = f"{seed:02d}.png"
        im.save(outdir / "avatars" / name)
        images.append(im)
        labels.append(f"{seed:02d}")
        if (i + 1) % 10 == 0:
            print(f"rendered {i+1}/{args.count}")

    cols = 10 if args.count >= 20 else max(1, args.count)
    sheet = make_sheet(
        images,
        labels,
        cell=180,
        cols=cols,
        title=f"Soft gradient orbs  ·  {args.count} seeds",
    )
    sheet.save(outdir / "sheet.jpg", quality=92, optimize=True)
    make_size_test(images).save(outdir / "sheet-small.jpg", quality=92, optimize=True)
    print(f"wrote {args.count} avatars to {outdir / 'avatars'}")
    print(f"wrote {outdir / 'sheet.jpg'} and {outdir / 'sheet-small.jpg'}")


if __name__ == "__main__":
    main()
