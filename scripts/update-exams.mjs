#!/usr/bin/env node
/* Learn Angle exam calendar updater
   Runs daily from GitHub Actions but only does real work on Mondays or when an exam is less than
   two weeks away, so typhoon postponements are caught quickly.

   Order of trust, highest first
   1 data/exam-overrides.json   edited by a human, always wins (typhoon postponements and corrections)
   2 official sources            ceec.edu.tw  tcte.edu.tw  techadmi.edu.tw  edu.tw  k12ea.gov.tw  cap.rcpet.edu.tw
   3 confirmed dates             KNOWN below and official dates already in data/exams.json
   4 estimates                   rules fitted to 112 to 116

   Secondary sites never write dates. When one shows a date we do not have, it is written to the review
   file so the workflow can open a GitHub issue for a person to check.

   Every parsed date must sit in a sentence with the exam name, be in the expected month, and if the page
   states a weekday it must match the real weekday. robots.txt is honoured for every host.
   Usage  node scripts/update-exams.mjs [--offline] [--force] */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "exams.json");
const OVERRIDES = path.join(ROOT, "data", "exam-overrides.json");
const REVIEW = process.env.REVIEW_FILE || "";
const OFFLINE = process.argv.includes("--offline");
const FORCE = process.argv.includes("--force");
const UA = "LearnAngleBot/1.1 (+https://github.com/easylearnfromtw/Learneasyly-)";

