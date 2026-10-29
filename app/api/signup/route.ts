import { NextResponse } from "next/server";

// הרשמה לאתגר החינמי: שומר את איש הקשר ב-Brevo עם שלוש שאלות הפרופיל.
// נדרשים משתני סביבה ב-Vercel:
//   BREVO_API_KEY  - מפתח API של Brevo
//   BREVO_LIST_ID  - מספר הרשימה שאליה נכנסים הנרשמים
// ושלוש תכונות (Attributes) מסוג Boolean ב-Brevo: SHABBAT, IN_RELATIONSHIP, HAS_KIDS

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Answer = "yes" | "no";
const isAnswer = (v: unknown): v is Answer => v === "yes" || v === "no";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "הבקשה לא תקינה." }, { status: 400 });
  }

  // שדה מלכודת לבוטים: אדם אמיתי לא רואה אותו ולא ממלא אותו
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const { shabbat, relationship, kids, consent } = body;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "כתובת המייל לא נראית תקינה. כדאי לבדוק אותה שוב." }, { status: 400 });
  }
  if (!isAnswer(shabbat) || !isAnswer(relationship) || !isAnswer(kids)) {
    return NextResponse.json({ error: "צריך לענות על שלוש השאלות." }, { status: 400 });
  }
  if (consent !== true) {
    return NextResponse.json({ error: "צריך לאשר קבלת מיילים מהתוכנית, אחרת לא נוכל לשלוח לך את הימים." }, { status: 400 });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_LIST_ID);
  if (!apiKey || !Number.isInteger(listId) || listId <= 0) {
    console.error("signup: BREVO_API_KEY or BREVO_LIST_ID is missing");
    return NextResponse.json({ error: "ההרשמה עוד לא פתוחה. נסה שוב בקרוב." }, { status: 503 });
  }

  const res = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      email,
      listIds: [listId],
      updateEnabled: true,
      attributes: {
        SHABBAT: shabbat === "yes",
        IN_RELATIONSHIP: relationship === "yes",
        HAS_KIDS: kids === "yes",
      },
    }),
  });

  if (res.ok) {
    return NextResponse.json({ ok: true });
  }

  const detail = await res.text().catch(() => "");
  console.error("signup: Brevo error", res.status, detail);
  return NextResponse.json({ error: "משהו השתבש בשמירת ההרשמה. נסה שוב בעוד רגע." }, { status: 502 });
}
