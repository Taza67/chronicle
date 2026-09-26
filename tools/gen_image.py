import json, sys, os, base64, urllib.request
model = os.environ.get("IMG_MODEL", "gemini-3.1-flash-image")
prompt, out = sys.argv[1], sys.argv[2]
aspect = sys.argv[3] if len(sys.argv) > 3 else "3:4"
body = {"contents":[{"parts":[{"text":prompt}]}],
        "generationConfig":{"responseModalities":["IMAGE"],"imageConfig":{"aspectRatio":aspect}}}
req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    data=json.dumps(body).encode(), headers={"x-goog-api-key":os.environ["GOOGLE_API_KEY"],"Content-Type":"application/json"})
r = json.load(urllib.request.urlopen(req, timeout=180))
for p in r["candidates"][0]["content"]["parts"]:
    if "inlineData" in p:
        open(out,"wb").write(base64.b64decode(p["inlineData"]["data"])); print("ok", out, p["inlineData"]["mimeType"]); break
else: print(json.dumps(r)[:800])