/* m month  sat range for the estimate Saturday  off offset from that Saturday  time first session start */
const TYPES = {
  gsat: { name: "學測", full: "學科能力測驗", m: 1, sat: [17, 23], off: -1, days: 3, time: "09:20", keys: ["學科能力測驗", "學測"] },
  tcte: { name: "統測", full: "四技二專統一入學測驗", m: 4, sat: [24, 30], off: 0, days: 2, time: "10:20", keys: ["四技二專統一入學測驗", "統一入學測驗", "統測"] },
  cap: { name: "會考", full: "國中教育會考", m: 5, sat: [15, 21], off: 0, days: 2, time: "08:30", keys: ["國中教育會考", "會考"] },
  ast: { name: "分科測驗", full: "大學分科測驗", m: 7, sat: [8, 14], off: 0, days: 2, time: "08:40", keys: ["分科測驗"] }
};
const LUNAR_NEW_YEAR = { 2027: "2027-02-06", 2028: "2028-01-26", 2029: "2029-02-13", 2030: "2030-02-03", 2031: "2031-01-23", 2032: "2032-02-11", 2033: "2033-01-31" };
/* Confirmed from official announcements on 2026-10-13 */
const KNOWN = {
  gsat: { 116: { start: "2027-01-22", end: "2027-01-24", time: "09:20", timeStatus: "official", src: "https://www.ceec.edu.tw/files/file_pool/1/0q215601929252011195/116%E5%AD%B8%E5%B9%B4%E5%BA%A6%E7%B0%A1%E7%AB%A0.pdf", quote: "考試日期 116年1月22日至1月24日" } },
  ast: { 116: { start: "2027-07-10", end: "2027-07-11", time: "08:40", timeStatus: "official", src: "https://www.ceec.edu.tw/files/file_pool/1/0q215601929252011195/116%E5%AD%B8%E5%B9%B4%E5%BA%A6%E7%B0%A1%E7%AB%A0.pdf", quote: "116.07.10 至 07.11 分科測驗考試" } },
  cap: { 116: { start: "2027-05-15", end: "2027-05-16", time: "08:30", timeStatus: "provisional", src: "https://cap.rcpet.edu.tw/NEAC/ExamDescriptions/ExamInfo-1", quote: "教育部115年7月6日臺教授國部字第1155502031號函 116年5月15日至5月16日" } },
  tcte: { 116: { start: "2027-04-24", end: "2027-04-25", time: "10:20", timeStatus: "provisional", src: "https://www.tcte.edu.tw/index.php?mod=TVETest%2FSelfSelectSubject", quote: "116年統測日期為116年4月24日至116年4月25日" } }
};
/* Official pages  follow means links on the page whose text matches are fetched too  pdf parsing needs pdfjs-dist */
const SOURCES = {
  gsat: [{ url: "https://www.ceec.edu.tw/", follow: /學年度.*(考試簡章|暫定報名與考試日期|考試日期|重要日程)/ }, { url: "https://ap.ceec.edu.tw/RegExam/ExamInfo/A" }],
  ast: [{ url: "https://www.ceec.edu.tw/", follow: /學年度.*(考試簡章|暫定報名與考試日期|考試日期|重要日程)/ }, { url: "https://ap.ceec.edu.tw/RegExam/ExamInfo/B" }],
  tcte: [{ url: "https://www.tcte.edu.tw/index.php?mod=TVETest%2FSelfSelectSubject" }, { url: "https://www.tcte.edu.tw/index.php?mod=TVETest/info4y" }, { url: "https://www.tcte.edu.tw/NetServer/{ay}list_4y/" },
    { url: "https://www.techadmi.edu.tw/bbs-list.php", follow: /四技二專統一入學測驗.*(日程|考試日期)/ }],
  cap: [{ url: "https://cap.rcpet.edu.tw/NEAC/ExamDescriptions/ExamInfo-1" }, { url: "https://www.edu.tw/News.aspx?n=9E7AC85F1954DDA8&sms=169B8E91BB75571F", follow: /國中教育會考/ },
    { url: "https://www.k12ea.gov.tw/Tw/News/K12eaNews?filter=9F92BBB7-0251-4CB7-BF06-82385FD996A0", follow: /會考/ }]
};
const OFFICIAL_HOSTS = /(^|\.)(ceec\.edu\.tw|tcte\.edu\.tw|techadmi\.edu\.tw|jctv\.ntut\.edu\.tw|edu\.tw|k12ea\.gov\.tw|cap\.rcpet\.edu\.tw)$/;
/* Secondary mirrors only produce review notes */
const SECONDARY = { cap: ["https://12basic.tp.edu.tw/jhexam/"], gsat: [], ast: [], tcte: [] };

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const weekday = (s) => new Date(s + "T00:00:00Z").getUTCDay();
const WD = { 日: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
function estimate(id, ay) {
  const t = TYPES[id], y = ay + 1911;
  for (let d = t.sat[0]; d <= t.sat[1]; d++) {
    const dt = new Date(Date.UTC(y, t.m - 1, d));
    if (dt.getUTCDay() !== 6) continue;
    let sat = iso(dt);
    if (id === "gsat" && LUNAR_NEW_YEAR[y] && addDays(sat, 2) > addDays(LUNAR_NEW_YEAR[y], -7)) sat = addDays(sat, -7);
    const start = addDays(sat, t.off);
    return { ay, start, end: addDays(start, t.days - 1), time: t.time, status: "estimated", timeStatus: "estimated", official: false };
  }
  return null;
}

/* robots.txt  rules for user agent star or ours  longest match wins */
const robotsCache = new Map();
async function robotsAllows(url) {
  const u = new URL(url);
  if (!robotsCache.has(u.host)) {
    let rules = null;
    try {
      const res = await fetch(u.origin + "/robots.txt", { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
      if (res.status >= 500) rules = "deny";
      else if (!res.ok) rules = [];
      else {
        rules = []; let applies = false, sawAgent = false;
        for (const raw of (await res.text()).split(/\r?\n/)) {
          const line = raw.replace(/#.*/, "").trim(); if (!line) continue;
          const [k, ...rest] = line.split(":"); const key = k.trim().toLowerCase(), val = rest.join(":").trim();
          if (key === "user-agent") { if (!sawAgent) applies = false; sawAgent = true; if (val === "*" || /learnangle/i.test(val)) applies = true; continue; }
          sawAgent = false;
          if (applies && (key === "allow" || key === "disallow") && val) rules.push({ allow: key === "allow", path: val });
        }
      }
    } catch (e) { rules = "deny"; }
    robotsCache.set(u.host, rules);
  }
  const rules = robotsCache.get(u.host);
  if (rules === "deny") return false;
  const p = u.pathname + u.search;
  let best = null;
  for (const r of rules) {
    const pat = r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$");
    if (new RegExp("^" + pat).test(p) && (!best || r.path.length > best.path.length)) best = r;
  }
  return !best || best.allow;
}

async function get(url) {
  if (!(await robotsAllows(url))) { console.log("robots.txt disallows", url); return null; }
  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "zh-TW,zh;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(res.status + " " + url);
  const type = res.headers.get("content-type") || "";
  if (/pdf/i.test(type) || /\.pdf($|\?)/i.test(url)) return { pdf: new Uint8Array(await res.arrayBuffer()) };
  if (!/html|text/.test(type)) return null;
  return { html: await res.text() };
}
let pdfjs = null, pdfjsTried = false;
async function pdfText(bytes) {
  if (!pdfjsTried) { pdfjsTried = true; try { pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs"); } catch (e) { console.log("pdfjs-dist not installed  PDF files are skipped"); } }
  if (!pdfjs) return "";
  const base = path.join(ROOT, "node_modules", "pdfjs-dist");
  const doc = await pdfjs.getDocument({ data: bytes, cMapUrl: base + "/cmaps/", cMapPacked: true, standardFontDataUrl: base + "/standard_fonts/", disableFontFace: true, useSystemFonts: false, isEvalSupported: false }).promise;
  let out = "";
  for (let i = 1; i <= Math.min(doc.numPages, 12); i++) { const c = await (await doc.getPage(i)).getTextContent(); out += c.items.map((x) => x.str).join("") + "\n"; }
  return out;
}
const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const normalize = (s) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 65248)).replace(/[ \t　]+/g, " ");
const textOf = (html) => normalize(decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|td)>/gi, "\n").replace(/<[^>]+>/g, " ")));
function links(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try { const u = new URL(decode(m[1]), base); if (/^https?:$/.test(u.protocol)) out.push({ url: u.href, text: textOf(m[2]).trim() }); } catch (e) {}
  }
  return out;
}

