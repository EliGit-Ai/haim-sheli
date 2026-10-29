/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        // דף הבית מוגש מתוך דף הנחיתה הסטטי ב-public/index.html
        { source: "/", destination: "/index.html" },
        // האפליקציה למובייל (PWA) מוגשת מתוך public/app/index.html
        { source: "/app", destination: "/app/index.html" },
      ],
    };
  },
  async headers() {
    return [
      {
        // ה-service worker והדף של האפליקציה תמיד נבדקים מחדש, כדי שעדכונים יגיעו מהר
        source: "/app-sw.js",
        headers: [{ key: "cache-control", value: "no-cache" }],
      },
      {
        source: "/app",
        headers: [
          { key: "cache-control", value: "no-cache" },
          { key: "referrer-policy", value: "no-referrer" },
          { key: "x-content-type-options", value: "nosniff" },
          { key: "permissions-policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/app/manifest.webmanifest",
        headers: [{ key: "content-type", value: "application/manifest+json" }],
      },
    ];
  },
};

export default nextConfig;
