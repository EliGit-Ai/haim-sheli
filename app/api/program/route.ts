import { NextResponse } from "next/server";
import program from "@/content/program.json";
import { verifyCode } from "@/lib/access-code.mjs";
import { FREE_DAYS } from "@/lib/push-schedule";

// התוכן של האפליקציה (/app).
// בלי קוד: ימי האתגר החינמי (FREE_DAYS, בזמן הפיילוט כל 90). עם קוד גישה תקין: כל 90 הימים והגרסאות החלופיות.
// השרת לא מקבל ולא שומר שום תשובה של המשתמש. הבקשה היחידה היא "תן לי את התוכן".
// נדרש משתנה סביבה ב-Vercel: ACCESS_SECRET (מחרוזת אקראית ארוכה, לפחות 32 תווים).

export const dynamic = "force-dynamic";


type Day = (typeof program.days)[number];

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
    days: program.days.filter(d => allowed(d.day)),
    alternates: {
      noRelationship: program.alternates.noRelationship.filter(d => allowed(d.day)),
      noKids: program.alternates.noKids.filter(d => allowed(d.day)),
    },
  };

  return NextResponse.json(body, {
    headers: {
      "cache-control": "private, no-store",
      vary: "authorization",
    },
  });
}
