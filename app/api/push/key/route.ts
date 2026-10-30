import { NextResponse } from "next/server";

// המפתח הציבורי של ההתראות (VAPID). האפליקציה צריכה אותו כדי להירשם.
export const dynamic = "force-dynamic";

export function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key || !process.env.SUPABASE_URL) return NextResponse.json({ enabled: false });
  return NextResponse.json({ enabled: true, key });
}