/* Date patterns  ROC year plus 1911 */
const W = "(?:\\s*[（(]\\s*(?:星期|週)?([一二三四五六日])(?:\\s*[、與和]\\s*(?:星期|週)?[一二三四五六日])?\\s*[)）])?";
const PATTERNS = [
  /* 116年1月22日（五）至1月24日（日）  or  116年4月24日(六)至116年4月25日(日) */
  new RegExp("(\\d{3})\\s*年\\s*(\\d{1,2})\\s*月\\s*(\\d{1,2})\\s*日" + W + "\\s*(?:至|到|~|～|－|—|-)\\s*(?:\\d{3}\\s*年\\s*)?(?:(\\d{1,2})\\s*月\\s*)?(\\d{1,2})\\s*日?" + W, "g"),
  /* 116.01.22(五)~01.24(日) */
  /(\d{3})\.(\d{2})\.(\d{2})\s*\(([一二三四五六日])\)\s*[~～]\s*(\d{2})\.(\d{2})\s*\(([一二三四五六日])\)/g,
  /* 116年5月15、16日(星期六、日)  or  5月15日與5月16日 */
  new RegExp("(\\d{3})\\s*年\\s*(\\d{1,2})\\s*月\\s*(\\d{1,2})\\s*(?:日\\s*)?[、,，與和及]\\s*(?:\\d{1,2}\\s*月\\s*)?(\\d{1,2})\\s*日" + W, "g")
];
function parseMatch(kind, m) {
  if (kind === 0) return { roc: +m[1], mo: +m[2], d: +m[3], w1: m[4], mo2: m[5] ? +m[5] : +m[2], d2: +m[6], w2: m[7] };
  if (kind === 1) return { roc: +m[1], mo: +m[2], d: +m[3], w1: m[4], mo2: +m[5], d2: +m[6], w2: m[7] };
  return { roc: +m[1], mo: +m[2], d: +m[3], w1: m[5], mo2: +m[2], d2: +m[4] };
}
function findDates(id, text, src) {
  const t = TYPES[id], found = [];
  const sentences = text.split(/[。\n！；]/);
  for (const sen of sentences) {
    if (!t.keys.some((k) => sen.includes(k))) continue;
    if (/報名|繳費|放榜|成績|複查|試場|說明會/.test(sen) && !/考試日期|舉行|辦理|考試日程/.test(sen)) continue;
    PATTERNS.forEach((re, kind) => {
      re.lastIndex = 0; let m;
      while ((m = re.exec(sen))) {
        const p = parseMatch(kind, m);
        if (p.mo !== t.m && !(id === "tcte" && p.mo === 5)) continue;
        const y = p.roc + 1911, start = y + "-" + pad(p.mo) + "-" + pad(p.d), end = y + "-" + pad(p.mo2) + "-" + pad(p.d2);
        if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || end < start || end > addDays(start, 4)) continue;
        if (p.w1 && WD[p.w1] !== weekday(start)) { console.log("weekday mismatch skipped", id, start, p.w1, src); continue; }
        if (p.w2 && WD[p.w2] !== weekday(end)) { console.log("weekday mismatch skipped", id, end, p.w2, src); continue; }
        found.push({ ay: p.roc, start, end, src, quote: sen.trim().slice(0, 120) });
      }
    });
  }
  return found;
}

