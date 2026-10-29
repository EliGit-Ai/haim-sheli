// בונה את content/program.json מתוך ייצוא Markdown של המסמך "חיים שלי – מבנה התוכנית".
// שימוש: node scripts/build-program.mjs path/to/program.md
// מריצים שוב בכל פעם שהתוכן במסמך משתנה, ובודקים את הפלט לפני שמעלים.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/build-program.mjs <program.md>");
  process.exit(1);
}
const md = readFileSync(src, "utf8").replace(/\r\n/g, "\n");
const lines = md.split("\n");

// ---------- helpers ----------
const clean = s => s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
const stripQuotes = s => s.replace(/^["“”]+/, "").replace(/["“”]+$/, "");
const dash = "[–—-]";

// splits the markdown into "## heading" sections
function sections() {
  const out = [];
  let cur = null;
  for (const line of lines) {
    const m = /^(#{1,3})\s+(.*)$/.exec(line);
    if (m) {
      cur = { level: m[1].length, title: m[2].trim(), body: [] };
      out.push(cur);
    } else if (cur) cur.body.push(line);
  }
  return out;
}
const all = sections();

// ---------- week names and day titles from the structure part ----------
const weeks = []; // {name, from, to}
const titles = {}; // day -> title
for (const s of all) {
  const w = new RegExp(`^שבוע (\\d+) ${dash} (.+?) \\(ימים (\\d+)${dash}(\\d+)\\)$`).exec(s.title);
  if (!w) continue;
  const from = +w[3], to = +w[4];
  weeks.push({ week: +w[1], name: w[2].trim(), from, to });
  let i = 0;
  for (const line of s.body) {
    const numbered = /^\d+\.\s+\*\*(.+?):\*\*/.exec(line);
    const bulleted = new RegExp(`^[-*]\\s+\\*\\*יום (\\d+) ${dash} (.+?):\\*\\*`).exec(line);
    if (bulleted) titles[+bulleted[1]] = bulleted[2].trim();
    else if (numbered) { titles[from + i] = numbered[1].trim(); i++; }
  }
}
for (const s of all) {
  const d = new RegExp(`^יום (\\d+) ${dash} (.+)$`).exec(s.title);
  if (s.level === 3 && d) titles[+d[1]] = d[2].trim();
}

// ---------- interactive blocks ----------
// a step/evening paragraph becomes a list of blocks:
//   {type:"text", text}
//   {type:"choice", prompt, options:[...], multi}
//   {type:"rating", key, prompt}
function ratingKey(q) {
  if (/שליטה/.test(q)) return "control";
  if (/ביטחון|בטוח/.test(q)) return "confidence";
  if (/לאן|כיוון/.test(q)) return "direction";
  return null;
}

function parseInteractive(raw) {
  let text = clean(raw);
  const multi = /יותר מאחת|אחד או יותר|אחת או יותר/.test(text);
  const blocks = [];

  // ratings: "מאחד עד עשר, כמה ...? כמה ...? וכמה ...?"
  const r = /מאחד עד עשר,?\s*/.exec(text);
  if (r) {
    const before = text.slice(0, r.index).trim();
    let after = text.slice(r.index + r[0].length);
    // the questions run while each clause ends with "?"
    const qs = [];
    let m;
    const qre = /^([^?.]*?\?)\s*/;
    while ((m = qre.exec(after)) && !/ \/ /.test(m[1])) {
      qs.push(m[1].trim());
      after = after.slice(m[0].length);
    }
    if (qs.length) {
      if (before) blocks.push({ type: "text", text: before });
      for (const q of qs) {
        // "ותוסיף עוד אחת: מאחד עד עשר, כמה..." -> "כמה..."
        const prompt = q.replace(/^.*מאחד עד עשר,?\s*/, "").replace(/^ו(?=כמה)/, "");
        blocks.push({ type: "rating", key: ratingKey(prompt), prompt: prompt.charAt(0).toUpperCase() + prompt.slice(1) });
      }
      text = after.trim();
    }
  }

  while (text) {
    const slash = text.indexOf(" / ");
    if (slash === -1) { blocks.push({ type: "text", text }); break; }
    const head = text.slice(0, slash);
    // when the options are themselves questions ("מה...? / איך...?"), the prompt ends at ":"
    const cut = head.endsWith("?") ? head.lastIndexOf(":") : Math.max(head.lastIndexOf(":"), head.lastIndexOf("?"));
    let prompt, optStart;
    if (cut >= 0) { prompt = head.slice(0, cut + 1).trim(); optStart = cut + 1; }
    else {
      const b = Math.max(head.lastIndexOf(". "), -1);
      prompt = b >= 0 ? head.slice(0, b + 1).trim() : "";
      optStart = b >= 0 ? b + 2 : 0;
    }
    const rest = text.slice(optStart);
    // the run "A / B / C" ends at the first sentence end after its last slash
    const sentenceEnd = from => {
      const re = /[.?](?=\s|$)(?! \/ )/g;
      re.lastIndex = from;
      const m = re.exec(rest);
      return m ? m.index : -1;
    };
    let p = rest.indexOf(" / ");
    let end;
    for (;;) {
      const nextSlash = rest.indexOf(" / ", p + 3);
      const nextEnd = sentenceEnd(p + 3);
      if (nextSlash !== -1 && (nextEnd === -1 || nextSlash < nextEnd)) { p = nextSlash; continue; }
      end = nextEnd === -1 ? rest.length : nextEnd + 1;
      break;
    }
    const optionsRaw = rest.slice(0, end).trim().replace(/[.]$/, "");
    const options = optionsRaw.split(" / ").map(o => o.trim().replace(/[.]$/, "")).filter(Boolean);
    if (prompt) {
      // a leading instruction sentence before the actual question stays as text
      blocks.push({ type: "choice", prompt, options, multi });
    } else {
      blocks.push({ type: "choice", prompt: "", options, multi });
    }
    text = rest.slice(end).trim();
  }
  return blocks;
}

// ---------- day content ----------
function parseDayBody(body) {
  const paras = body.join("\n").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const narration = [];
  let step = null, evening = null;
  for (const p of paras) {
    if (p.startsWith("**הצעד של היום:**")) step = p.replace("**הצעד של היום:**", "").trim();
    else if (p.startsWith("**שאלה לערב:**")) evening = p.replace("**שאלה לערב:**", "").trim();
    else narration.push(stripQuotes(clean(p)));
  }
  return {
    narration: narration.filter(Boolean),
    step: step ? { raw: clean(step), blocks: parseInteractive(step) } : null,
    evening: evening ? { raw: clean(evening), blocks: parseInteractive(evening) } : null,
  };
}

const days = {};
const alternates = { noRelationship: {}, noKids: {} };
for (const s of all) {
  let m = new RegExp(`^תוכן ${dash} יום (\\d+)(?::\\s*(.+?))? \\(טקסט להקראה\\)$`).exec(s.title);
  if (m) {
    const n = +m[1];
    days[n] = { day: n, title: (m[2] || titles[n] || "").trim(), ...parseDayBody(s.body) };
    continue;
  }
  m = new RegExp(`^תוכן ${dash} ימים (\\d+)${dash}(\\d+): (.+)$`).exec(s.title);
  if (m) {
    for (let n = +m[1]; n <= +m[2]; n++) days[n] = { day: n, title: m[3].trim(), rest: true, ...parseDayBody(s.body) };
    continue;
  }
  m = new RegExp(`^חלופי \\((ללא זוגיות|ללא ילדים)\\) ${dash} יום (\\d+): (.+?) \\(טקסט להקראה\\)$`).exec(s.title);
  if (m) {
    const n = +m[2];
    const bucket = m[1] === "ללא זוגיות" ? alternates.noRelationship : alternates.noKids;
    bucket[n] = { day: n, title: m[3].trim(), ...parseDayBody(s.body) };
  }
}

// ---------- day 1: the starting point questions live in the narration ----------
if (days[1] && !days[1].step) {
  const keep = [], qs = [];
  for (const p of days[1].narration) {
    if (/מאחד עד עשר|מה זה בשבילך להיות גבר מוגשם/.test(p)) qs.push(p); else keep.push(p);
  }
  days[1].narration = keep;
  days[1].step = {
    raw: qs.join(" "),
    title: "נקודת הפתיחה",
    blocks: [
      { type: "text", text: "תענה בכנות, רק לעצמך." },
      { type: "rating", key: "control", prompt: "כמה אתה מרגיש בשליטה היום?" },
      { type: "rating", key: "confidence", prompt: "כמה ביטחון?" },
      { type: "rating", key: "direction", prompt: "וכמה אתה יודע לאן אתה הולך?" },
      { type: "choice", key: "fulfilled", prompt: "מה זה בשבילך להיות גבר מוגשם?", options: ["גבר מוביל", "שיודע להתפשר", "שאוהב בלי גבולות", "שחי לפי הערכים שלו"], multi: true },
      { type: "text", text: "התשובות נשמרות רק בטלפון שלך. ביום התשעים נחזור אליהן." },
    ],
  };
}
// day 89 asks the same "fulfilled" question: give it the same key so the app can compare
for (const b of days[89]?.step?.blocks || []) {
  if (b.type === "choice" && b.options.includes("גבר מוביל")) { b.key = "fulfilled"; b.multi = true; }
}

// ---------- midday reminders ----------
const reminders = {}, altReminders = { noRelationship: {}, noKids: {} };
{
  let mode = null, target = reminders;
  for (const line of lines) {
    if (/^# תזכורות אמצע היום/.test(line)) { mode = "main"; target = reminders; continue; }
    if (/^## תזכורות לגרסאות החלופיות/.test(line)) { mode = "alt"; continue; }
    if (/^#/.test(line) && mode) { mode = null; continue; }
    if (!mode) continue;
    if (mode === "alt") {
      if (/למי שלא בזוגיות/.test(line)) target = altReminders.noRelationship;
      if (/למי שאין לו ילדים/.test(line)) target = altReminders.noKids;
    }
    const m = /^[-*]\s+\*\*יום (\d+):\*\*\s*(.+)$/.exec(line);
    if (m) target[+m[1]] = clean(m[2]);
  }
}
for (const [n, t] of Object.entries(reminders)) if (days[n]) days[n].midday = t;
for (const k of Object.keys(alternates))
  for (const [n, t] of Object.entries(altReminders[k])) if (alternates[k][n]) alternates[k][n].midday = t;

// ---------- weeks / months meta ----------
const restWeek = { week: 0, name: "מנוחה ותרגול חופשי", from: 59, to: 60 };
const openWeek = { week: 0, name: "ימי פתיחה", from: 1, to: 3 };
const allWeeks = [openWeek, ...weeks, restWeek].sort((a, b) => a.from - b.from);
const altWeeks = { noRelationship: { 9: "הגבר לפני הזוגיות", 10: "תקשורת ומפגש" } };
const monthOf = n => (n <= 30 ? 1 : n <= 60 ? 2 : 3);

const list = [];
for (let n = 1; n <= 90; n++) {
  const d = days[n];
  if (!d) throw new Error(`missing content for day ${n}`);
  const w = allWeeks.find(w => n >= w.from && n <= w.to);
  d.week = w?.week || 0;
  d.weekName = w?.name || "";
  d.month = monthOf(n);
  list.push(d);
}
for (const k of Object.keys(alternates))
  for (const d of Object.values(alternates[k])) {
    const w = allWeeks.find(w => d.day >= w.from && d.day <= w.to);
    d.week = w?.week || 0;
    d.weekName = altWeeks[k]?.[d.week] || w?.name || "";
    d.month = monthOf(d.day);
  }

// raw text is only for checking the parse; drop it from the output
const strip = d => {
  if (process.env.KEEP_RAW) return d;
  for (const part of ["step", "evening"]) if (d[part]) delete d[part].raw;
  return d;
};

const out = {
  version: 1,
  generatedFrom: "חיים שלי – מבנה התוכנית",
  months: [
    { month: 1, name: "שקט ושליטה" },
    { month: 2, name: "ביטחון וכיוון" },
    { month: 3, name: "הגשמה" },
  ],
  days: list.map(strip),
  alternates: {
    noRelationship: Object.values(alternates.noRelationship).map(strip),
    noKids: Object.values(alternates.noKids).map(strip),
  },
};

const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, "../content/program.json");
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${dest}: ${out.days.length} days, ${out.alternates.noRelationship.length}+${out.alternates.noKids.length} alternates`);
