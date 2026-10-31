import { NextResponse } from "next/server";
import webpush from "web-push";
import { dbReady, getByEndpoint, removeById } from "@/lib/push-db";

// התראת בדיקה מההגדרות של האפליקציה: שולחת עכשיו התראה אחת לטלפון ששאל.
// רק מי שמחזיק את כתובת ההתראה של המכשיר יכול לבקש אותה, והיא נשלחת רק לכתובת שכבר רשומה.
// התשובה אומרת לאפליקציה מה קרה: נשלחה, הטלפון לא רשום, ההרשמה פגה, או שגיאה.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv || !dbReady()) return NextResponse.json({ status: "server" }, { status: 503 });
  let endpoint = "";
  try { endpoint = String((await req.json()).endpoint || ""); } catch {}
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000) return NextResponse.json({ status: "bad" }, { status: 400 });

  const row = await getByEndpoint(endpoint).catch(() => undefined);
  if (row === undefined) return NextResponse.json({ status: "server" }, { status: 502 });
  if (!row) return NextResponse.json({ status: "not-registered" });

  webpush.setVapidDetails("mailto:gever@haim-sheli.com", pub, priv);
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify({ title: "חיים שלי", body: "התראת בדיקה. אם אתה רואה את זה, ההתראות עובדות.", url: "/app#/settings", tag: "test" }),
      { TTL: 600, urgency: "high" },
    );
    return NextResponse.json({ status: "sent" });
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) { await removeById(row.id).catch(() => {}); return NextResponse.json({ status: "expired" }); }
    console.error("push test:", code, (e as Error).message);
    return NextResponse.json({ status: "error", code: code || 0 });
  }
}