async function readSource(id, src, sink) {
  const seen = new Set();
  const visit = async (url, follow, depth) => {
    if (seen.has(url)) return; seen.add(url);
    let got = null;
    try { got = await get(url); } catch (e) { console.warn("skip", url, e.message); return; }
    if (!got) return;
    if (got.pdf) { try { sink.push(...findDates(id, normalize(await pdfText(got.pdf)), url)); } catch (e) { console.warn("pdf failed", url, e.message); } return; }
    sink.push(...findDates(id, textOf(got.html), url));
    if (follow && depth < 1) {
      for (const l of links(got.html, url).filter((l) => follow.test(l.text)).slice(0, 8)) { await new Promise((r) => setTimeout(r, 500)); await visit(l.url, null, depth + 1); }
    }
  };
  await visit(src.url, src.follow, 0);
}

function selftest() {
  const cases = [
    ["gsat", "116 學年度學科能力測驗考試日期：116 年1 月22 日（五）至1 月24 日（日）。", "2027-01-22", "2027-01-24"],
    ["ast", "116.07.10(六)~07.11(日) 分科測驗考試", "2027-07-10", "2027-07-11"],
    ["cap", "116年國中教育會考考試日期訂於116年5月15、16日(星期六、日)辦理", "2027-05-15", "2027-05-16"],
    ["cap", "116年國中教育會考考試日期訂於116年5月15日與5月16日（星期六與日）辦理", "2027-05-15", "2027-05-16"],
    ["tcte", "116年統測日期為116年4月24日(六)至116年4月25日(日)。", "2027-04-24", "2027-04-25"],
    ["gsat", "116學年度學科能力測驗報名日期 115年10月28日至11月11日", null, null],
    ["cap", "116年國中教育會考考試日期訂於116年5月15日（星期五）至5月16日（星期日）", null, null]
  ];
  let bad = 0;
  for (const [id, text, s1, e1] of cases) {
    const f = findDates(id, text, "test")[0];
    const ok = s1 ? f && f.start === s1 && f.end === e1 : !f;
    if (!ok) { bad++; console.log("FAIL", id, text, f); }
  }
  const est = estimate("gsat", 117), cap = estimate("cap", 117), tc = estimate("tcte", 117);
  console.log("estimates 117", est.start, cap.start, tc.start, estimate("ast", 117).start);
  if (est.start !== "2028-01-14" || cap.start !== "2028-05-20" || tc.start !== "2028-04-29") { bad++; console.log("FAIL estimates"); }
  console.log(bad ? bad + " failed" : "selftest passed");
  process.exit(bad ? 1 : 0);
}
async function main() {
  if (process.argv.includes("--selftest")) return selftest();
  let prev = {}, overrides = {};
  try { prev = JSON.parse(await fs.readFile(OUT, "utf8")); } catch (e) {}
  try { overrides = JSON.parse(await fs.readFile(OVERRIDES, "utf8")); } catch (e) {}
  const now = new Date(), todayIso = iso(new Date(now.getTime() + 8 * 3600000)), y0 = now.getUTCFullYear() - 1911;

  /* Daily schedule  real work only on Monday or within 14 days of an exam */
  const soon = Object.values(prev.exams || {}).some((e) => (e.sessions || []).some((s) => s.start >= todayIso && s.start <= addDays(todayIso, 14)));
  const monday = new Date(now.getTime() + 8 * 3600000).getUTCDay() === 1;
  const crawl = !OFFLINE && (FORCE || monday || soon || !prev.exams);
  if (!crawl && !OFFLINE) console.log("no crawl today  not Monday and no exam within 14 days");

  const out = { v: 2, updatedAt: prev.updatedAt || todayIso, checkedAt: crawl ? todayIso : prev.checkedAt || todayIso,
    note: "status 為 official 官方公告 provisional 暫定 estimated 依往年規則推估 exam-overrides.json 會覆蓋所有來源", exams: {} };
  const review = [];
  for (const id of Object.keys(TYPES)) {
    const map = new Map();
    for (let ay = y0; ay <= y0 + 4; ay++) { const e = estimate(id, ay); if (e) map.set(ay, e); }
    const old = prev.exams && prev.exams[id] && Array.isArray(prev.exams[id].sessions) ? prev.exams[id].sessions : [];
    for (const s of old) if (s && (s.status === "official" || s.official === true) && Number.isInteger(s.ay)) map.set(s.ay, Object.assign({}, s, { status: "official", official: true }));
    for (const [ay, v] of Object.entries(KNOWN[id] || {})) map.set(Number(ay), Object.assign({ ay: Number(ay), status: "official", official: true }, v, map.get(Number(ay)) && map.get(Number(ay)).official ? { start: map.get(Number(ay)).start, end: map.get(Number(ay)).end } : {}));
    if (crawl) {
      const found = [];
      for (const src of SOURCES[id] || []) {
        if (src.url.includes("{ay}")) { for (const ay of [y0 + 1, y0 + 2]) await readSource(id, { url: src.url.replace("{ay}", ay) }, found); }
        else await readSource(id, src, found);
      }
      for (const f of found) {
        if (!OFFICIAL_HOSTS.test(new URL(f.src).hostname)) continue;
        const cur = map.get(f.ay);
        if (cur && cur.official && cur.start === f.start && cur.end === f.end) { cur.src = cur.src || f.src; continue; }
        if (cur && cur.official && (cur.start !== f.start || cur.end !== f.end)) { review.push({ id, ay: f.ay, kind: "changed", have: cur.start + " " + cur.end, saw: f.start + " " + f.end, src: f.src, quote: f.quote }); continue; }
        console.log("official date found", id, f.ay, f.start, f.end, f.src);
        map.set(f.ay, { ay: f.ay, start: f.start, end: f.end, time: (cur && cur.time) || TYPES[id].time, timeStatus: "provisional", status: "official", official: true, src: f.src, quote: f.quote });
      }
      for (const url of SECONDARY[id] || []) {
        const sec = []; await readSource(id, { url }, sec);
        for (const f of sec) { const cur = map.get(f.ay); if (!cur || !cur.official || cur.start !== f.start) review.push({ id, ay: f.ay, kind: "secondary", saw: f.start + " " + f.end, src: f.src, quote: f.quote }); }
      }
    }
    /* Human overrides win over everything */
    const ov = overrides.exams && overrides.exams[id] ? overrides.exams[id] : {};
    for (const [ay, v] of Object.entries(ov)) {
      if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v.start || "")) continue;
      const cur = map.get(Number(ay)) || { ay: Number(ay) };
      map.set(Number(ay), Object.assign({}, cur, { start: v.start, end: v.end || v.start, time: v.time || cur.time || TYPES[id].time, status: "official", official: true, timeStatus: v.time ? "official" : cur.timeStatus || "provisional", note: v.note || "", src: v.src || "exam-overrides.json" }));
    }
    const sessions = [...map.values()].filter((s) => s.end >= addDays(todayIso, -400) && (s.status !== "estimated" || s.end >= todayIso)).sort((a, b) => a.start.localeCompare(b.start));
    out.exams[id] = { name: TYPES[id].name, full: TYPES[id].full, time: TYPES[id].time, sessions };
  }
  if (REVIEW && review.length) {
    const body = review.map((r) => "- " + TYPES[r.id].name + " " + r.ay + " " + (r.kind === "changed" ? "官方頁面出現不同日期 目前 " + r.have + " 看到 " + r.saw : "次要來源出現新日期 " + r.saw) + "\n  來源 " + r.src + "\n  原文 " + r.quote).join("\n");
    await fs.writeFile(REVIEW, "自動更新發現需要人工確認的考試日期 確認後請編輯 data/exam-overrides.json\n\n" + body + "\n");
    console.log("review notes written", review.length);
  }
  const same = prev.exams && JSON.stringify(prev.exams) === JSON.stringify(out.exams);
  if (same) {
    if (crawl && prev.checkedAt !== todayIso) { prev.checkedAt = todayIso; await fs.writeFile(OUT, JSON.stringify(prev, null, 2) + "\n"); console.log("dates unchanged  check date updated"); }
    else console.log("exam dates unchanged");
    return;
  }
  out.updatedAt = todayIso;
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log("wrote", OUT);
}
main().catch((e) => { console.error(e); process.exit(1); });
