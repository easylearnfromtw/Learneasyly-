/* Lightweight deployment checks: no npm dependencies. */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assets = ["index.html", "styles.css", "app.js", "fx.js", "glass.js", "cube.js", "sw.js", "icon.svg", "icon-maskable.svg", "manifest.webmanifest", "privacy.html", "data/exams.json"];
for (const file of assets) assert.ok(fs.existsSync(path.join(root, file)), "Missing public asset " + file);
const html = read("index.html"), css = read("styles.css"), script = read("app.js"), sw = read("sw.js");

/* Brand assets must be deployed as actual raster images for social crawlers.
   The deploy workflow runs scripts/build-brand-assets.py before this check. */
const BRAND_FILES = [
  "icon.svg", "icon-maskable.svg", "brand/og-wide.svg",
  "brand/og-square.svg", "brand/pinned-tab.svg",
  "sitemap.xml", "assets/favicon.ico", "assets/apple-touch-icon.png",
  "assets/icon-16.png", "assets/icon-32.png", "assets/icon-48.png",
  "assets/icon-192.png", "assets/icon-512.png",
  "assets/icon-maskable-192.png", "assets/icon-maskable-512.png",
  "assets/og-image.jpg", "assets/social-square.jpg"
];
for (const file of BRAND_FILES)
  assert.ok(fs.existsSync(path.join(root, file)), "Missing branding asset " + file);
for (const page of [html, read("privacy.html")]) {
  assert.ok(page.includes('property="og:image" content="https://easylearnfromtw.github.io/Learneasyly-/assets/og-image.jpg"'), "OG image must be an absolute public JPEG URL");
  assert.ok(page.includes('name="twitter:card" content="summary_large_image"'), "Missing Twitter large image card");
  assert.ok(page.includes('rel="canonical"'), "Missing canonical URL");
  assert.ok(page.includes('rel="apple-touch-icon"'), "Missing Apple touch icon");
  assert.ok(page.includes('property="og:image:width" content="1200"'), "Incorrect OG preview width");
  assert.ok(page.includes('property="og:image:height" content="630"'), "Incorrect OG preview height");
}
const brandManifest = JSON.parse(read("manifest.webmanifest"));
assert.ok(brandManifest.icons.some(x => x.src === "./assets/icon-512.png"), "Missing 512px PWA icon");
assert.ok(brandManifest.icons.some(x => x.src === "./assets/icon-maskable-512.png"), "Missing maskable icon");
assert.ok(html.includes('type="application/ld+json"'), "Missing structured application data");
const gif = fs.readFileSync(path.join(root, "assets/og-image.jpg"));
assert.ok(gif.length > 1000 && gif[0] === 255 && gif[1] === 216, "OG image is not JPEG");
const png = fs.readFileSync(path.join(root, "assets/icon-512.png"));
assert.ok(png.length > 1000 && png.subarray(1,4).toString() === "PNG", "PWA icon is not PNG");

const extras = ["fx.js", "glass.js", "cube.js"].map((f) => [f, read(f)]);

