// מתי ומה לשלוח בהתראות של האפליקציה. פונקציות טהורות, בלי רשת ובלי מסד נתונים, כדי שאפשר לבדוק אותן.
// אותם כללים כמו באפליקציה (public/app/index.html):
//   ימים 1 ו-2 נפתחים ביום ההתחלה, ומיום 3 נפתח יום אחד בכל יום קלנדרי.
//   שומר שבת מקבל את היום של שבת כבר ביום שישי, ולא מקבל התראות בשבת.

import { milestoneFor } from "./milestones";

export type Slot = "morning" | "midday" | "evening";
export const SLOTS: Slot[] = ["morning", "midday", "evening"];

// אם הריצה המתוזמנת מתעכבת, עדיין שולחים, אבל לא יותר משלוש שעות אחרי השעה שנבחרה
export const LATE_WINDOW_HOURS = 3;
// כמה ימים פתוחים בלי קוד גישה. בזמן הפיילוט פתוח הכול (90).
// כדי לחזור לאתגר של 3 ימים: להגדיר ב-Vercel את המשתנה FREE_DAYS=3, בלי לשנות קוד.
export const FREE_DAYS = Math.min(90, Math.max(1, Number(process.env.FREE_DAYS) || 90));

export type Sub = {
  start_date: string; // YYYY-MM-DD, היום שבו התחיל באפליקציה
  tz: string;
  shabbat: boolean;
  no_relationship: boolean;
  no_kids: boolean;
  full_access: boolean;
  morning_hour: number | null;
  midday_hour: number | null;
  evening_hour: number | null;
  last_morning: string | null; // YYYY-MM-DD של השליחה האחרונה בכל משבצת
  last_midday: string | null;
  last_evening: string | null;
};

export type Block = { prompt?: string; text?: string };
export type Day = {
  day: number;
  title: string;
  midday?: string;
  rest?: boolean;
  evening?: { blocks?: Block[] };
};
export type Program = {
  days: Day[];
  alternates: { noRelationship: Day[]; noKids: Day[] };
};

export type Message = { slot: Slot; day: number; title: string; body: string; url: string };

// השעה, התאריך ויום השבוע אצל המשתמש, לפי אזור הזמן שלו
export function localNow(now: Date, tz: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short",
    }).formatToParts(now);
  } catch {
    return localNow(now, "Asia/Jerusalem");
  }
  const get = (t: string) => parts.find(p => p.type === t)?.value || "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), weekday };
}

const toUTC = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 86400000);

function contentFor(program: Program, sub: Sub, n: number): Day | undefined {
  const alt = (sub.no_relationship && program.alternates.noRelationship.find(d => d.day === n))
    || (sub.no_kids && program.alternates.noKids.find(d => d.day === n));
  return alt || program.days.find(d => d.day === n);
}

const clip = (s: string, max = 140) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);

// ההתראות שצריך לשלוח עכשיו למנוי אחד
export function due(sub: Sub, program: Program, now: Date): Message[] {
  const { date, hour, weekday } = localNow(now, sub.tz);
  if (daysBetween(sub.start_date, date) < 0) return [];
  if (sub.shabbat && weekday === 6) return []; // שבת: שקט

  // היום של היום עצמו (בלי ההקדמה של שבת). אחרי יום 90 מפסיקים
  const n = daysBetween(sub.start_date, date) + 2;
  if (n > 90) return [];
  const allowed = sub.full_access ? 90 : FREE_DAYS;
  if (n > allowed) return [];
  // שומר שבת ביום שישי: נפתחים גם היום של שישי וגם היום של שבת
  const withShabbatDay = sub.shabbat && weekday === 5 && n < Math.min(90, allowed);

  const day = contentFor(program, sub, n);
  if (!day) return [];
  const firstDay = n === 2;
  const url = `/app#/day/${firstDay ? 1 : n}`;

  const out: Message[] = [];
  for (const slot of SLOTS) {
    const h = sub[`${slot}_hour`];
    if (h === null || h === undefined) continue;
    if (sub[`last_${slot}`] === date) continue;
    if (hour < h || hour >= h + LATE_WINDOW_HOURS) continue;

    if (slot === "morning") {
      out.push(firstDay
        ? { slot, day: n, title: "ימים 1–2 מחכים לך", body: "שני הימים הראשונים כבר פתוחים. כמה דקות, ומתחילים.", url }
        : withShabbatDay
          ? { slot, day: n, title: `ימים ${n}–${n + 1} נפתחו`, body: `${day.title}. והיום של שבת כבר מחכה לך.`, url }
          : milestoneFor(n)
            // a day on the way: the message of the agreement instead of the day's title
            ? { slot, day: n, title: `יום ${n} · ${milestoneFor(n)!.title}`, body: milestoneFor(n)!.text, url }
            : { slot, day: n, title: `יום ${n} נפתח`, body: day.title, url });
    } else if (slot === "midday") {
      if (!day.midday) continue; // ימי מנוחה בלי תזכורת
      out.push({ slot, day: n, title: "חיים שלי", body: clip(day.midday), url });
    } else {
      if (day.rest) continue;
      const block = day.evening?.blocks?.find(b => b.prompt || b.text);
      const prompt = block?.prompt || block?.text;
      if (!prompt) continue;
      out.push({ slot, day: n, title: "שאלה לערב", body: clip(prompt), url: `/app#/day/${n}` });
    }
  }
  return out;
}
