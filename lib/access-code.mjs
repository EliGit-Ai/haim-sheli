// קודי גישה לאפליקציה. קוד נראה כך: full.<מזהה אקראי>.<חתימה>
// הקוד לא מכיל מייל או שם, רק את רמת הגישה ומזהה אקראי, חתום בסוד ACCESS_SECRET.
// משמש גם את השרת (lib/access.ts) וגם את הסקריפט שמנפיק קודים (scripts/mint-access.mjs).

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const TIERS = ["full"];

const b64url = buf => Buffer.from(buf).toString("base64url");

function signature(secret, tier, id) {
  return b64url(createHmac("sha256", secret).update(`haim-sheli:v1:${tier}:${id}`).digest().subarray(0, 18));
}

export function mintCode(secret, tier = "full") {
  if (!secret || secret.length < 32) throw new Error("ACCESS_SECRET must be at least 32 characters");
  if (!TIERS.includes(tier)) throw new Error(`unknown tier ${tier}`);
  const id = b64url(randomBytes(9));
  return `${tier}.${id}.${signature(secret, tier, id)}`;
}

// returns the tier ("full") for a valid code, otherwise null
export function verifyCode(secret, code) {
  if (!secret || typeof code !== "string" || code.length > 100) return null;
  const parts = code.trim().split(".");
  if (parts.length !== 3) return null;
  const [tier, id, sig] = parts;
  if (!TIERS.includes(tier) || !/^[\w-]{12}$/.test(id)) return null;
  const expected = Buffer.from(signature(secret, tier, id));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return tier;
}
