# מייצר את ההקראה לכל הימים והגרסאות החלופיות, עם הזמן של כל מילה.
# רץ ב-GitHub Actions (.github/workflows/narration.yml), כי שירות הקול צריך גישה לאינטרנט.
# פלט:
#   public/app/audio/n/<key>.mp3   key: d<N> (יום), nr<N> (ללא זוגיות), nk<N> (ללא ילדים)
#   content/narration.json          לכל key: משך, ולכל מילה [התחלה, משך, מיקום בטקסט, אורך]
# הטקסט שמוקרא הוא narration.join("\n"), והמיקומים מתייחסים אליו.
import asyncio, hashlib, json, os, sys
import edge_tts

VOICE = os.environ.get("VOICE", "it-IT-GiuseppeMultilingualNeural")
RATE = os.environ.get("RATE", "-8%")
OUT = "public/app/audio/n"
MAP = "content/narration.json"

program = json.load(open("content/program.json", encoding="utf-8"))
items = [(f"d{d['day']}", d) for d in program["days"]]
items += [(f"nr{d['day']}", d) for d in program["alternates"]["noRelationship"]]
items += [(f"nk{d['day']}", d) for d in program["alternates"]["noKids"]]

old = json.load(open(MAP, encoding="utf-8")) if os.path.exists(MAP) else {"items": {}}
result = {"voice": VOICE, "rate": RATE, "items": {}}

def text_of(d):
    return "\n".join(d["narration"])

def key_hash(text):
    return hashlib.sha1(f"{VOICE}|{RATE}|{text}".encode()).hexdigest()[:12]

async def make(key, d, sem):
    text = text_of(d)
    h = key_hash(text)
    prev = old["items"].get(key)
    if prev and prev.get("hash") == h and os.path.exists(f"{OUT}/{key}.mp3"):
        result["items"][key] = prev  # unchanged text and voice: keep the existing audio
        return
    async with sem:
        for attempt in range(4):
            try:
                words, audio = [], bytearray()
                c = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
                async for chunk in c.stream():
                    if chunk["type"] == "audio":
                        audio += chunk["data"]
                    elif chunk["type"] == "WordBoundary":
                        words.append((chunk["offset"] / 1e7, chunk["duration"] / 1e7, chunk["text"]))
                break
            except Exception as e:
                print("retry", key, attempt, repr(e)[:120], flush=True)
                await asyncio.sleep(3 * (attempt + 1))
        else:
            raise RuntimeError(f"failed {key}")
    # place every spoken word in the text, in order
    cursor, timed, missed = 0, [], 0
    for t, dur, w in words:
        at = text.find(w, cursor)
        if at < 0:
            missed += 1
            continue
        timed.append([round(t, 3), round(dur, 3), at, len(w)])
        cursor = at + len(w)
    open(f"{OUT}/{key}.mp3", "wb").write(audio)
    end = max((x[0] + x[1] for x in timed), default=0)
    result["items"][key] = {"hash": h, "end": round(end, 2), "words": timed}
    print("ok", key, len(timed), "words", f"{missed} unplaced" if missed else "", flush=True)

async def main():
    os.makedirs(OUT, exist_ok=True)
    sem = asyncio.Semaphore(4)
    await asyncio.gather(*(make(k, d, sem) for k, d in items))
    result["items"] = dict(sorted(result["items"].items(), key=lambda kv: (kv[0][0:2] != "d", kv[0])))
    json.dump(result, open(MAP, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("done", len(result["items"]), "items")

asyncio.run(main())
