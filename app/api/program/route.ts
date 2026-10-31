import { NextResponse } from "next/server";
import program from "@/content/program.json";
import { verifyCode } from "@/lib/access-code.mjs";
import { FREE_DAYS } from "@/lib/push-schedule";
import narration from "@/content/narration.json";

// התוכן של האפליקציה (/app).
// בלי קוד: ימי האתגר החינמי (FREE_DAYS, בזמן הפיילוט כל 90). עם קוד גישה תקין: כל 90 הימים והגרסאות החלופיות.
// השרת לא מקבל ולא שומר שום תשובה של המשתמש. הבקשה היחידה היא "תן לי את התוכן".
// נדרש משתנה סביבה ב-Vercel: ACCESS_SECRET (מחרוזת אקראית ארוכה, לפחות 32 תווים).

export const dynamic = "force-dynamic";


type Day = (typeof program.days)[number];
type Timed = { end: number; words: number[][] };
const voiced = narration.items as Record<string, Timed | undefined>;

// adds the narration audio and the time of every word, when they exist for this day
function withAudio<T extends { day: number }>(d: T, prefix: "d" | "nr" | "nk") {
  const key = `${prefix}${d.day}`;
  const v = voiced[key];
  return v ? { ...d, audio: `/app/audio/n/${key}.mp3`, timing: v } : d;
}

const meta = (d: Day) => ({
  day: d.day,
  title: d.title,
  week: d.week,
  weekName: d.weekName,
  month: d.month,
  rest: "rest" in d ? Boolean(d.rest) : false,
});

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const code = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const tier = code ? verifyCode(process.env.ACCESS_SECRET, code) : null;
  const full = tier === "full" || FREE_DAYS >= 90;
  const allowed = (n: number) => full || n <= FREE_DAYS;

  const body = {
    version: program.version,
    access: full ? "full" : "free",
    codeRejected: Boolean(code) && !full,
    freeDays: FREE_DAYS,
    months: program.months,
    map: program.days.map(meta),
    days: program.days.filter(d => allowed(d.day)).map(d => withAudio(d, "d")),
    alternates: {
      noRelationship: program.alternates.noRelationship.filter(d => allowed(d.day)).map(d => withAudio(d, "nr")),
      noKids: program.alternates.noKids.filter(d => allowed(d.day)).map(d => withAudio(d, "nk")),
    },
  };

  return NextResponse.json(body, {
    headers: {
      "cache-control": "private, no-store",
      vary: "authorization",
    },
  });
}
