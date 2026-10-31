import { NextResponse } from "next/server";
import webpush from "web-push";
import program from "@/content/program.json";
import { due, why, type Program } from "@/lib/push-schedule";
import { dbReady, listAll, markSent, removeById } from "@/lib/push-db";

// שליחת ההתראות. רץ כל שעה מתוך משימה מתוזמנת (GitHub Actions), ושולח לכל טלפון
// את מה שהגיע זמנו לפי השעה המקומית שלו. כל התראה נשלחת פעם אחת ביום לכל היותר.
// משתני סביבה: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv || !dbReady()) return NextResponse.json({ error: "push is not configured" }, { status: 503 });
  webpush.setVapidDetails("mailto:gever@haim-sheli.com", pub, priv);

  const now = new Date();
  const rows = await listAll();
  let sent = 0, removed = 0, failed = 0;
  const reasons: Record<string, number> = {}; // why nothing was due, counted (no personal details)

  for (const row of rows) {
    const messages = due(row, program as unknown as Program, now);
    if (!messages.length) { const r = why(row, program as unknown as Program, now); reasons[r] = (reasons[r] || 0) + 1; continue; }
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: row.tz }).format(now);
    const done: Record<string, string> = {};
    let gone = false;

    for (const m of messages) {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: `day-${m.day}-${m.slot}` }),
          { TTL: 3 * 3600, urgency: "normal" },
        );
        done[`last_${m.slot}`] = today;
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) { gone = true; break; } // הטלפון ביטל את ההרשמה
        failed++;
        reasons[`error-${status || "network"}`] = (reasons[`error-${status || "network"}`] || 0) + 1;
        console.error("push send:", status, (e as Error).message);
      }
    }

    if (gone) { await removeById(row.id).catch(() => {}); removed++; continue; }
    if (Object.keys(done).length) await markSent(row.id, done).catch(e => console.error("push mark:", e));
  }

  return NextResponse.json({ subscribers: rows.length, sent, removed, failed, reasons });
}

export const GET = run;
export const POST = run;
