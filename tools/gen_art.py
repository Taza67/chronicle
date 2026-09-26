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
    for name, src, box in (("mouth_open", open_, mouth_box), ("mouth_half", half, mouth_box), ("eyes_closed", blink, eyes_box)):
        patch, _ = crop(src, box, 0)
        feather(patch).save(os.path.join(dirpath, f"{key}_{name}.webp"), "WEBP", quality=90, method=6)
    meta = {"src": f"art/{os.path.basename(dirpath)}/{key}.webp",
            "bbox": {"mouth": mouth_box, "eyes": eyes_box, "head": bb["head"]}}
    json.dump(meta, open(os.path.join(dirpath, f"{key}.json"), "w"))
    return meta


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
    only = set(sys.argv[1:])
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
