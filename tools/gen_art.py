"""Art pipeline: portraits + speaking/blink variants + scenes + bbox manifest.

Usage: GOOGLE_API_KEY=... python3 tools/gen_art.py [leader_id ...]
Reads leaders from src/content/leaders.ts (via a tiny JSON export), writes public/art/<id>/*.webp
and public/art/manifest.json.
"""
import base64, io, json, os, subprocess, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "art")
KEY = os.environ["GOOGLE_API_KEY"]
IMG_MODEL = os.environ.get("IMG_MODEL", "gemini-3.1-flash-image")
VISION_MODEL = os.environ.get("VISION_MODEL", "gemini-3.8-flash")
STYLE = ("Stylized painted portrait in the art style of Civilization VI leader screens: bold saturated colors, "
         "soft painterly shading, slightly exaggerated proportions, confident expression, mouth closed, eyes open "
         "looking at the viewer, waist-up, centered, on a plain dark gradient backdrop, no text, no frame.")
SCENE_STYLE = ("Painted background illustration in the art style of Civilization VI, wide establishing shot, "
               "no people, soft depth, atmospheric light, rich color, no text.")


def call(model, parts, gen_cfg, retries=4):
    body = {"contents": [{"parts": parts}], "generationConfig": gen_cfg}
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(body).encode(), headers={"x-goog-api-key": KEY, "Content-Type": "application/json"})
    for i in range(retries):
        try:
            return json.load(urllib.request.urlopen(req, timeout=240))
        except Exception as e:  # noqa
            print("retry", model, i, str(e)[:120]); time.sleep(3 + 4 * i)
    raise RuntimeError("api failed")


