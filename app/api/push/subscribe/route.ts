import { NextResponse } from "next/server";
import { verifyCode } from "@/lib/access-code.mjs";
import { dbReady, removeByEndpoint, upsert } from "@/lib/push-db";

// רישום (או עדכון) של טלפון להתראות, וביטול שלו.
// נשמר רק מה שצריך כדי לדעת איזה יום לשלוח ומתי: כתובת ההתראה של המכשיר, תאריך ההתחלה,
// אזור הזמן, שעות ההתראה ושלוש תשובות הפרופיל. בלי מייל, בלי שם ובלי שום תשובה מהימים.

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const hourOrNull = (v: unknown) => (v === null ? null : Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 23 ? (v as number) : undefined);

function validTz(tz: unknown) {
  if (typeof tz !== "string" || tz.length > 64) return null;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return null; }
}

function validSubscription(s: unknown) {
  const sub = s as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (!sub || typeof sub.endpoint !== "string" || !/^https:\/\//.test(sub.endpoint) || sub.endpoint.length > 1000) return null;
  const { p256dh, auth } = sub.keys || {};
  if (typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint: sub.endpoint, p256dh, auth };
}

export async function POST(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "ההתראות עוד לא מוגדרות בשרת." }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }

  const sub = validSubscription(body.subscription);
  const tz = validTz(body.tz);
  const start = typeof body.start === "string" && ISO.test(body.start) ? body.start : null;
  const p = (body.profile || {}) as Record<string, unknown>;
  const h = (body.hours || {}) as Record<string, unknown>;
  const morning = hourOrNull(h.morning), midday = hourOrNull(h.midday), evening = hourOrNull(h.evening);
  if (!sub || !tz || !start || morning === undefined || midday === undefined || evening === undefined) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const full = code ? verifyCode(process.env.ACCESS_SECRET, code) === "full" : false;

  try {
    await upsert({
      ...sub,
      start_date: start,
      tz,
      shabbat: p.shabbat === "yes",
      no_relationship: p.relationship === "no",
      no_kids: p.kids === "no",
      full_access: full,
      morning_hour: morning,
      midday_hour: midday,
      evening_hour: evening,
    });
  } catch (e) {
    console.error("push subscribe:", e);
    return NextResponse.json({ error: "לא הצלחנו לשמור. נסה שוב בעוד רגע." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!dbReady()) return NextResponse.json({ ok: true });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  if (typeof body.endpoint !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  try { await removeByEndpoint(body.endpoint); } catch (e) { console.error("push unsubscribe:", e); }
  return NextResponse.json({ ok: true });
}
