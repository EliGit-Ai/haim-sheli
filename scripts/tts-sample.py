# בדיקת הקראה: מייצר את ההקראה של יום אחד בקול Avri (עברית, גבר) ואת הזמן של כל מילה.
import asyncio, json, sys
import edge_tts

day = int(sys.argv[1]) if len(sys.argv) > 1 else 2
program = json.load(open("content/program.json", encoding="utf-8"))
d = next(x for x in program["days"] if x["day"] == day)
text = "\n".join(d["narration"])

async def main():
    words = []
    c = edge_tts.Communicate(text, "he-IL-AvriNeural", rate="-8%", boundary="WordBoundary")
    with open(f"tts-out/day-{day}.mp3", "wb") as f:
        async for chunk in c.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({"t": round(chunk["offset"] / 1e7, 3), "d": round(chunk["duration"] / 1e7, 3), "w": chunk["text"]})
    json.dump({"day": day, "title": d["title"], "narration": d["narration"], "words": words},
              open(f"tts-out/day-{day}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(day, len(words), "words")

asyncio.run(main())
