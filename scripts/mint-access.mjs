// מנפיק קוד גישה לתוכנית המלאה ומדפיס קישור הפעלה לאפליקציה.
// שימוש:
//   ACCESS_SECRET=... node scripts/mint-access.mjs          -> קוד אחד
//   ACCESS_SECRET=... node scripts/mint-access.mjs 20       -> 20 קודים
// ה-ACCESS_SECRET חייב להיות זהה לזה שמוגדר ב-Vercel, אחרת הקודים לא יעבדו באתר.
// כשהסליקה תחובר, אותה פונקציה (mintCode) תרוץ אוטומטית אחרי תשלום ותישלח במייל.

import { mintCode } from "../lib/access-code.mjs";

const secret = process.env.ACCESS_SECRET;
const count = Math.max(1, Math.min(500, Number(process.argv[2]) || 1));
const base = process.env.APP_URL || "https://haim-sheli.com/app";

if (!secret) {
  console.error("חסר ACCESS_SECRET. דוגמה: ACCESS_SECRET=... node scripts/mint-access.mjs");
  process.exit(1);
}

for (let i = 0; i < count; i++) {
  const code = mintCode(secret, "full");
  console.log(`${base}?k=${code}`);
}
