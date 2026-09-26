import json, sys, os, base64, urllib.request
img = sys.argv[1]
body = {"contents":[{"parts":[
  {"inlineData":{"mimeType":"image/jpeg","data":base64.b64encode(open(img,"rb").read()).decode()}},
  {"text":"Detect the character's mouth (lips only) and the whole head (including hair/headdress). Return JSON: {\"mouth\":[ymin,xmin,ymax,xmax],\"head\":[ymin,xmin,ymax,xmax]} with coordinates normalized to 0-1000."}]}],
  "generationConfig":{"responseMimeType":"application/json"}}
req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    data=json.dumps(body).encode(), headers={"x-goog-api-key":os.environ["GOOGLE_API_KEY"],"Content-Type":"application/json"})
r = json.load(urllib.request.urlopen(req, timeout=120))
print(r["candidates"][0]["content"]["parts"][0]["text"])
