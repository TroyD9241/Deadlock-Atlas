"""Prototype of the shared palette function: image in, {accent, accentText, onAccent, palette[5]} out.
The same function is used for heroes and items. Port to TypeScript (sharp + a small k-means) for the real site."""
import sys, json, numpy as np
from PIL import Image

def srgb_to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124564,0.3575761,0.1804375],[0.2126729,0.7151522,0.0721750],[0.0193339,0.1191920,0.9503041]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[:,1] - 16, 500 * (f[:,0] - f[:,1]), 200 * (f[:,1] - f[:,2])], 1)

def lab_to_srgb(lab):
    fy = (lab[:,0] + 16) / 116; fx = fy + lab[:,1] / 500; fz = fy - lab[:,2] / 200
    f = np.stack([fx, fy, fz], 1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * np.array([0.95047, 1.0, 1.08883])
    M = np.array([[3.2404542,-1.5371385,-0.4985314],[-0.9692660,1.8760108,0.0415560],[0.0556434,-0.2040259,1.0572252]])
    c = xyz @ M.T
    c = np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055)
    return np.clip(c, 0, 1) * 255

def hexc(rgb): return '#%02X%02X%02X' % tuple(int(round(v)) for v in rgb)
def lum(rgb):
    c = np.array(rgb) / 255.0; c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def contrast(a, b):
    la, lb = lum(a), lum(b); hi, lo = max(la, lb), min(la, lb); return (hi + 0.05) / (lo + 0.05)

def kmeans(X, w, k, iters=14, seed=7):
    rng = np.random.default_rng(seed)
    C = [X[rng.choice(len(X), p=w / w.sum())]]
    for _ in range(k - 1):
        d = np.min([((X - c) ** 2).sum(1) for c in C], 0) * w
        C.append(X[rng.choice(len(X), p=d / d.sum())])
    C = np.array(C)
    for _ in range(iters):
        lab = np.argmin(((X[:, None] - C[None]) ** 2).sum(2), 1)
        for i in range(k):
            m = lab == i
            if m.any(): C[i] = np.average(X[m], axis=0, weights=w[m])
    return C, lab

def extract(path, panel=(20, 24, 36), k=10):
    im = Image.open(path).convert('RGBA'); im.thumbnail((160, 160))
    a = np.array(im).reshape(-1, 4); a = a[a[:, 3] >= 128]
    lab = srgb_to_lab(a[:, :3].astype(float))
    chroma = np.hypot(lab[:, 1], lab[:, 2])
    keep = lab[:, 0] > 6                       # drop pure black
    lab, chroma = lab[keep], chroma[keep]
    w = 0.25 + chroma / 40.0                   # saturated pixels count more than flat background
    C, assign = kmeans(lab, w, k)
    share = np.array([w[assign == i].sum() for i in range(k)]) / w.sum()
    ch = np.hypot(C[:, 1], C[:, 2])
    # accent: colorful, mid-light, reasonably present
    score = np.where((share >= 0.015) & (C[:, 0] > 35) & (C[:, 0] < 88), np.sqrt(share) * ch * (1 - abs(C[:, 0] - 62) / 70), 0)
    ai = int(np.argmax(score)) if score.max() > 0 else int(np.argmax(share))
    accent = lab_to_srgb(C[ai:ai + 1])[0]
    # palette: accent plus the most distinct present colors, sorted dark to light
    cand = [i for i in range(k) if share[i] >= 0.01 and i != ai]
    chosen = [ai]
    while len(chosen) < 5 and cand:
        best = max(cand, key=lambda i: min(np.linalg.norm(C[i] - C[j]) for j in chosen))
        chosen.append(best); cand.remove(best)
    chosen.sort(key=lambda i: C[i, 0])
    pal = [hexc(lab_to_srgb(C[i:i + 1])[0]) for i in chosen]
    # text-safe accent: lighten in Lab until it reaches 4.5:1 on the panel color
    t = C[ai].copy(); tt = lab_to_srgb(t[None])[0]
    while contrast(tt, panel) < 4.5 and t[0] < 98:
        t[0] += 2; tt = lab_to_srgb(t[None])[0]
    on = '#17131B' if contrast(accent, (23, 19, 27)) >= contrast(accent, (255, 255, 255)) else '#FFFFFF'
    return {'accent': hexc(accent), 'accentText': hexc(tt), 'onAccent': on, 'palette': pal}

if __name__ == '__main__':
    for p in sys.argv[1:]: print(p.split('/')[-1], json.dumps(extract(p)))
