// גישה לטבלת push_subscriptions ב-Supabase, דרך ה-REST API עם מפתח השרת (service role).
// הטבלה סגורה לגמרי מבחוץ (RLS בלי מדיניות), ורק השרת ניגש אליה.
// משתני סביבה: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import type { Sub } from "./push-schedule";

export type Row = Sub & { id: string; endpoint: string; p256dh: string; auth: string };

function cfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { base: `${url.replace(/\/$/, "")}/rest/v1/push_subscriptions`, key };
}

export const dbReady = () => cfg() !== null;

async function call(path: string, init: RequestInit & { prefer?: string } = {}) {
  const c = cfg();
  if (!c) throw new Error("Supabase is not configured");
  const res = await fetch(c.base + path, {
    ...init,
    headers: {
      apikey: c.key,
      authorization: `Bearer ${c.key}`,
      "content-type": "application/json",
      ...(init.prefer ? { prefer: init.prefer } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text().catch(() => "")}`);
  return res;
}

export async function upsert(row: Omit<Row, "id" | "last_morning" | "last_midday" | "last_evening">) {
  await call("?on_conflict=endpoint", {
    method: "POST",
    body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

export async function removeByEndpoint(endpoint: string) {
  await call(`?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "DELETE", prefer: "return=minimal" });
}

export async function removeById(id: string) {
  await call(`?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" });
}

export async function listAll(): Promise<Row[]> {
  const out: Row[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const res = await call(`?select=*&order=id&offset=${from}&limit=${page}`);
    const rows = (await res.json()) as Row[];
    out.push(...rows);
    if (rows.length < page) return out;
  }
}

export async function markSent(id: string, fields: Partial<Pick<Row, "last_morning" | "last_midday" | "last_evening">>) {
  await call(`?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(fields), prefer: "return=minimal" });
}
