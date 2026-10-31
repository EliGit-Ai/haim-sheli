# מייצר את הקולות לסרטוני השיווק (reels/lines.json) עם הזמן של כל מילה.
# רץ ב-GitHub Actions (.github/workflows/reel-audio.yml) בענף reels-audio בלבד, כי שירות הקול צריך אינטרנט.
# פלט: reels/audio/<id>.mp3 ו-reels/audio/timing.json ({id: {"words": [[start_s, dur_s, word], ...]}})
import asyncio, json, os
import edge_tts

cfg = json.load(open("reels/lines.json", encoding="utf-8"))
os.makedirs("reels/audio", exist_ok=True)
timing = {}

async def make(line):
    v = cfg["voices"][line["who"]]
    for attempt in range(4):
        try:
            words, audio = [], bytearray()
            c = edge_tts.Communicate(line["text"], v["voice"], rate=v["rate"], boundary="WordBoundary")
            async for chunk in c.stream():
                if chunk["type"] == "audio":
                    audio.extend(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    words.append([chunk["offset"] / 1e7, chunk["duration"] / 1e7, chunk["text"]])
            open(f"reels/audio/{line['id']}.mp3", "wb").write(audio)
            timing[line["id"]] = {"who": line["who"], "text": line["text"], "words": words}
            print("ok", line["id"], len(words))
            return
        except Exception as e:
            print("retry", line["id"], e)
            await asyncio.sleep(3)
    raise SystemExit(f"failed {line['id']}")

async def main():
    for line in cfg["lines"]:
        await make(line)

asyncio.run(main())
json.dump(timing, open("reels/audio/timing.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
