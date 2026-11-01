# מייצר את ההקראה לכל הימים והגרסאות החלופיות, עם הזמן של כל מילה.
# רץ ב-GitHub Actions (.github/workflows/narration.yml), כי שירות הקול צריך גישה לאינטרנט.
# פלט:
#   public/app/audio/n/<key>.mp3   key: d<N> (יום), nr<N> (ללא זוגיות), nk<N> (ללא ילדים)
#                                  ו-e<key> (שאלת הערב של אותו יום, הקלטה נפרדת)
#   content/narration.json          לכל key: משך, ולכל מילה [התחלה, משך, מיקום בטקסט, אורך]
#                                  ו-parts: [התחלה, סוף, יעד] לכל חלק של הצעד או של שאלת הערב
# ההקראה של הבוקר היא narration.join("\n"), ואחריה "הצעד של היום" עם השאלה והאפשרויות.
# שאלת הערב מוקלטת לבד, כי עונים עליה בערב. המיקומים מתייחסים לטקסט המוקרא.
# יעד: "h" כותרת החלק, "t<i>" בלוק טקסט, "p<i>" השאלה של בלוק, "o<i>.<k>" אפשרות k של בלוק i.
import asyncio, hashlib, json, os, sys
import edge_tts

VOICE = os.environ.get("VOICE", "it-IT-GiuseppeMultilingualNeural")
RATE = os.environ.get("RATE", "-8%")
OUT = "public/app/audio/n"
MAP = "content/narration.json"

program = json.load(open("content/program.json", encoding="utf-8"))
base = [(f"d{d['day']}", d) for d in program["days"]]
base += [(f"nr{d['day']}", d) for d in program["alternates"]["noRelationship"]]
base += [(f"nk{d['day']}", d) for d in program["alternates"]["noKids"]]
items = [(k, d, "morning") for k, d in base]
items += [(f"e{k}", d, "evening") for k, d in base if d.get("evening")]

old = json.load(open(MAP, encoding="utf-8")) if os.path.exists(MAP) else {"items": {}}
result = {"voice": VOICE, "rate": RATE, "items": {}}

def spoken_part(content, heading, already=""):
    """the step or the evening question as it is read aloud, with where each piece sits"""
    out, parts = "", []
    def add(piece, target):
        nonlocal out
        if out and not out.endswith(("\n", " ")):
            out += " "
        start = len(out)
        out += piece
        if target:
            parts.append([start, len(out), target])
    add(heading, "h")
    out += "\n"
    rated = False
    for i, b in enumerate(content["blocks"]):
        if b["type"] == "text":
            if b["text"] not in already:  # day 1 already says it in the narration
                add(b["text"], f"t{i}")
        elif b["type"] == "rating":
            add(("" if rated else "מאחד עד עשר, ") + b["prompt"], f"p{i}")
            rated = True
        elif b["type"] == "choice":
            if b.get("prompt"):
                add(b["prompt"], f"p{i}")
            if b.get("needs"):  # some options are shown only to some men: read the question, not the list
                out += "\n"
                continue
            ks = b.get("order") or list(range(len(b["options"])))
            for j, k in enumerate(ks):
                opt = b["options"][k].rstrip(".")
                if j == len(ks) - 1 and len(ks) > 1:
                    add("או", None)
                add(opt + ("." if j == len(ks) - 1 else ","), f"o{i}.{k}")
            if b.get("multi"):
                add("אפשר לבחור יותר מאחת.", None)
        out += "\n"
    return out.strip(), parts

def text_of(d, kind="morning"):
    """returns the spoken text and the parts of the step or evening question inside it"""
    if kind == "evening":
        return spoken_part(d["evening"], "ולערב, שאלה אחת.")
    narr = "\n".join(d["narration"])
    if not d.get("step"):
        return narr, []
    title = d["step"].get("title") or "הצעד של היום"
    step, parts = spoken_part(d["step"], title + ".", narr)
    shift = len(narr) + 1
    return narr + "\n" + step, [[a + shift, b + shift, t] for a, b, t in parts]

def key_hash(text):
    return hashlib.sha1(f"{VOICE}|{RATE}|{text}".encode()).hexdigest()[:12]

async def make(key, d, kind, sem):
    text, parts = text_of(d, kind)
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
    result["items"][key] = {"hash": h, "end": round(end, 2), "words": timed, "parts": parts}
    print("ok", key, len(timed), "words", f"{missed} unplaced" if missed else "", flush=True)

async def main():
    os.makedirs(OUT, exist_ok=True)
    sem = asyncio.Semaphore(4)
    await asyncio.gather(*(make(k, d, kind, sem) for k, d, kind in items))
    result["items"] = dict(sorted(result["items"].items(), key=lambda kv: (kv[0].startswith("e"), kv[0].lstrip("e")[0:2] != "d", kv[0])))
    json.dump(result, open(MAP, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("done", len(result["items"]), "items")

asyncio.run(main())