/* Pages and element references */
for (const name of ["overview", "add", "library", "review", "study", "analytics", "admit", "settings"]) assert.ok(html.includes('id="page-' + name + '"'), "Missing page " + name);
const dynamicIds = new Set(["loadMoreQuestions", "reviewCard", "lensMap", "katexStyle"]);
const accessed = [...script.matchAll(/\$\("([A-Za-z][A-Za-z0-9_-]+)"\)/g)].map((m) => m[1]);
for (const id of new Set(accessed)) assert.ok(html.includes('id="' + id + '"') || dynamicIds.has(id), "JavaScript references missing HTML element #" + id);
for (const fn of ["saveQuestion", "renderReview", "renderAnalytics", "exportBackup", "importBackup", "offerDraft", "storageStatus", "ensureOCR", "checkAchievements", "celebrate", "ask", "doCheckIn", "openCheckin", "autoSave", "flushSave", "scheduleDaily", "resolveExam", "examSessions", "fetchExams", "tmStart", "tmFinish", "renderPlan", "autoPlan", "renderAdmit", "evalDept"]) assert.ok(script.includes("function " + fn + "("), "Missing " + fn);
assert.ok(!/\b(confirm|alert)\(/.test(script), "Use the in-app dialog instead of confirm or alert");
assert.ok(!html.includes("tesseract.min.js"), "OCR should be loaded only when needed");
for (const f of ["fx.js", "glass.js", "cube.js", "app.js"]) assert.ok(html.includes('src="./' + f + '"'), "index.html must load " + f);
for (const f of assets.filter((f) => !f.endsWith(".webmanifest") || true)) if (f !== "sw.js") assert.ok(sw.includes("./" + f), "Service worker shell should cache " + f);
assert.ok(css.includes("@media (max-width:680px)"), "Mobile styles missing");
assert.ok(css.includes('[data-theme="dark"]'), "Dark theme tokens missing");
assert.ok(css.includes("prefers-reduced-motion"), "Reduced motion support missing");
assert.ok(!/orbit/i.test(html + css), "Decorative orbit rings were removed on purpose");

/* Data files the app reads */
const exams = JSON.parse(read("data/exams.json"));
for (const id of ["gsat", "ast", "cap", "tcte"]) assert.ok(exams.exams && exams.exams[id] && exams.exams[id].sessions.length >= 3, "exams.json needs sessions for " + id);
if (fs.existsSync(path.join(root, "data/caac.json"))) { const caac = JSON.parse(read("data/caac.json")); assert.ok(Array.isArray(caac.depts) && caac.schools, "caac.json shape"); }
const privacy = read("privacy.html");
for (const id of ["privacy", "terms", "sources", "licenses"]) assert.ok(privacy.includes('id="' + id + '"'), "privacy.html section " + id);
assert.ok(html.includes("./privacy.html"), "index.html should link the privacy policy");

/* Syntax */
new vm.Script(script, { filename: "app.js" });
new vm.Script(sw, { filename: "sw.js" });
for (const [f, src] of extras) new vm.Script(src, { filename: f });

/* Manifest */
const manifest = JSON.parse(read("manifest.webmanifest"));
assert.equal(manifest.display, "standalone");
assert.ok(manifest.start_url.startsWith("./"));

/* No punctuation in anything a person reads */
const BANNED = /[，。、；：？！「」『』（）《》〈〉…—–·～,.;:!?()"'\-\/|]/;
const problems = [];
function check(where, text) {
  const t = text.replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
  if (t && BANNED.test(t)) problems.push(where + " -> " + t);
}
function lintHTML(label, src) {
let body = src.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<head>[\s\S]*?<\/head>/, (h) => {
  const title = (h.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  check(label + " title", title);
  const desc = (h.match(/name="description" content="([^"]*)"/) || [])[1] || "";
  check(label + " meta description", desc);
  return "";
});
for (const m of body.matchAll(/\s(placeholder|aria-label|title|alt|data-grid)="([^"]*)"/g)) check(label + " attr " + m[1], m[2]);
for (const m of body.matchAll(/>([^<>]+)</g)) check(label + " text", m[1]);
}
lintHTML("index", html);
lintHTML("privacy", privacy);
const cjk = /[㐀-鿿]/;
for (const [file, src] of [["app.js", script]].concat(extras)) {
  for (const m of src.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/g)) {
    const lit = m[1] != null ? m[1] : m[2];
    if (!cjk.test(lit)) continue;
    for (const a of lit.matchAll(/(?:title|aria-label|alt|placeholder)="([^"]*)"/g)) check(file + " attribute", a[1]);
    let t = lit.replace(/<[^>]*>/g, " ");
    t = t.replace(/^[^<>]*>/, " ").replace(/<[^<>]*$/, " ");
    t = t.replace(/[\w-]+="[^"]*"/g, " ").replace(/^\s*"/, " ").replace(/[\w-]+="\s*$/, " ");
    check(file + " string", t.replace(/[{}]/g, "").replace(/\\n/g, " "));
  }
}
check("manifest name", manifest.name); check("manifest description", manifest.description);
(manifest.shortcuts || []).forEach((s) => { check("manifest shortcut", s.name); check("manifest shortcut", s.short_name); });
assert.equal(problems.length, 0, "Punctuation found in visible text\n" + problems.join("\n"));

console.log("PASS: pages, element links, lazy OCR, dialogs, dark mode, PWA shell, data files, privacy policy, syntax and no punctuation in visible text.");
