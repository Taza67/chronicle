"""Generate a loopable ~30s music clip per leader with Lyria, written to public/music/<id>.mp3.

Usage: GOOGLE_API_KEY=... python3 tools/gen_music.py [leader_id ...]
"""
import base64, json, os, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "music")
KEY = os.environ["GOOGLE_API_KEY"]
MODEL = os.environ.get("MUSIC_MODEL", "lyria-3-clip-preview")


def lyria(prompt):
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"responseModalities": ["AUDIO"]}}
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
                                 data=json.dumps(body).encode(), headers={"x-goog-api-key": KEY, "Content-Type": "application/json"})
    r = json.load(urllib.request.urlopen(req, timeout=300))
    for p in r["candidates"][0]["content"]["parts"]:
        if "inlineData" in p:
            return base64.b64decode(p["inlineData"]["data"])
    raise RuntimeError(json.dumps(r)[:300])


def loopify(src, dst):
    """Trim silence, crossfade tail into head so the clip loops seamlessly, normalise, mono-ish low bitrate for mobile."""
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-i", src, "-filter_complex",
        "[0:a]atrim=0.2:29.5,asetpts=PTS-STARTPTS,asplit=3[a][b][c];"
        "[a]atrim=0:2,asetpts=PTS-STARTPTS[h0];[b]atrim=2:27.3,asetpts=PTS-STARTPTS[h1];[c]atrim=27.3,asetpts=PTS-STARTPTS[tail];"
        "[tail][h0]acrossfade=d=2:c1=tri:c2=tri[x];[h1][x]concat=n=2:v=0:a=1,loudnorm=I=-18:TP=-2[out]",
        "-map", "[out]", "-b:a", "96k", dst])


def main():
    os.makedirs(OUT, exist_ok=True)
    js = subprocess.check_output(["node", "--experimental-strip-types", "--no-warnings", "--input-type=module", "-e",
        "import('./src/content/leaders.ts').then(m=>console.log(JSON.stringify(m.LEADERS)))"], cwd=ROOT)
    only = set(sys.argv[1:])
    for L in json.loads(js):
        if only and L["id"] not in only:
            continue
        dst = os.path.join(OUT, f"{L['id']}.mp3")
        if os.path.exists(dst):
            continue
        print("music", L["id"])
        raw = os.path.join(OUT, f"_{L['id']}_raw.mp3")
        open(raw, "wb").write(lyria(L["musicPrompt"] + " Instrumental only, no vocals, steady tempo, suitable as a seamless loop."))
        loopify(raw, dst)
        os.remove(raw)
    print("done")


if __name__ == "__main__":
    main()