def gen_image(prompt, aspect, ref=None):
    parts = []
    if ref is not None:
        parts.append({"inlineData": {"mimeType": "image/png", "data": b64(ref)}})
    parts.append({"text": prompt})
    r = call(IMG_MODEL, parts, {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": aspect}})
    for p in r["candidates"][0]["content"]["parts"]:
        if "inlineData" in p:
            return Image.open(io.BytesIO(base64.b64decode(p["inlineData"]["data"]))).convert("RGB")
    raise RuntimeError("no image: " + json.dumps(r)[:300])


def b64(img):
    buf = io.BytesIO(); img.save(buf, "PNG"); return base64.b64encode(buf.getvalue()).decode()


def bboxes(img):
    prompt = ("Detect on this painted portrait: the mouth (lips only), both eyes together as one box (from the outer corner "
              "of the left eye to the outer corner of the right eye, including eyelids and brows), and the whole head "
              "(including hair and headdress). Return JSON {\"mouth\":[ymin,xmin,ymax,xmax],\"eyes\":[...],\"head\":[...]} "
              "with coordinates normalized to 0-1000.")
    r = call(VISION_MODEL, [{"inlineData": {"mimeType": "image/png", "data": b64(img)}}, {"text": prompt}],
             {"responseMimeType": "application/json"})
    return json.loads(r["candidates"][0]["content"]["parts"][0]["text"])


def crop(img, box, pad):
    w, h = img.size
    y0, x0, y1, x1 = box
    py, px = (y1 - y0) * pad, (x1 - x0) * pad
    y0, y1, x0, x1 = max(0, y0 - py), min(1000, y1 + py), max(0, x0 - px), min(1000, x1 + px)
    return img.crop((int(x0 / 1000 * w), int(y0 / 1000 * h), int(x1 / 1000 * w), int(y1 / 1000 * h))), [y0, x0, y1, x1]


def feather(patch):
    """Alpha-feather patch edges so it blends over the base portrait."""
    w, h = patch.size
    mask = Image.new("L", (w, h), 0)
    from PIL import ImageDraw
    d = ImageDraw.Draw(mask)
    m = max(2, min(w, h) // 8)
    d.rounded_rectangle((m, m, w - m, h - m), radius=m, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(m))
    patch = patch.convert("RGBA"); patch.putalpha(mask); return patch


def align_patch(base, variant, box, search=0.12):
    """Cut `box` from `variant`, shifted to best match `base` on the ring around the feature,
    then colour-match the cut to the base so the patch disappears into the portrait."""
    import numpy as np
    w, h = base.size
    y0, x0, y1, x1 = [int(v / 1000 * d) for v, d in zip(box, (h, w, h, w))]
    bw, bh = x1 - x0, y1 - y0
    B = np.asarray(base.convert("RGB"), dtype=np.float32)
    V = np.asarray(variant.convert("RGB"), dtype=np.float32)
    ring = np.ones((bh, bw), dtype=bool)
    my, mx = int(bh * 0.28), int(bw * 0.22)
    ring[my:bh - my, mx:bw - mx] = False
    ref = B[y0:y1, x0:x1]
    r = int(max(bw, bh) * search)
    best, bdx, bdy = None, 0, 0
    for dy in range(-r, r + 1, 2):
        for dx in range(-r, r + 1, 2):
            ys, xs = y0 + dy, x0 + dx
            if ys < 0 or xs < 0 or ys + bh > h or xs + bw > w:
                continue
            cand = V[ys:ys + bh, xs:xs + bw]
            err = ((cand - ref) ** 2)[ring].mean()
            if best is None or err < best:
                best, bdx, bdy = err, dx, dy
    cut = V[y0 + bdy:y1 + bdy, x0 + bdx:x1 + bdx].copy()
    # per-channel gain/offset from the ring statistics
    for c in range(3):
        bm, bs = ref[..., c][ring].mean(), ref[..., c][ring].std() + 1e-3
        vm, vs = cut[..., c][ring].mean(), cut[..., c][ring].std() + 1e-3
        gain = float(np.clip(bs / vs, 0.7, 1.4))
        cut[..., c] = np.clip((cut[..., c] - vm) * gain + bm, 0, 255)
    print(f"    patch shift dx={bdx} dy={bdy}")
    return Image.fromarray(cut.astype(np.uint8))


def save(img, path, q=88):
    img.save(path, "WEBP", quality=q, method=6)


def character(dirpath, key, prompt):
    base_p = os.path.join(dirpath, f"{key}.webp")
    if os.path.exists(os.path.join(dirpath, f"{key}.json")):
        return json.load(open(os.path.join(dirpath, f"{key}.json")))
    print("  portrait", key)
    base = gen_image(f"{STYLE} Subject: {prompt}", "3:4").resize((768, 1024), Image.LANCZOS)
    print("  variants", key)
    with ThreadPoolExecutor(3) as ex:
        f_open = ex.submit(gen_image, "Edit this exact image: keep everything identical (framing, lighting, colors, pose, clothing) "
                           "but the character is now mid-sentence, mouth clearly open showing teeth slightly as if pronouncing 'ah'. "
                           "Same eyes, same expression otherwise.", "3:4", base)
        f_half = ex.submit(gen_image, "Edit this exact image: keep everything identical (framing, lighting, colors, pose, clothing) "
                           "but the lips are slightly parted, as if pronouncing 'mm' or 'oo', small rounded opening. Same eyes.", "3:4", base)
        f_blink = ex.submit(gen_image, "Edit this exact image: keep everything identical (framing, lighting, colors, pose, clothing) "
                            "but both eyes are fully closed, eyelids down, relaxed. Same mouth.", "3:4", base)
        open_, half, blink = [f.result().resize((768, 1024), Image.LANCZOS) for f in (f_open, f_half, f_blink)]
    print("  bbox", key)
    bb = bboxes(base)
    mouth_c, mouth_box = crop(base, bb["mouth"], 0.55)
    eyes_c, eyes_box = crop(base, bb["eyes"], 0.35)
    save(base, base_p)
    write_patches(dirpath, key, base, open_, half, blink, mouth_box, eyes_box)
    meta = {"src": f"art/{os.path.basename(dirpath)}/{key}.webp",
            "bbox": {"mouth": mouth_box, "eyes": eyes_box, "head": bb["head"]}}
    json.dump(meta, open(os.path.join(dirpath, f"{key}.json"), "w"))
    return meta


RAW = os.path.join(ROOT, "tools", "art_raw")


def write_patches(dirpath, key, base, open_, half, blink, mouth_box, eyes_box):
    os.makedirs(os.path.join(RAW, os.path.basename(dirpath)), exist_ok=True)
    for name, src, box in (("mouth_open", open_, mouth_box), ("mouth_half", half, mouth_box), ("eyes_closed", blink, eyes_box)):
        src.save(os.path.join(RAW, os.path.basename(dirpath), f"{key}_{name}.png"))
        feather(align_patch(base, src, box)).save(os.path.join(dirpath, f"{key}_{name}.webp"), "WEBP", quality=90, method=6)


def refresh_patches(dirpath, key):
    """Regenerate only the speaking/blink patches for an existing portrait (reuses cached raw variants)."""
    meta = json.load(open(os.path.join(dirpath, f"{key}.json")))
    base = Image.open(os.path.join(dirpath, f"{key}.webp")).convert("RGB")
    rawdir = os.path.join(RAW, os.path.basename(dirpath))

    def variant(name, prompt):
        p = os.path.join(rawdir, f"{key}_{name}.png")
        if os.path.exists(p):
            return Image.open(p).convert("RGB")
        return gen_image(prompt, "3:4", base).resize(base.size, Image.LANCZOS)

    print("  variants", key)
    with ThreadPoolExecutor(3) as ex:
        f_open = ex.submit(variant, "mouth_open", "Edit this exact image: keep everything identical (framing, lighting, colors, pose, clothing) "
                           "but the character is now mid-sentence, mouth clearly open showing teeth slightly as if pronouncing 'ah'. "
                           "Same eyes, same expression otherwise.")
        f_half = ex.submit(variant, "mouth_half", "Edit this exact image: keep everything identical (framing, lighting, colors, pose, clothing) "
                           "but the lips are slightly parted, as if pronouncing 'mm' or 'oo', small rounded opening. Same eyes.")
        f_blink = ex.submit(variant, "eyes_closed", "Edit this exact image: keep everything identical (framing, lighting, colors, pose, clothing) "
                            "but both eyes are fully closed, eyelids down, relaxed. Same mouth.")
        open_, half, blink = f_open.result(), f_half.result(), f_blink.result()
    write_patches(dirpath, key, base, open_, half, blink, meta["bbox"]["mouth"], meta["bbox"]["eyes"])


def scene(dirpath, prompt):
    p = os.path.join(dirpath, "scene.webp")
    if not os.path.exists(p):
        print("  scene")
        img = gen_image(f"{SCENE_STYLE} Location: {prompt}", "9:16").resize((864, 1536), Image.LANCZOS)
        save(img, p, 82)
        far = img.filter(ImageFilter.GaussianBlur(6)).resize((432, 768), Image.LANCZOS)
        save(far, os.path.join(dirpath, "scene_far.webp"), 75)
    return {"src": f"art/{os.path.basename(dirpath)}/scene.webp", "far": f"art/{os.path.basename(dirpath)}/scene_far.webp"}


def load_leaders():
    """Poor-man's extraction of leaders.ts -> JSON via node."""
    js = subprocess.check_output(["node", "--experimental-strip-types", "--no-warnings", "--input-type=module", "-e",
        "import('./src/content/leaders.ts').then(m=>console.log(JSON.stringify(m.LEADERS)))"], cwd=ROOT)
    return json.loads(js)


def main():
    os.makedirs(OUT, exist_ok=True)
    leaders = load_leaders()
    args = sys.argv[1:]
    if args and args[0] == "--patches":
        only = set(args[1:])
        for L in leaders:
            if only and L["id"] not in only:
                continue
            print("==", L["id"])
            d = os.path.join(OUT, L["id"])
            for key in ["leader"] + [a["role"] for a in L["advisors"]]:
                refresh_patches(d, key)
        return
    only = set(args)
    manifest_p = os.path.join(OUT, "manifest.json")
    manifest = json.load(open(manifest_p)) if os.path.exists(manifest_p) else {}
    for L in leaders:
        if only and L["id"] not in only:
            continue
        print("==", L["id"])
        d = os.path.join(OUT, L["id"]); os.makedirs(d, exist_ok=True)
        entry = {"scene": scene(d, L["scenePrompt"]), "leader": character(d, "leader", L["portraitPrompt"]), "advisors": {}}
        for a in L["advisors"]:
            desc = (f"{a['name']}, {a['title']} at the court of {L['name']} ({L['civ']}, {L['era']}); personality: {a['trait']}; "
                    f"historically accurate clothing for that era and culture; distinct silhouette from other courtiers.")
            entry["advisors"][a["role"]] = character(d, a["role"], desc)
        manifest[L["id"]] = entry
        json.dump(manifest, open(manifest_p, "w"), indent=1)
    print("done")


if __name__ == "__main__":
    main()
