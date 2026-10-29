# חיים שלי

## האפליקציה למובייל (`/app`)

אפליקציה שמתקינים למסך הבית (PWA), בלי חנות אפליקציות. הגבר קורא את היום, בוחר את הצעד ועונה על שאלת הערב.

- **פרטיות:** כל התשובות נשמרות רק במכשיר (localStorage). השרת לא מקבל ולא שומר שום תשובה, ואין אנליטיקס. הבקשה היחידה לשרת היא הורדת התוכן (`/api/program`).
- **גיבוי:** בהגדרות אפשר לשמור קובץ גיבוי ולשחזר ממנו בטלפון חדש.
- **גישה:** בלי קוד פתוחים 3 ימי האתגר. קוד גישה פותח את כל 90 הימים והגרסאות החלופיות (ללא זוגיות / ללא ילדים).
- **שבת:** מי שענה "שומר שבת" מקבל את היום של שבת כבר ביום שישי.

### הגדרה ב-Vercel

`ACCESS_SECRET` – מחרוזת אקראית של 32 תווים לפחות. בלעדיה רק הימים החינמיים זמינים.

### קודי גישה

```bash
ACCESS_SECRET=... npm run mint-access        # קישור הפעלה אחד
ACCESS_SECRET=... npm run mint-access -- 20  # 20 קישורים
```

הקישור נראה כך: `https://haim-sheli.com/app?k=full....`. הקוד לא מכיל מייל או שם.

### עדכון התוכן

התוכן נמצא ב-`content/program.json`, ונבנה מייצוא Markdown של המסמך "חיים שלי – מבנה התוכנית":

```bash
npm run build-program -- path/to/program.md
```

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
