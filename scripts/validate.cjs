/* Lightweight deployment checks: no npm dependencies. */
const fs=require("node:fs");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const html=read("index.html"),css=read("styles.css"),script=read("app.js"),sw=read("sw.js");
for(const file of ["index.html","styles.css","app.js","sw.js","icon.svg","manifest.webmanifest"]){
  assert.ok(fs.existsSync(path.join(root,file)),"Missing public asset "+file);
}
for(const name of ["overview","add","library","review","analytics","settings"]){
  assert.ok(html.includes('id="page-'+name+'"'),"Missing page "+name);
}
const dynamicIds=new Set(["loadMoreQuestions"]);
const accessed=[...script.matchAll(/\$\("([A-Za-z][A-Za-z0-9_-]+)"\)/g)].map(m=>m[1]);
for(const id of new Set(accessed))assert.ok(html.includes('id="'+id+'"')||dynamicIds.has(id),"JavaScript references missing HTML element #"+id);
for(const fn of ["saveQuestion","renderReview","renderAnalytics","exportBackup","importBackup","offerDraft","storageStatus","ensureOCR"]){
  assert.ok(script.includes("function "+fn+"("),"Missing "+fn);
}
assert.ok(!html.includes("tesseract.min.js"),"OCR should be loaded only when needed");
assert.ok(css.includes("@media(max-width:680px)"),"Mobile styles missing");
new vm.Script(script,{filename:"app.js"});
new vm.Script(sw,{filename:"sw.js"});
const manifest=JSON.parse(read("manifest.webmanifest"));
assert.equal(manifest.display,"standalone");
assert.ok(manifest.start_url.startsWith("./"));
console.log("PASS: required pages, elements, scripts, lazy OCR, syntax and PWA manifest.");
