#!/usr/bin/env node
/* Learn Angle admission data updater.
   Builds data/caac.json from University TW (https://university-tw.ldkrsi.men/caac/), which publishes
   each department's personal application screening standards and last year's first-stage results.
   Runs from GitHub Actions. Polite crawling: identifies itself, low concurrency, small delays,
   respects robots.txt (only /search and /go-to/ are disallowed), and does a full crawl only when the
   data is missing, the site moves to a new year, or the data is older than 30 days.
   Usage: node scripts/update-admission.mjs [--full] [--limit N] */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "caac.json");
const BASE = "https://university-tw.ldkrsi.men/caac/";
const UA = "LearnAngleBot/1.0 (+https://github.com/easylearnfromtw/Learneasyly-)";
const args = process.argv.slice(2);
const FULL = args.includes("--full");
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) || 0 : 0;
const CONCURRENCY = 3, DELAY = 300, MAX_AGE_DAYS = 30;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 25000);
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "zh-TW,zh;q=0.9" }, signal: ctl.signal });
      if (res.status === 404) return "";
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } catch (e) {
      if (i === tries - 1) throw new Error(url + " " + e.message);
      await sleep(1500 * (i + 1));
    } finally { clearTimeout(timer); }
  }
  return "";
}
const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const strip = (s) => decode(String(s).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/* HTML tables to rows of cell text with the nearest heading text before each table */
function tables(html) {
  const out = [];
  const re = /<table\b[\s\S]*?<\/table>/gi;
  let m;
  while ((m = re.exec(html))) {
    const before = strip(html.slice(Math.max(0, m.index - 1500), m.index)).slice(-160);
    const rows = [];
    for (const tr of m[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
      const cells = [...tr[0].matchAll(/<t([hd])\b([^>]*)>([\s\S]*?)<\/t\1>/gi)].map((c) => ({ text: strip(c[3]), head: c[1].toLowerCase() === "h", html: c[3] }));
      if (cells.length) rows.push(cells);
    }
    out.push({ before, rows, html: m[0] });
  }
  return out;
}
/* 7 subject keys used by the app */
function subjKey(h) {
  h = h.replace(/\s/g, "");
  if (/英聽|聽力/.test(h)) return "英聽";
  if (/相加/.test(h)) return "sum";
  if (/數學?A/.test(h)) return "數A";
  if (/數學?B/.test(h)) return "數B";
  if (/^國/.test(h)) return "國";
  if (/^英/.test(h)) return "英";
  if (/^社/.test(h)) return "社";
  if (/^自/.test(h)) return "自";
  return "";
}
const LEVEL = /頂|前|均|後|底/;
function parseDept(html, code, schoolCode, schoolName) {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const tm = strip(title).match(/(\d{3})年(.+?)個人申請/);
  if (!tm) return null;
  const year = Number(tm[1]);
  let name = tm[2].trim();
  if (schoolName && name.startsWith(schoolName)) name = name.slice(schoolName.length).trim();
  const text = strip(html);
  const quota = Number((text.match(/招收人數\s*[:：]?\s*(\d+)/) || [])[1]) || 0;
  const dep = { c: code, s: schoolCode, n: name, q: quota, std: {}, mul: [], res: null };
  for (const tb of tables(html)) {
    const head = tb.rows.find((r) => r.some((c) => subjKey(c.text)));
    const flat = tb.rows.map((r) => r.map((c) => c.text));
    if (tb.rows.some((r) => r.some((c) => /篩選一/.test(c.text)))) {
      const hi = tb.rows.findIndex((r) => r.some((c) => /篩選一/.test(c.text)));
      const hdr = tb.rows[hi].map((c) => c.text), row = (tb.rows[hi + 1] || []).map((c) => c.text);
      const st = []; let over = false;
      hdr.forEach((h, i) => {
        const v = (row[i] || "").replace(/\s/g, "");
        if (/超額/.test(h)) { over = /有|是/.test(v); return; }
        const mm = v.match(/^([國英數AB社自+＋總級分]+)=(\d{1,2})$/);
        if (/篩選/.test(h) && mm) st.push([mm[1].replace(/＋/g, "+"), Number(mm[2])]);
      });
      const ry = Number(((tb.before + " " + flat.join(" ")).match(/(\d{3})\s*年\s*篩選結果/) || [])[1]) || year - 1;
      if (st.length) dep.res = { y: ry, st, x: over ? 1 : 0 };
      continue;
    }
    if (!head) continue;
    const keys = head.map((c) => subjKey(c.text));
    const rowFor = tb.rows.find((r) => r !== head && new RegExp("^" + year + "$").test((r[0] && r[0].text) || ""));
    if (!rowFor) continue;
    const isStd = rowFor.slice(1).some((c) => LEVEL.test(c.text)) || (keys.includes("英聽") && !keys.includes("sum"));
    const isMul = !isStd && (keys.includes("sum") || rowFor.slice(1).some((c) => /^\d+(\.\d+)?$/.test(c.text.trim())));
    const cells = rowFor.map((c) => c.text);
    const off = cells.length - keys.length;
    keys.forEach((k, i) => {
      if (!k) return;
      const v = (cells[i + off] || "").trim();
      if (!v || /^-+$|^--$/.test(v)) return;
      if (isStd && !isMul) {
        if (k === "英聽") { const g = v.match(/[ABC]/); if (g) dep.std["英聽"] = g[0]; }
        else { const l = v.match(LEVEL); if (l) dep.std[k] = l[0]; }
      } else if (isMul) {
        if (k === "sum") { const mm = v.match(/([\d.]+)\s*[（(]\s*([^）)]+)[)）]/); if (mm) dep.mul.push([(mm[2].match(/數A|數B|國|英|社|自/g) || []).join("+"), Number(mm[1])]); }
        else { const n = Number(v); if (n) dep.mul.push([k, n]); }
      }
    });
  }
  return { dep, year };
}

async function pool(items, fn) {
  const out = []; let i = 0;
  async function worker() { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k).catch((e) => { console.warn(e.message); return null; }); await sleep(DELAY); } }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}

