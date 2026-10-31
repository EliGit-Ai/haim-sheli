# בדיקת הקראה: יום 2 בכל הקולות שיכולים לדבר עברית, עם הזמן של כל מילה.
import asyncio, json
import edge_tts

program = json.load(open("content/program.json", encoding="utf-8"))
d = next(x for x in program["days"] if x["day"] == 2)
text = "\n".join(d["narration"])

async def one(voice):
    words = []
    c = edge_tts.Communicate(text, voice, rate="-8%", boundary="WordBoundary")
    path = f"tts-out/voices/{voice}.mp3"
    with open(path, "wb") as f:
        async for chunk in c.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({"t": round(chunk["offset"] / 1e7, 3), "d": round(chunk["duration"] / 1e7, 3), "w": chunk["text"]})
    return words

async def main():
    allv = await edge_tts.list_voices()
    hebrew = [v["ShortName"] for v in allv if v["Locale"].startswith("he-")]
    multi = [v["ShortName"] for v in allv if "Multilingual" in v["ShortName"]]
    print("hebrew:", hebrew)
    print("multilingual:", multi)
    out = {"title": d["title"], "narration": d["narration"], "voices": []}
    for v in hebrew + multi:
        try:
            w = await one(v)
            g = next(x["Gender"] for x in allv if x["ShortName"] == v)
            out["voices"].append({"id": v, "gender": g, "words": w})
            print("ok", v, g, len(w))
        except Exception as e:
            print("fail", v, repr(e)[:200])
    json.dump(out, open("tts-out/voices/voices.json", "w", encoding="utf-8"), ensure_ascii=False)

asyncio.run(main())