async function main() {
  if (args.includes("--parse")) {
    const file = args[args.indexOf("--parse") + 1], html = await fs.readFile(file, "utf8");
    console.log(JSON.stringify(parseDept(html, "000000", "000", args[args.indexOf("--parse") + 2] || ""), null, 1));
    return;
  }
  let prev = null;
  try { prev = JSON.parse(await fs.readFile(OUT, "utf8")); } catch (e) {}
  const index = await get(BASE);
  const siteYear = Number((strip((index.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "").match(/(\d{3})年/) || [])[1]) || 0;
  const age = prev && prev.updatedAt ? (Date.now() - Date.parse(prev.updatedAt)) / 86400000 : Infinity;
  const need = FULL || !prev || prev.sample || !Array.isArray(prev.depts) || prev.depts.length < 500 || (siteYear && prev.year !== siteYear) || age > MAX_AGE_DAYS;
  if (!need) { console.log("admission data is fresh", prev.year, prev.depts.length, "departments", Math.round(age), "days old"); return; }

  /* School index */
  const schools = {};
  for (const m of index.matchAll(/<a\b[^>]*href=["'](?:https?:\/\/university-tw\.ldkrsi\.men)?\/caac\/(j?\d{3})\/?["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const name = strip(m[2]).replace(/^[(（]?\s*j?\d{3}\s*[)）]?\s*/, "").trim();
    if (name && !schools[m[1]]) schools[m[1]] = name;
  }
  let codes = Object.keys(schools);
  console.log("schools", codes.length, "site year", siteYear);
  if (codes.length < 30) throw new Error("school index looks wrong");

  /* Department lists */
  const deptRefs = [];
  await pool(codes, async (sc) => {
    const html = await get(BASE + sc + "/");
    const seen = new Set();
    for (const m of html.matchAll(/href=["'](?:https?:\/\/university-tw\.ldkrsi\.men)?\/caac\/(j?\d{3})\/([0-9A-Za-z]{6})\/?["']/g)) {
      if (m[1] !== sc || seen.has(m[2])) continue;
      seen.add(m[2]); deptRefs.push({ sc, code: m[2] });
    }
    if (!seen.size) for (const m of html.matchAll(/href=["']\.?\/?(\d{6})\/?["']/g)) { if (!seen.has(m[1])) { seen.add(m[1]); deptRefs.push({ sc, code: m[1] }); } }
  });
  const refs = LIMIT ? deptRefs.slice(0, LIMIT) : deptRefs;
  console.log("departments", deptRefs.length, LIMIT ? "limited to " + refs.length : "");

  /* Department pages */
  let year = siteYear;
  const parsed = await pool(refs, async (r) => {
    const html = await get(BASE + r.sc + "/" + r.code);
    if (!html) return null;
    const p = parseDept(html, r.code, r.sc, schools[r.sc]);
    if (p && p.year) year = year || p.year;
    return p ? p.dep : null;
  });
  const depts = parsed.filter(Boolean);
  const withRes = depts.filter((d) => d.res).length, withStd = depts.filter((d) => Object.keys(d.std).length).length;
  console.log("parsed", depts.length, "with results", withRes, "with standards", withStd);
  if (!LIMIT && (depts.length < 500 || withRes < 200)) throw new Error("parsed too few departments, keeping the previous file");

  const resYear = depts.find((d) => d.res) ? depts.find((d) => d.res).res.y : year - 1;
  const usedSchools = {}; depts.forEach((d) => { usedSchools[d.s] = schools[d.s]; });
  const out = { v: 1, source: "University TW", url: BASE, year, resYear, updatedAt: new Date().toISOString().slice(0, 10), schools: usedSchools, depts };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(out));
  console.log("wrote", OUT, (JSON.stringify(out).length / 1024).toFixed(0) + " KB");
}
main().catch((e) => { console.error("admission update failed:", e.message); process.exit(1); });
