/* Learn Angle 稜角 第三版
   純前端 資料只存在本機 IndexedDB 不使用任何外部使用者資料服務
   介面文字刻意不使用標點符號 以空白與排版分隔語句 */
(function () {
  "use strict";

  /* 常數 */
  const DB_NAME = "learneasyly-local-v1";
  const DB_VERSION = 1;
  const DEFAULT_DATE = "2027-01-22";
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const TABS = ["overview", "add", "library", "review", "study", "analytics", "admit", "settings"];
  const COLOR_BANK = {
    "數學 A": "#2e7d5b", "數學 B": "#23898a", "國文": "#c2452d", "英文": "#4058b8", "物理": "#2f7fc1", "化學": "#8a55c2", "生物": "#4e9a3a", "地球科學": "#c08419",
    "歷史": "#9a5b3c", "地理": "#6f8b2e", "公民": "#c24e7a", "其他": "#6b7a74", "數學甲": "#2e7d5b", "數學乙": "#23898a", "英語": "#4058b8", "數學": "#2e7d5b",
    "自然": "#2f7fc1", "社會": "#9a5b3c", "寫作": "#c24e7a", "專業一": "#8a55c2", "專業二": "#c08419"
  };
  const SUBJECT_SETS = {
    gsat: ["數學 A", "數學 B", "國文", "英文", "物理", "化學", "生物", "地球科學", "歷史", "地理", "公民", "其他"],
    ast: ["數學甲", "數學乙", "物理", "化學", "生物", "歷史", "地理", "公民", "國文", "英文", "其他"],
    cap: ["國文", "英語", "數學", "自然", "社會", "寫作", "其他"],
    tcte: ["國文", "英文", "數學", "專業一", "專業二", "其他"]
  };
  let SUBJECTS = SUBJECT_SETS.gsat.map((n) => [n, COLOR_BANK[n]]);
  const SUBJECT_COLOR = Object.assign({}, COLOR_BANK);
  const inSubjects = (n) => SUBJECTS.some((s) => s[0] === n);
  const firstSubject = () => SUBJECTS[0][0];

  /* 目標考試 官方公告日期 之後由 data/exams.json 自動更新 */
  /* time 是第一天第一節開考時刻 會考與統測沿用 115 年考程 新考程公布後由資料檔更新 */
  const EXAM_TYPES = {
    gsat: { name: "學測", full: "學科能力測驗", note: "大學入學", unit: "學年度", m: 1, sat: [17, 23], off: -1, days: 3, time: "09:20", level: "高中學測", color: "#2f5f8f" },
    tcte: { name: "統測", full: "四技二專統一入學測驗", note: "技術型高中", unit: "學年度", m: 4, sat: [24, 30], off: 0, days: 2, time: "10:20", level: "四技二專統測", color: "#a0711a" },
    cap: { name: "會考", full: "國中教育會考", note: "國中升高中", unit: "年", m: 5, sat: [15, 21], off: 0, days: 2, time: "08:30", level: "國中教育會考", color: "#b5442f" },
    ast: { name: "分科測驗", full: "大學分科測驗", note: "原本的指考", unit: "學年度", m: 7, sat: [8, 14], off: 0, days: 2, time: "08:40", level: "大學分科測驗", color: "#2f7a74" }
  };
  const EXAM_IDS = ["gsat", "ast", "cap", "tcte"];
  /* 官方公告 學測與分科 大考中心 116 學年度考試簡章 會考 教育部 115年7月6日函 統測 教育部 115年7月17日備查 */
  const EXAM_BUILTIN = {
    gsat: { 116: { start: "2027-01-22", end: "2027-01-24", time: "09:20", timeOfficial: true } },
    ast: { 116: { start: "2027-07-10", end: "2027-07-11", time: "08:40", timeOfficial: true } },
    cap: { 116: { start: "2027-05-15", end: "2027-05-16", time: "08:30", timeOfficial: false } },
    tcte: { 116: { start: "2027-04-24", end: "2027-04-25", time: "10:20", timeOfficial: false } }
  };
  /* 學測會避開農曆年 用春節日期調整推估 */
  const LUNAR_NEW_YEAR = { 2027: "2027-02-06", 2028: "2028-01-26", 2029: "2029-02-13", 2030: "2030-02-03", 2031: "2031-01-23", 2032: "2032-02-11", 2033: "2033-01-31" };

  /* 讀書計時 */
  const KINDS = ["寫題目", "讀課本", "背單字", "訂正錯題", "寫考古題", "上課聽講", "整理筆記", "其他"];
  const FOCUS_MSG = ["記下 {m} 分鐘", "又完成一段 {m} 分鐘的專注", "{m} 分鐘的認真 都會留下痕跡", "這 {m} 分鐘 你比昨天更靠近目標"];
  const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

  /* 115 學年度學測 五標與級分人數百分比累計 來源 大考中心 */
  const GSAT = {
    year: 115,
    subj: [["國", "國文", "#c2452d"], ["英", "英文", "#4058b8"], ["數A", "數學A", "#2e7d5b"], ["數B", "數學B", "#23898a"], ["社", "社會", "#9a5b3c"], ["自", "自然", "#2f7fc1"]],
    five: { "國": [13, 12, 10, 9, 7], "英": [13, 11, 8, 5, 3], "數A": [12, 10, 8, 5, 4], "數B": [11, 9, 5, 3, 2], "社": [13, 12, 10, 8, 7], "自": [13, 12, 9, 7, 5] },
    cum: {
      "國": [2.17, 7.18, 17.18, 31.90, 49.30, 65.72, 78.81, 87.67, 92.92, 95.92, 97.65, 98.68, 99.47, 99.96, 99.99, 100],
      "英": [2.76, 8.24, 15.71, 23.72, 31.80, 39.53, 46.98, 54.21, 61.31, 68.65, 76.65, 86.32, 96.11, 99.80, 99.99, 100],
      "數A": [1.23, 3.35, 7.09, 12.61, 18.84, 28.54, 39.98, 50.11, 62.41, 73.39, 82.82, 89.56, 95.95, 99.28, 99.98, 100],
      "數B": [1.29, 3.32, 5.95, 9.33, 13.77, 19.97, 26.25, 33.41, 41.24, 49.86, 60.91, 72.62, 86.46, 96.38, 99.83, 100],
      "社": [1.90, 6.44, 14.57, 27.54, 42.17, 58.24, 71.76, 82.00, 89.60, 94.22, 97.77, 99.50, 99.94, 99.98, 99.99, 100],
      "自": [2.99, 8.60, 16.66, 26.73, 37.74, 49.01, 59.18, 68.34, 76.42, 83.88, 90.67, 96.33, 99.47, 99.98, 99.99, 100]
    },
    n: { "國": 118026, "英": 118169, "數A": 90579, "數B": 97536, "社": 97889, "自": 78382 }
  };
  const FIVE_NAMES = ["頂標", "前標", "均標", "後標", "底標"];
  const FIVE_KEY = { "頂": 0, "前": 1, "均": 2, "後": 3, "底": 4 };
  const CHANCE = { safe: "機會高", maybe: "有機會", reach: "挑戰", out: "差距較大", nostd: "未達檢定", miss: "缺少成績" };
  const ADMIT_GROUPS = [
    ["醫藥衛生", /醫|牙|藥|護理|治療|檢驗|公共衛生|營養|獸醫|放射|聽語/], ["資訊電機", /資訊|資工|電機|電子|光電|通訊|資料科學|人工智慧|半導體/],
    ["理工", /數學|物理|化學|工程|機械|材料|土木|化工|航太|地球|大氣|地質|海洋|環境|統計/], ["商管", /管理|企業|會計|財務|金融|經濟|財政|貿易|經營|行銷|保險|商|觀光|餐旅/],
    ["文史哲", /文學|語文|外文|英語|英國語|日本語|歷史|哲學|語言|中文/], ["法政社會", /法律|政治|社會|行政|外交|地政|民族|勞工/],
    ["傳播藝術", /傳播|新聞|廣告|廣電|設計|藝術|音樂|美術|戲劇|舞蹈|建築|影像|創意/], ["教育心理", /教育|心理|輔導|幼兒|體育|運動/],
    ["生農", /生命|生物|農|森林|動物|園藝|植物|昆蟲|食品|生化|水產|漁業/]
  ];
  const REASONS = ["觀念不清", "計算失誤", "審題錯誤", "時間不足", "完全不會", "其他"];
  const LEVELS = { 1: "基礎 一看就懂", 2: "偏易 稍微想一下", 3: "中等 需要想一下", 4: "偏難 需要整合觀念", 5: "挑戰 大考壓軸等級" };
  const INTERVALS = [3, 7, 14, 30, 60, 90];
  const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  const LABELS = { overview: "總覽", add: "新增錯題", library: "錯題資料庫", review: "今日複習", study: "讀書計畫", analytics: "學習分析", admit: "落點預估", settings: "設定與備份" };

  const QUOTES = [
    "慢慢來 {比較快}", "會錯的題目 {才是你的題目}", "把一題弄懂 {勝過十題略過}", "今天的錯題 {是明天的分數}",
    "{穩定} 比衝刺更有力量", "你比昨天 {更接近目標了}", "卡住不可怕 {放棄才可惜}", "{專心眼前這一題} 就好",
    "錯誤是 {最誠實的老師}", "每天進步一點點 {一百天就很多點}", "{先求懂} 再求快", "不會的地方 {就是分數藏著的地方}"
  ];
  const MSG = {
    save: ["收錄完成 明天見", "又抓到一個弱點 很好", "每一題錯誤都是線索", "這題明天會變簡單一點", "收進錯題本 就是進步的開始"],
    good: ["答對了 紅筆打勾", "漂亮 記憶正在變牢固", "這題你已經收服了", "手感很好 繼續保持", "答對 複習間隔拉長了"],
    hard: ["模糊也是進步 兩天後再見", "差一點點 再看一次就會了", "有印象了 下次會更清楚"],
    again: ["沒關係 卡住的地方就是成長的起點", "明天再挑戰一次 你會更快", "承認不會 是學會的第一步"],
    daily: ["今日練習已記錄 辛苦了", "記錄完成 數字會替你說話"],
    done: ["把該做的都做完了 這就是實力", "今天的你 很可靠", "一題一題累積 你正在變強"]
  };
  const ACH = [
    { id: "first", t: "第一題", d: "收錄第一道錯題", ic: "i-pen", c: 0, k: "total", n: 1, u: "題" },
    { id: "ten", t: "十題成冊", d: "累積十道錯題", ic: "i-book", c: 0, k: "total", n: 10, u: "題" },
    { id: "fifty", t: "半百題庫", d: "累積五十道錯題", ic: "i-stack", c: 0, k: "total", n: 50, u: "題" },
    { id: "hundred", t: "百題大全", d: "累積一百道錯題", ic: "i-layers", c: 0, k: "total", n: 100, u: "題" },
    { id: "rev1", t: "初次複習", d: "完成第一次重做", ic: "i-refresh", c: 1, k: "reviews", n: 1, u: "次" },
    { id: "rev50", t: "複習五十", d: "累積重做五十次", ic: "i-cards", c: 1, k: "reviews", n: 50, u: "次" },
    { id: "rev300", t: "複習三百", d: "累積重做三百次", ic: "i-bolt", c: 1, k: "reviews", n: 300, u: "次" },
    { id: "master1", t: "首次掌握", d: "第一題連續答對兩次", ic: "i-leaf", c: 2, k: "mastered", n: 1, u: "題" },
    { id: "master20", t: "二十題掌握", d: "掌握二十道錯題", ic: "i-star", c: 2, k: "mastered", n: 20, u: "題" },
    { id: "hard", t: "挑戰者", d: "掌握一題難度4以上", ic: "i-trophy", c: 2, k: "hard", n: 1, u: "題" },
    { id: "streak3", t: "三日不輟", d: "連續學習三天", ic: "i-flame", c: 3, k: "best", n: 3, u: "天" },
    { id: "streak7", t: "七日習慣", d: "連續學習七天", ic: "i-flame", c: 3, k: "best", n: 7, u: "天" },
    { id: "streak30", t: "三十日恆心", d: "連續學習三十天", ic: "i-flame", c: 3, k: "best", n: 30, u: "天" },
    { id: "goal", t: "目標達成", d: "完成一次每日目標", ic: "i-check", c: 4, k: "goalDays", n: 1, u: "天" },
    { id: "goal10", t: "十日達標", d: "累積十天完成每日目標", ic: "i-trophy", c: 4, k: "goalDays", n: 10, u: "天" },
    { id: "subjects", t: "全科出擊", d: "錯題涵蓋五個科目", ic: "i-star", c: 5, k: "subjects", n: 5, u: "科" },
    { id: "backup", t: "備份守護", d: "完成第一次備份", ic: "i-shield", c: 5, k: "backup", n: 1, u: "次" },
    { id: "ck1", t: "第一枚印章", d: "完成第一次每日打卡", ic: "i-stamp", c: 3, k: "ckTotal", n: 1, u: "天" },
    { id: "ck7", t: "打卡一週", d: "連續打卡七天", ic: "i-stamp", c: 3, k: "ckBest", n: 7, u: "天" },
    { id: "ck30", t: "打卡一個月", d: "連續打卡三十天", ic: "i-stamp", c: 3, k: "ckBest", n: 30, u: "天" },
    { id: "ck100", t: "百日印章", d: "累積打卡一百天", ic: "i-trophy", c: 4, k: "ckTotal", n: 100, u: "天" },
    { id: "early", t: "早起的鳥", d: "早上七點前完成打卡", ic: "i-sun", c: 4, k: "ckEarly", n: 1, u: "次" },
    { id: "focus1", t: "第一段專注", d: "完成第一次讀書計時", ic: "i-timer", c: 1, k: "sessions", n: 1, u: "次" },
    { id: "pomo10", t: "番茄達人", d: "完成十個番茄鐘", ic: "i-bolt", c: 3, k: "pomos", n: 10, u: "個" },
    { id: "focus10h", t: "專注十小時", d: "讀書計時累積十小時", ic: "i-timer", c: 4, k: "focusHours", n: 10, u: "小時" },
    { id: "plan10", t: "照表操課", d: "完成十個讀書排程", ic: "i-plan", c: 2, k: "planDone", n: 10, u: "個" }
  ];
  const MOODS = [["精神很好", "#2f8a62"], ["普通", "#6b7a74"], ["有點累", "#c08419"], ["壓力大", "#c2452d"]];
  const CK_MSG = ["蓋好章了 今天也一起努力", "打卡完成 先從最想做的那件事開始", "今天的你 已經比昨天多走一步", "印章蓋下去 今天就是認真的一天"];
  const CK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200];
  const ACH_COLORS = [["#7fb2e3", "#2f5f8f"], ["#5b9be0", "#24518a"], ["#8ccfc0", "#2f7a74"], ["#ff8a5c", "#c2412d"], ["#f3c84b", "#c88a12"], ["#a77fe0", "#5b3a9a"]];

  /* 狀態 */
  const S = {
    db: null, questions: [], reviews: [], daily: [], cfg: {},
    examDate: DEFAULT_DATE, nickname: "", goal: 8, theme: "auto", effects: true, haptics: true, achievements: null,
    image: "", visuals: [], editing: null, reviewing: null, revealed: false, tab: "overview", pageSize: 24,
    libStatus: "all", libSubject: "", reviewSubject: "", skipped: new Set(),
    session: { done: 0, good: 0, combo: 0, best: 0 }, modalList: [], modalIndex: -1,
    cheer: -1, ignorePop: 0, flashId: null,
    exam: null, examsData: null, timer: null, plans: [], planWeek: "", planDay: "", logDay: "", scores: {}, caac: null, caacLoading: null,
    admitChance: "safe", admitGroup: "", admitShow: 30, fav: []
  };
  const UI = {};

  /* 小工具 */
  const $ = (id) => document.getElementById(id);
  const all = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[x]));
  const safeImage = (s) => (typeof s === "string" && /^data:image\/(png|jpeg|webp);base64,/i.test(s) ? s : "");
  const normalizedVisuals = (arr) => Array.isArray(arr) ? arr.slice(0, 12).map((v) => ({
    id: String(v && v.id || uid()).slice(0, 100),
    kind: v && v.kind === "chart" ? "chart" : "illustration",
    image: safeImage(v && v.image),
    original: safeImage(v && v.original),
    title: String(v && v.title || "").slice(0, 80),
    chartType: ["line", "bar", "scatter"].includes(v && v.chartType) ? v.chartType : "line",
    xAxis: String(v && v.xAxis || "").slice(0, 40),
    yAxis: String(v && v.yAxis || "").slice(0, 40),
    chartData: String(v && v.chartData || "").slice(0, 2500)
  })).filter((v) => v.image) : [];
  function visualHTML(q) {
    const list = normalizedVisuals(q && q.visuals);
    if (!list.length) return "";
    return '<div class="visual-read"><h3>圖像區塊</h3><div class="visual-read-grid">' + list.map((v) =>
      '<figure class="visual-read-item"><img src="' + v.image + '" alt="' + esc(v.kind === "chart" ? "重製圖表" : "示意圖片") + '" data-zoom="visual">' +
      '<figcaption>' + esc(v.title || (v.kind === "chart" ? "重製圖表" : "示意圖片")) + '</figcaption>' +
      (v.kind === "chart" && v.original ? '<details><summary>對照原裁圖</summary><img src="' + v.original + '" alt="原圖圖表" data-zoom="visual"></details>' : "") + '</figure>'
    ).join("") + "</div></div>";
  }
  const pad = (n) => String(n).padStart(2, "0");
  const localDate = (d) => { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const parseDate = (s) => { const n = String(s || "").split("-").map(Number); return new Date(n[0], (n[1] || 1) - 1, n[2] || 1); };
  const plusDays = (iso, n) => { const d = parseDate(iso); d.setDate(d.getDate() + n); return localDate(d); };
  const dayDiff = (a, b) => Math.round((parseDate(a) - parseDate(b)) / 86400000);
  const today = () => localDate();
  const stamp = () => new Date().toISOString();
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const dateCN = (iso) => { if (!iso) return ""; const d = parseDate(iso); return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日"; };
  const dateShort = (iso) => { if (!iso) return ""; const d = parseDate(iso); return (d.getMonth() + 1) + "月" + d.getDate() + "日"; };
  const weekdayCN = (iso) => "星期" + WEEK[parseDate(iso).getDay()];
  const relDue = (iso) => {
    if (!iso) return "未排程";
    const n = dayDiff(iso, today());
    if (n <= 0) return "今天複習";
    if (n === 1) return "明天複習";
    if (n === 2) return "後天複習";
    return n + "天後複習";
  };
  const intervalLabel = (n) => (n === 1 ? "明天" : n === 2 ? "後天" : n + "天後");
  const subjColor = (s) => SUBJECT_COLOR[s] || "#6b7a74";
  const subjShort = (s) => esc(String(s || "題").replace(/\s+/g, "").slice(0, 2));
  const isMastered = (q) => (q.streak || 0) >= 2;
  const isDue = (q) => (q.dueDate || q.createdDate || today()) <= today();
  const icon = (id, cls) => '<svg class="ic' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
  const cheerHTML = (t) => esc(t).replace(/\{([^}]+)\}/g, '<span class="hl">$1</span>');
  const plain = (t) => String(t).replace(/[{}]/g, "");

  /* 圖片快取 以 Blob 網址取代大型 base64 字串 降低清單重繪負擔 */
  const imgCache = new Map();
  function imgURL(q) {
    const src = safeImage(q && q.image);
    if (!src) return "";
    const key = q.id + "|" + (q.updatedAt || q.createdAt || "") + "|" + src.length;
    const hit = imgCache.get(q.id);
    if (hit && hit.key === key) return hit.url;
    try {
      const comma = src.indexOf(","), mime = src.slice(5, src.indexOf(";"));
      const bin = atob(src.slice(comma + 1)), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: mime }));
      if (hit) URL.revokeObjectURL(hit.url);
      imgCache.set(q.id, { key, url });
      return url;
    } catch (e) { return src; }
  }
  function dropImg(id) { const hit = imgCache.get(id); if (hit) { URL.revokeObjectURL(hit.url); imgCache.delete(id); } }

  /* IndexedDB */
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => { const db = req.result; ["questions", "reviews", "daily", "config"].forEach((name) => { if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: name === "config" ? "key" : "id" }); }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function dbRequest(store, method, value) {
    return new Promise((resolve, reject) => {
      const tx = S.db.transaction(store, "readwrite");
      const req = value === undefined ? tx.objectStore(store)[method]() : tx.objectStore(store)[method](value);
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error || req.error);
      tx.onabort = () => reject(tx.error || req.error);
    });
  }
  function dbAll(store) {
    return new Promise((resolve, reject) => {
      const req = S.db.transaction(store, "readonly").objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
  function dbBatch(ops) {
    return new Promise((resolve, reject) => {
      const stores = [...new Set(ops.map((o) => o[0]))];
      const tx = S.db.transaction(stores, "readwrite");
      ops.forEach(([store, method, value]) => tx.objectStore(store)[method](value));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  const cfg = (key, def) => (Object.prototype.hasOwnProperty.call(S.cfg, key) ? S.cfg[key] : def);
  function setCfg(key, value) { S.cfg[key] = value; return dbRequest("config", "put", { key, value, updatedAt: stamp() }).catch((e) => console.warn("config", e)); }

  async function loadAll() {
    const [q, r, d, c] = await Promise.all([dbAll("questions"), dbAll("reviews"), dbAll("daily"), dbAll("config")]);
    S.questions = q; S.reviews = r; S.daily = d;
    S.cfg = {}; c.forEach((x) => { if (x && x.key) S.cfg[x.key] = x.value; });
    S.examsData = cfg("examsData", null);
    migrateExam();
    S.exam = resolveExam(); S.examDate = S.exam.start;
    applySubjects(S.exam.id);
    S.plans = Array.isArray(cfg("plans", null)) ? cfg("plans") : [];
    S.scores = Object.assign({}, cfg("gsatScores", {}) || {});
    S.fav = Array.isArray(cfg("admitFav", null)) ? cfg("admitFav") : [];
    S.timer = null;
    S.nickname = String(cfg("nickname", "") || "");
    S.goal = Math.min(60, Math.max(1, Number(cfg("dailyGoal", 8)) || 8));
    S.theme = cfg("theme", localStorageGet("learneasyly-theme") || "auto");
    S.effects = cfg("effects", true) !== false;
    S.haptics = cfg("haptics", true) !== false;
    S.achievements = cfg("achievements", null);
    const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    S.lite = cfg("lite", !!weak) === true;
    if (window.FX) { FX.enabled = S.effects; FX.haptics = S.haptics; FX.lite = S.lite; }
  }
  function localStorageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lastBackup() { return cfg("lastBackup", "") || localStorageGet("learneasyly-last-backup") || ""; }

  /* 統計 */
  function dueItems() {
    return S.questions.filter(isDue).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)) || (b.difficulty || 3) - (a.difficulty || 3));
  }
  function activityMap() {
    const m = new Map();
    const add = (d, n) => { if (d) m.set(d, (m.get(d) || 0) + n); };
    S.questions.forEach((q) => add(q.createdDate, 1));
    S.reviews.forEach((r) => add(r.date, 1));
    S.daily.forEach((d) => {
      const n = (d.sessions || []).filter((x) => (x.sec || 0) >= 300).length;
      if (n) add(d.id, n);
      if (((d.total || 0) > 0 || d.checkin) && !m.has(d.id)) m.set(d.id, 0.5);
    });
    return m;
  }
  /* 每日打卡 */
  const ckRow = (d) => S.daily.find((x) => x.id === d);
  const ckOn = (d) => { const r = ckRow(d); return !!(r && r.checkin); };
  function ckInfo() {
    const rows = S.daily.filter((r) => r.checkin);
    const set = new Set(rows.map((r) => r.id)), t = today();
    let cur = 0, d = set.has(t) ? t : plusDays(t, -1);
    while (set.has(d)) { cur++; d = plusDays(d, -1); }
    let best = 0, run = 0, prev = null;
    [...set].sort().forEach((x) => { run = prev && dayDiff(x, prev) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = x; });
    const ym = t.slice(0, 7);
    const early = rows.filter((r) => { const h = new Date(r.checkin.at).getHours(); return h >= 4 && h < 7; }).length;
    const mins = rows.map((r) => Number(r.checkin.minutes) || 0).filter((n) => n > 0);
    const moods = {}; rows.forEach((r) => { if (r.checkin.mood) moods[r.checkin.mood] = (moods[r.checkin.mood] || 0) + 1; });
    return { cur, best, total: set.size, month: rows.filter((r) => r.id.slice(0, 7) === ym).length, early, todayDone: set.has(t), set,
      avgMin: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length / 10) * 10 : 0, topMood: Object.entries(moods).sort((a, b) => b[1] - a[1])[0] };
  }
  const timeCN = (iso) => { const d = new Date(iso); return d.getHours() + "點" + pad(d.getMinutes()) + "分"; };
  const minutesLabel = (n) => { n = Number(n) || 0; if (!n) return "還沒決定"; const h = Math.floor(n / 60), m = n % 60; return (h ? h + " 小時" : "") + (m ? (h ? " " : "") + m + " 分鐘" : ""); };
  const sealRot = (iso) => { const n = Number(String(iso).replace(/\D/g, "")) || 0; return ((n * 7919) % 15) - 9; };
  const miniSeal = (iso, text, pop) => '<i class="mini-seal' + (pop ? " pop" : "") + '" style="--r:' + sealRot(iso) + 'deg">' + esc(text) + "</i>";
  function actionsOn(d) { return S.questions.filter((q) => q.createdDate === d).length + S.reviews.filter((r) => r.date === d).length; }
  function streakInfo(map) {
    map = map || activityMap();
    const t = today();
    let cur = 0, d = map.has(t) ? t : plusDays(t, -1);
    while (map.has(d)) { cur++; d = plusDays(d, -1); }
    const days = [...map.keys()].sort();
    let best = 0, run = 0, prev = null;
    days.forEach((x) => { run = prev && dayDiff(x, prev) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = x; });
    return { cur, best, todayActive: map.has(t) };
  }
  function stats() {
    const map = activityMap(), st = streakInfo(map), ck = ckInfo();
    let goalDays = 0;
    const perDay = new Map();
    S.questions.forEach((q) => perDay.set(q.createdDate, (perDay.get(q.createdDate) || 0) + 1));
    S.reviews.forEach((r) => perDay.set(r.date, (perDay.get(r.date) || 0) + 1));
    perDay.forEach((n) => { if (n >= S.goal) goalDays++; });
    return {
      total: S.questions.length, reviews: S.reviews.length, mastered: S.questions.filter(isMastered).length,
      hard: S.questions.filter((q) => (q.difficulty || 3) >= 4 && isMastered(q)).length,
      best: st.best, cur: st.cur, goalDays, subjects: new Set(S.questions.map((q) => q.subject)).size,
      backup: lastBackup() ? 1 : 0, map, streak: st,
      ckTotal: ck.total, ckBest: ck.best, ckEarly: ck.early,
      sessions: allSessions().length, focusHours: Math.floor(allSessions().reduce((a, x) => a + (x.sec || 0), 0) / 3600),
      pomos: allSessions().filter((x) => (x.mode === "25" || x.mode === "50") && x.sec >= Number(x.mode) * 60 - 5).length,
      planDone: S.daily.reduce((a, d) => a + Object.keys(d.planDone || {}).length, 0)
    };
  }

  /* 提示泡泡 */
  function toast(message, o) {
    o = o || {};
    const stack = $("toastStack");
    const el = document.createElement("div");
    el.className = "toast glass " + (o.tone || "ok");
    const ic = o.icon || (o.tone === "warn" ? "i-info" : o.tone === "gold" ? "i-star" : "i-check");
    el.innerHTML = '<span class="t-ic">' + icon(ic) + "</span><span>" + esc(message) + "</span>";
    if (o.action) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = o.action.label;
      b.addEventListener("click", () => { dismiss(); o.action.run(); });
      el.appendChild(b);
    }
    stack.appendChild(el);
    while (stack.children.length > 3) stack.firstElementChild.remove();
    let timer = setTimeout(dismiss, o.duration || 3200);
    el.addEventListener("pointerenter", () => clearTimeout(timer));
    el.addEventListener("pointerleave", () => { timer = setTimeout(dismiss, 1600); });
    function dismiss() { clearTimeout(timer); el.classList.add("out"); setTimeout(() => el.remove(), 320); }
    return dismiss;
  }
  function status(id, message, isError) { const n = $(id); n.textContent = message; n.classList.toggle("error", !!isError); }

  /* 浮層與返回鍵 */
  const overlays = [];
  function openOverlay(el) {
    if (!el.hidden) return;
    el.hidden = false; el.classList.remove("closing");
    overlays.push(el);
    if (UI.cube) UI.cube.pause(true);
    try { history.pushState({ overlay: el.id, tab: S.tab }, "", "#" + S.tab); } catch (e) {}
    document.body.style.overflow = "hidden";
  }
  function closeOverlay(el, viaPop) {
    if (!el || el.hidden || el.classList.contains("closing")) return;
    const i = overlays.indexOf(el); if (i >= 0) overlays.splice(i, 1);
    el.classList.add("closing");
    setTimeout(() => { el.hidden = true; el.classList.remove("closing"); }, 230);
    if (!viaPop && history.state && history.state.overlay === el.id) { S.ignorePop++; history.back(); }
    if (!overlays.length) { document.body.style.overflow = ""; if (UI.cube) setTimeout(() => { if (!overlays.length) UI.cube.pause(false); }, 240); }
    const cb = el._onClose; el._onClose = null; if (cb) cb();
  }
  const pending = [];
  function whenSettled(fn) { if (S.ignorePop > 0) pending.push(fn); else fn(); }
  window.addEventListener("popstate", () => {
    if (S.ignorePop > 0) { S.ignorePop--; pending.splice(0).forEach((f) => f()); return; }
    if (overlays.length) { closeOverlay(overlays[overlays.length - 1], true); return; }
    const t = (location.hash || "#overview").slice(1);
    setTab(TABS.includes(t) ? t : "overview", { push: false });
  });

  /* 確認對話 */
  function ask(o) {
    return new Promise((resolve) => {
      const shell = $("askShell");
      $("askTitle").textContent = o.title || "確認";
      $("askBody").textContent = o.body || "";
      $("askOk").textContent = o.ok || "確定";
      $("askCancel").textContent = o.cancel || "取消";
      $("askOk").className = "btn " + (o.danger ? "btn-danger" : "btn-primary");
      const ic = $("askIcon"); ic.className = "ask-ic" + (o.danger ? " red" : ""); ic.innerHTML = icon(o.icon || (o.danger ? "i-trash" : "i-info"));
      const done = (v) => { $("askOk").onclick = null; $("askCancel").onclick = null; shell._onClose = null; closeOverlay(shell); resolve(v); };
      $("askOk").onclick = () => done(true);
      $("askCancel").onclick = () => done(false);
      openOverlay(shell);
      shell._onClose = () => resolve(false);
      setTimeout(() => $("askOk").focus(), 60);
    });
  }

  /* 慶祝 */
  const celeQueue = [];
  let celeOpen = false;
  function celebrate(o) { celeQueue.push(o); if (!celeOpen) nextCelebration(); }
  function nextCelebration() {
    const o = celeQueue.shift();
    if (!o) { celeOpen = false; return; }
    celeOpen = true;
    const badge = $("celebrateIcon");
    badge.className = "cele-badge" + (o.seal ? " is-seal" : "");
    badge.style.setProperty("--b1", (o.colors || ACH_COLORS[0])[0]);
    badge.style.setProperty("--b2", (o.colors || ACH_COLORS[0])[1]);
    badge.innerHTML = o.seal ? '<span class="seal">' + esc(o.seal) + "</span>" : icon(o.icon || "i-trophy");
    $("celebrateTitle").textContent = o.title;
    $("celebrateBody").textContent = o.body || "";
    $("celebrateStats").innerHTML = (o.stats || []).map((s) => "<div><strong>" + esc(s[0]) + "</strong><span>" + esc(s[1]) + "</span></div>").join("");
    $("celebrateOk").textContent = o.button || "繼續加油";
    const shell = $("celebrate");
    openOverlay(shell);
    shell._onClose = () => setTimeout(nextCelebration, 380);
    setTimeout(() => { if (window.FX) { FX.rain({ gold: !!o.gold }); FX.haptic([18, 50, 24]); } }, 120);
    setTimeout(() => $("celebrateOk").focus(), 80);
  }

  /* 成就 */
  function achievementState(st) {
    st = st || stats();
    return ACH.map((a) => { const cur = Math.min(a.n, st[a.k] || 0); return Object.assign({}, a, { cur, ok: (st[a.k] || 0) >= a.n }); });
  }
  function checkAchievements(silent) {
    const st = stats();
    const list = achievementState(st);
    const first = !S.achievements || typeof S.achievements !== "object";
    const got = first ? {} : Object.assign({}, S.achievements);
    const fresh = [];
    list.forEach((a) => { if (a.ok && !got[a.id]) { got[a.id] = today(); fresh.push(a); } });
    if (first || fresh.length) { S.achievements = got; setCfg("achievements", got); }
    if (!first && !silent && fresh.length) {
      if (fresh.length > 2) celebrate({ title: "一次解鎖 " + fresh.length + " 枚徽章", body: fresh.map((a) => a.t).join(" "), icon: "i-trophy", colors: ACH_COLORS[4], gold: true, button: "收下徽章" });
      else fresh.forEach((a) => celebrate({ title: a.t, body: "新徽章 " + a.d, icon: a.ic, colors: ACH_COLORS[a.c], gold: a.c === 4, button: "收下徽章" }));
    }
    return st;
  }
  function badgeHTML(a) {
    const col = ACH_COLORS[a.c];
    const when = S.achievements && S.achievements[a.id];
    return '<div class="badge' + (a.ok ? "" : " locked") + '" title="' + esc(a.d) + '"><span class="badge-ic" style="--b1:' + col[0] + ";--b2:" + col[1] + '">' + icon(a.ok ? a.ic : "i-lock") + "</span><strong>" + esc(a.t) + "</strong><small>" + esc(a.d) + "</small>" +
      (a.ok ? "<em>" + (when ? esc(dateShort(when)) + " 解鎖" : "已解鎖") + "</em>" : "<em>還差 " + (a.n - a.cur) + " " + a.u + "</em>") + "</div>";
  }

  /* 目標與慶祝檢查 */
  function afterAction(kind) {
    const acts = actionsOn(today());
    if (acts >= S.goal && cfg("goalDone", "") !== today()) {
      setCfg("goalDone", today());
      celebrate({ title: "今日目標達成", body: "今天完成 " + acts + " 個學習動作 方塊裝滿了", icon: "i-trophy", colors: ACH_COLORS[4], gold: true, stats: [[String(acts), "學習動作"], [String(streakInfo().cur), "連續天數"]] });
    }
    checkAchievements(false);
    if (kind) refreshViews();
  }

  /* 分頁 */
  function setTab(tab, o) {
    o = o || {};
    if (!TABS.includes(tab)) tab = "overview";
    if (o.push !== false && S.ignorePop > 0) { whenSettled(() => setTab(tab, o)); return; }
    const changed = S.tab !== tab;
    if (changed && S.tab === "add" && S.db) { flushSave().then(() => { if (S.editing) afterAction(false); }); }
    S.tab = tab;
    all(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + tab));
    all("[data-go]").forEach((x) => {
      const on = x.dataset.go === tab;
      x.classList.toggle("active", on);
      if (x.matches(".side-item,.tab")) { if (on) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current"); }
    });
    S.baseTitle = (tab === "overview" ? "" : LABELS[tab] + " ") + "稜角 Learn Angle";
    document.title = S.baseTitle;
    $("tabBar").classList.toggle("no-active", !["overview", "library", "review", "add", "study", "analytics"].includes(tab));
    if (S.timer && S.timer.run) tmTick();
    updateTopSub();
    if (o.push !== false && location.hash !== "#" + tab) { try { history.pushState({ tab }, "", "#" + tab); } catch (e) {} }
    if (changed && !o.keepScroll) window.scrollTo({ top: 0, behavior: "instant" });
    if (tab === "overview") renderOverview();
    if (tab === "review") { S.reviewing = null; S.revealed = false; renderReview(); }
    if (tab === "library") renderLibrary();
    if (tab === "analytics") renderAnalytics();
    if (tab === "settings") renderSettings();
    if (tab === "study") renderStudy();
    if (tab === "admit") renderAdmit();
    if (tab === "add") { updateComplete(); if (cfg("ocrPrefetch", true) && !OCR.ready && S.db) preloadOCR(false); }
    requestAnimationFrame(() => {
      if (UI.side) UI.side.sync(!changed);
      if (UI.tabs) UI.tabs.sync();
      [UI.status, UI.level, UI.theme, UI.mode, UI.chance, UI.listen].forEach((g) => g && g.sync());
      if (o.scrollTo) { const t = $(o.scrollTo); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }
    });
  }

  /* 稿紙標題 */
  function buildGrid(el, text) {
    text = clean(text);
    el.setAttribute("aria-label", text);
    const phrases = text.split(" ");
    let i = 0;
    el.innerHTML = phrases.map((ph, pi) => {
      const cells = Array.from(ph).map((ch) => '<span class="gt-cell" aria-hidden="true"><i style="--i:' + (i++) + '">' + esc(ch) + "</i></span>").join("");
      const blank = pi < phrases.length - 1 ? '<span class="gt-cell blank" aria-hidden="true"></span>' : "";
      return '<span class="gt-phrase">' + cells + blank + "</span>";
    }).join("");
  }

  /* 外觀 */
  const darkMQ = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  function applyTheme(pref) {
    S.theme = pref || "auto";
    const dark = S.theme === "dark" || (S.theme === "auto" && darkMQ && darkMQ.matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorageSet("learneasyly-theme", S.theme);
    const use = $("themeQuick").querySelector("use"); if (use) use.setAttribute("href", dark ? "#i-sun" : "#i-moon");
    if (UI.cube) UI.cube.setDark(dark);
    all("[data-theme-pick]").forEach((b) => b.classList.toggle("active", b.dataset.themePick === S.theme));
    if (UI.theme) UI.theme.sync();
  }
  if (darkMQ && darkMQ.addEventListener) darkMQ.addEventListener("change", () => { if (S.theme === "auto") applyTheme("auto"); });
  /* 省電模式 平面目標方塊 關閉玻璃模糊 彩帶減量 */
  function applyLite(v) {
    S.lite = !!v;
    document.documentElement.classList.toggle("lite", S.lite);
    localStorageSet("learneasyly-lite", S.lite ? "1" : "0");
    if (window.FX) FX.lite = S.lite;
    if (UI.cube) UI.cube.suspend(S.lite);
  }

  /* 公式排版 */
  let mathLoading = null;
  function injectScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script"); s.src = url; s.async = true;
      s.onload = resolve; s.onerror = () => reject(new Error("math"));
      document.head.appendChild(s);
    });
  }
  function ensureMath() {
    if (typeof window.renderMathInElement === "function") return Promise.resolve();
    if (!mathLoading) mathLoading = (async () => {
      if (!$("katexStyle")) { const l = document.createElement("link"); l.id = "katexStyle"; l.rel = "stylesheet"; l.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"; document.head.appendChild(l); }
      await injectScript("https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js");
      await injectScript("https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js");
    })().catch((e) => { mathLoading = null; console.warn("math renderer unavailable", e); });
    return mathLoading;
  }
  async function renderMath(root) {
    if (!root) return;
    const raw = root.textContent || "";
    if (!/\$[^$]+\$|\\\(|\\\[/.test(raw)) return;
    await ensureMath();
    if (typeof window.renderMathInElement !== "function" || !root.isConnected) return;
    window.renderMathInElement(root, {
      delimiters: [{ left: "$$", right: "$$", display: true }, { left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }, { left: "$", right: "$", display: false }],
      throwOnError: false, trust: false, ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
    });
  }

  /* 共用外框 */
  function greeting() {
    const h = new Date().getHours();
    const g = h < 5 ? "夜深了" : h < 11 ? "早安" : h < 14 ? "午安" : h < 18 ? "午後好" : h < 23 ? "晚上好" : "夜深了";
    return g + (S.nickname ? " " + S.nickname : "");
  }
  function renderChrome() {
    const due = dueItems().length;
    const pill = $("navDue"); pill.textContent = due; pill.classList.toggle("zero", !due);
    const td = $("tabDue"); td.textContent = due > 99 ? "99" : due; td.hidden = !due;
    const ck = ckInfo(), row = ckRow(today());
    $("sideStreak").textContent = ck.cur;
    $("sideStreakText").textContent = ck.todayDone ? "連續打卡 今天已蓋章" : ck.cur ? "連續打卡 今天還沒蓋章" : "今天開始第一天";
    $("mobileStreakNum").textContent = ck.cur;
    $("mobileStreak").classList.toggle("pending", !ck.todayDone);
    $("sideCheckinLabel").textContent = ck.todayDone ? "已打卡 " + timeCN(row.checkin.at) : "今天打卡";
    $("sideCheckin").classList.toggle("done", ck.todayDone);
    all(".side-streak .flame").forEach((f) => f.classList.toggle("cold", !ck.cur));
    const t = today(), d0 = parseDate(t), mon = plusDays(t, -((d0.getDay() + 6) % 7));
    $("sideWeek").innerHTML = ["一", "二", "三", "四", "五", "六", "日"].map((w, i) => {
      const d = plusDays(mon, i);
      return "<span><i class=\"" + (ck.set.has(d) ? "ck" : "") + (d === t ? " today" : "") + "\"></i>" + w + "</span>";
    }).join("");
    $("greetText").textContent = greeting();
    updateTopSub();
  }

  /* 總覽 */
  function cheerPool() {
    const due = dueItems().length, st = streakInfo(), remaining = dayDiff(S.examDate, today()), acts = actionsOn(today());
    const pool = [];
    if (remaining > 100) pool.push("再 {" + (remaining - 100) + " 天} 進入百日衝刺 現在打底最划算");
    else if (remaining > 0) pool.push("剩下 {" + remaining + " 天} 每一題都在幫你加分");
    if (due) pool.push("有 {" + due + " 題} 在等你 先從最有把握的開始");
    if (st.cur >= 2) pool.push("已經連續 {" + st.cur + " 天} 別讓火苗熄掉");
    if (acts >= S.goal) pool.push("今天的目標 {達成了} 多做的每一題都是賺到");
    else if (acts > 0) pool.push("今天完成 " + acts + " 個 {再 " + (S.goal - acts) + " 個就達標}");
    if (!S.questions.length) pool.unshift("{收錄第一題} 進步就從這裡開始");
    const ck = ckInfo();
    if (!ck.todayDone) pool.unshift(new Date().getHours() >= 20 ? "今天還沒打卡 {睡前記得蓋個章}" : "今天還沒打卡 {蓋個章再開始}");
    else if (ck.cur >= 2) pool.push("已經連續打卡 {" + ck.cur + " 天} 習慣正在長出來");
    return pool.concat(QUOTES);
  }
  function nextCheer(random) {
    const pool = cheerPool();
    S.cheer = random ? (S.cheer + 1 + ((Math.random() * (pool.length - 1)) | 0)) % pool.length : 0;
    const el = $("cheerText");
    el.innerHTML = cheerHTML(pool[S.cheer] || pool[0]);
  }
  function renderOverview() {
    const ex = S.exam, remaining = dayDiff(ex.start, today()), during = remaining <= 0 && ex.end >= today();
    const days = Math.max(0, remaining);
    FX.count($("countDays"), days);
    $("boardTitle").textContent = during ? ex.name + "進行中" : "距離" + ex.name + "還有";
    $("boardTag").innerHTML = esc(ex.label) + (ex.official ? "" : "<i>預估</i>");
    $("examBoard").setAttribute("aria-label", ex.name + "倒數 " + days + " 天");
    $("examDisplay").textContent = dateCN(ex.start);
    $("examWeekday").textContent = weekdayCN(ex.start) + (ex.time ? " " + timeCNhm(ex.time) + "開考" : "") + (ex.end !== ex.start ? " 考到 " + dateShort(ex.end) : "");
    renderBoardLive();
    renderExamRows();
    const gone = remaining > 100 ? 0 : Math.min(100, 100 - days);
    let html = "";
    for (let i = 0; i < 100; i++) html += '<i class="' + (i < gone ? "gone" : i === gone && remaining <= 100 && remaining > 0 ? "now" : "") + '"></i>';
    $("tally").innerHTML = html;
    $("tallyCap").innerHTML = remaining > 100 ? "再 <b>" + (remaining - 100) + "</b> 天進入百日衝刺 每一格代表一天"
      : remaining > 0 ? "百日衝刺第 <b>" + (101 - remaining) + "</b> 天 亮著的每一格都還來得及"
      : during ? "就是現在 祝你考試順利 把會的都寫出來" : ex.name + "已經結束 辛苦了 到設定換下一個目標";
    $("heroLede").textContent = S.nickname ? S.nickname + " 把不會的題目留下 把學會的證據累積起來" : "把不會的題目留下 把學會的證據累積起來";

    const acts = actionsOn(today()), done = acts >= S.goal;
    FX.count($("goalDone"), acts);
    $("goalTarget").textContent = S.goal;
    $("goalText").textContent = done ? "今日目標達成" : "完成 " + S.goal + " 個學習動作 還差 " + (S.goal - acts) + " 個";
    $("goalCard").classList.toggle("done", done);
    if (UI.cube) UI.cube.setLevel(Math.min(1, acts / S.goal), { done });
    renderStampCard();
    renderStudyCard();
    renderAdmitTeaser();

    const total = S.questions.length, due = dueItems().length, mastered = S.questions.filter(isMastered).length;
    FX.count($("statTotal"), total);
    FX.count($("statDue"), due);
    FX.count($("statMastery"), total ? Math.round(mastered / total * 100) : null, "%");
    FX.count($("statReviews"), S.reviews.length);
    const weekNew = S.questions.filter((q) => q.createdDate && dayDiff(today(), q.createdDate) < 7 && dayDiff(today(), q.createdDate) >= 0).length;
    $("statTotalSub").textContent = total ? "這週新增 " + weekNew + " 題" : "從第一題開始";
    $("statDueSub").textContent = due ? "今天該再看一次" : "目前沒有到期題目";
    $("statMasterySub").textContent = total ? "已掌握 " + mastered + " 題" : "連續兩次答對算掌握";
    $("statReviewsSub").textContent = "今天複習 " + S.reviews.filter((r) => r.date === today()).length + " 次";

    let max = 1; const rows = [];
    for (let i = 6; i >= 0; i--) {
      const d = plusDays(today(), -i);
      const a = S.questions.filter((q) => q.createdDate === d).length, b = S.reviews.filter((r) => r.date === d).length;
      rows.push({ d, a, b }); max = Math.max(max, a, b);
    }
    $("overviewChart").innerHTML = rows.map((r, i) => {
      const dt = parseDate(r.d);
      return '<div class="day' + (r.d === today() ? " today" : "") + '" title="' + esc(dateShort(r.d) + " 新增 " + r.a + " 題 複習 " + r.b + " 次") + '"><div class="bars"><i class="bar b1" style="--i:' + i + ";height:" + Math.max(3, r.a / max * 100) + '%"></i><i class="bar b2" style="--i:' + i + ";height:" + Math.max(3, r.b / max * 100) + '%"></i></div><div class="day-label"><b>' + dt.getDate() + "</b>" + (r.d === today() ? "今天" : "週" + WEEK[dt.getDay()]) + "</div></div>";
    }).join("");

    const recent = S.questions.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5);
    $("recentList").innerHTML = recent.length ? recent.map((q) => {
      const img = imgURL(q);
      return '<button class="recent-item" data-action="view" data-id="' + esc(q.id) + '" data-list="recent"><span class="subj-tile" style="--sc:' + subjColor(q.subject) + '">' + (img ? '<img src="' + img + '" alt="" loading="lazy">' : subjShort(q.subject)) + '</span><span class="recent-main"><strong>' + esc(clean(String(q.question || "").replace(/\$/g, "")).slice(0, 80) || q.topic || "圖片題") + '</strong><span class="meta"><span>' + esc(q.subject) + "</span><span>" + esc(q.topic || "未分類") + "</span><span>" + esc(relDue(q.dueDate)) + "</span></span></span>" + icon("i-arrow") + "</button>";
    }).join("") : emptyHTML("i-pen", "還沒有收錄錯題", "從今天不會的那一題開始", '<button class="btn btn-primary btn-sm" data-go="add">' + icon("i-plus") + "新增第一題</button>");

    const row = S.daily.find((d) => d.id === today());
    if (document.activeElement !== $("dailyTotal") && document.activeElement !== $("dailyCorrect") && !dailyTimer) {
      $("dailyTotal").value = row ? row.total : 0; $("dailyCorrect").value = row ? row.correct : 0;
      if (row && (row.total || row.correct)) dailyState("saved", "已自動儲存 " + timeCN(row.updatedAt)); else dailyState("idle", "改數字就會自動儲存");
    }
    updateDailyRate();

    const st2 = stats(), list = achievementState(st2), got = list.filter((a) => a.ok);
    $("achieveSummary").textContent = "已解鎖 " + got.length + " 枚 共 " + list.length + " 枚";
    const showcase = got.slice(-6).reverse();
    while (showcase.length < 6) { const nx = list.find((a) => !a.ok && !showcase.includes(a)); if (!nx) break; showcase.push(nx); }
    $("achieveStrip").innerHTML = showcase.map(badgeHTML).join("");
    const next = list.filter((a) => !a.ok).sort((a, b) => b.cur / b.n - a.cur / a.n)[0];
    $("nextAchieve").innerHTML = next ? "<span>下一枚徽章 <b>" + esc(next.t) + "</b> 還差 " + (next.n - next.cur) + " " + next.u + '</span><div class="meter"><i style="width:' + Math.round(next.cur / next.n * 100) + '%"></i></div>' : "<span>全部徽章都已解鎖</span>";

    const lb = lastBackup(), bdays = lb ? dayDiff(today(), lb) : 999;
    $("backupReminder").hidden = !(S.questions.length > 0 && bdays >= 7);
  }
  function renderStampCard() {
    const ck = ckInfo(), t = today(), row = ckRow(t);
    FX.count($("streakNum"), ck.cur);
    FX.count($("ckStreak"), ck.cur); FX.count($("ckMonth"), ck.month); FX.count($("ckTotal"), ck.total);
    $("stampStub").innerHTML = ck.todayDone
      ? '<span class="seal sm still"><b>已打卡</b><small>' + esc(timeCN(row.checkin.at)) + "</small></span>"
      : '<span class="stub-empty">' + icon("i-stamp") + "蓋章打卡</span>";
    $("stampText").textContent = ck.todayDone
      ? "今天 " + timeCN(row.checkin.at) + " 已打卡 這是第 " + ck.total + " 枚印章" + (row.checkin.note ? " 目標是 " + row.checkin.note : "")
      : new Date().getHours() >= 20 ? "今天還沒打卡 睡前記得蓋個章" : "今天還沒打卡 蓋個章再開始";
    const mon = plusDays(t, -((parseDate(t).getDay() + 6) % 7));
    $("stampWeek").innerHTML = ["一", "二", "三", "四", "五", "六", "日"].map((w, i) => {
      const d = plusDays(mon, i), on = ck.set.has(d), dd = parseDate(d).getDate();
      return '<div class="sw-slot' + (d === t ? " is-today" : "") + '"><span class="sw-cell' + (on ? " on" : "") + (d === t ? " today" : "") + (d > t ? " future" : "") + '">' + (on ? miniSeal(d, dd, S.ckPop === d) : dd) + "</span>" + (d === t ? "今天" : w) + "</div>";
    }).join("");
  }
  function emptyHTML(ic, title, sub, extra) {
    return '<div class="empty"><span class="empty-art">' + icon(ic) + "</span><strong>" + esc(title) + "</strong><span>" + esc(sub) + "</span>" + (extra || "") + "</div>";
  }
  function updateDailyRate() {
    const t = Number($("dailyTotal").value) || 0, c = Number($("dailyCorrect").value) || 0;
    const ok = t > 0 && c <= t;
    $("dailyRateBar").style.width = ok ? Math.round(c / t * 100) + "%" : "0%";
    $("dailyRate").textContent = !t ? "還沒有紀錄" : c > t ? "答對數比做題數多" : "答對率 " + Math.round(c / t * 100) + "%";
  }

  /* 錯題資料庫 */
  function libraryFiltered() {
    const query = $("searchInput").value.toLowerCase().trim(), subject = S.libSubject, sort = $("sortFilter").value, stt = S.libStatus;
    let list = S.questions.filter((q) => (!subject || q.subject === subject) && (!query || [q.question, q.topic, q.solution, q.source, q.answer, q.reflection].some((x) => String(x || "").toLowerCase().includes(query))));
    if (stt === "due") list = list.filter(isDue);
    else if (stt === "mastered") list = list.filter(isMastered);
    else if (stt === "learning") list = list.filter((q) => !isMastered(q) && !isDue(q));
    if (sort === "hard") list.sort((a, b) => (b.difficulty || 0) - (a.difficulty || 0) || String(b.createdAt).localeCompare(String(a.createdAt)));
    else if (sort === "due") list.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    else list.sort((a, b) => (sort === "old" ? String(a.createdAt).localeCompare(String(b.createdAt)) : String(b.createdAt).localeCompare(String(a.createdAt))));
    return { list, query };
  }
  function highlight(text, query) {
    if (!query) return esc(text);
    const lower = text.toLowerCase(); let out = "", i = 0;
    while (true) {
      const j = lower.indexOf(query, i);
      if (j < 0) { out += esc(text.slice(i)); break; }
      out += esc(text.slice(i, j)) + "<mark>" + esc(text.slice(j, j + query.length)) + "</mark>";
      i = j + query.length;
    }
    return out;
  }
  function renderLibrary() {
    const base = S.questions;
    const counts = { all: base.length, due: base.filter(isDue).length, mastered: base.filter(isMastered).length, learning: base.filter((q) => !isMastered(q) && !isDue(q)).length };
    all("#statusSeg [data-n]").forEach((b) => { b.textContent = counts[b.dataset.n]; });
    all("#statusSeg .seg-item").forEach((b) => b.classList.toggle("active", b.dataset.status === S.libStatus));
    const subs = {}; base.forEach((q) => { subs[q.subject] = (subs[q.subject] || 0) + 1; });
    const names = SUBJECTS.map((s) => s[0]).filter((n) => subs[n]).concat(Object.keys(subs).filter((n) => !inSubjects(n)));
    if (S.libSubject && !subs[S.libSubject]) S.libSubject = "";
    $("subjectFilter").innerHTML = '<button type="button" class="fchip' + (!S.libSubject ? " active" : "") + '" data-subject="">全部科目</button>' +
      names.map((n) => '<button type="button" class="fchip' + (S.libSubject === n ? " active" : "") + '" data-subject="' + esc(n) + '" style="--sc:' + subjColor(n) + '"><i></i>' + esc(n) + "<b>" + subs[n] + "</b></button>").join("");
    const { list, query } = libraryFiltered();
    S.libIds = list.map((q) => q.id);
    const visible = list.slice(0, S.pageSize);
    $("libraryCount").textContent = !base.length ? "" : query || S.libSubject || S.libStatus !== "all" ? "找到 " + list.length + " 題" : "共 " + list.length + " 題";
    if (!visible.length) {
      $("libraryList").innerHTML = base.length ? emptyHTML("i-search", "沒有符合條件的錯題", "換個關鍵字或篩選條件試試") : emptyHTML("i-stack", "錯題本還是空的", "收錄第一題 之後就能在這裡搜尋與篩選", '<button class="btn btn-primary btn-sm" data-go="add">' + icon("i-plus") + "新增錯題</button>");
      return;
    }
    $("libraryList").innerHTML = visible.map((q) => {
      const img = imgURL(q), title = clean(String(q.question || "").replace(/\$/g, "")).slice(0, 150) || q.topic || "圖片題";
      const tag = isDue(q) ? '<span class="tag due">今天複習</span>' : isMastered(q) ? '<span class="tag mastered">已掌握</span>' : '<span class="tag learning">' + esc(relDue(q.dueDate)) + "</span>";
      const lv = q.difficulty || 3;
      return '<article class="qcard' + (S.flashId === q.id ? " flash" : "") + '" tabindex="0" data-action="view" data-id="' + esc(q.id) + '" data-list="library" style="--sc:' + subjColor(q.subject) + '">' +
        '<div class="q-thumb">' + (img ? '<img src="' + img + '" alt="" loading="lazy">' : subjShort(q.subject)) + "</div>" +
        '<div class="q-body"><div class="q-tags"><span class="tag" style="--sc:' + subjColor(q.subject) + '">' + esc(q.subject) + "</span>" + tag + '<span class="diff" title="難度 ' + lv + '">' + [1, 2, 3, 4, 5].map((k) => '<i class="' + (k <= lv ? "on" : "") + '"></i>').join("") + "</span></div>" +
        '<h3 class="q-title' + (title.length < 36 ? " short" : "") + '">' + highlight(title, query) + "</h3>" +
        '<div class="q-foot"><div class="meta"><span>' + highlight(q.topic || "未分類", query) + "</span><span>" + esc(dateShort(q.createdDate)) + '</span></div><div class="q-actions"><button class="icon-btn" data-action="edit" data-id="' + esc(q.id) + '" aria-label="編輯" title="編輯">' + icon("i-edit") + '</button><button class="icon-btn danger" data-action="delete" data-id="' + esc(q.id) + '" aria-label="刪除" title="刪除">' + icon("i-trash") + "</button></div></div></div></article>";
    }).join("") + (list.length > visible.length ? '<div class="load-more"><button class="btn btn-ghost" id="loadMoreQuestions">顯示更多 還有 ' + (list.length - visible.length) + " 題</button></div>" : "");
    if (S.flashId) setTimeout(() => { S.flashId = null; }, 1900);
  }

  /* 今日複習 */
  function reviewQueue() {
    let due = dueItems();
    if (S.reviewSubject) due = due.filter((q) => q.subject === S.reviewSubject);
    return due.filter((q) => !S.skipped.has(q.id)).concat(due.filter((q) => S.skipped.has(q.id)));
  }
  function nextIntervals(q) {
    const s = (q.streak || 0) + 1;
    return { again: 1, hard: 2, good: INTERVALS[Math.min(Math.max(0, s - 1), INTERVALS.length - 1)] };
  }
  function renderReview() {
    const allDue = dueItems();
    if (S.reviewSubject && !allDue.some((q) => q.subject === S.reviewSubject)) S.reviewSubject = "";
    const queue = reviewQueue();
    const doneToday = S.reviews.filter((r) => r.date === today()).length;
    FX.count($("reviewRemaining"), queue.length);
    FX.count($("reviewCompleted"), doneToday);
    $("reviewBar").style.width = (doneToday + queue.length ? Math.round(doneToday / (doneToday + queue.length) * 100) : 0) + "%";
    $("reviewCombo").hidden = S.session.combo < 2;
    $("comboNum").textContent = S.session.combo;
    const subs = {}; allDue.forEach((q) => { subs[q.subject] = (subs[q.subject] || 0) + 1; });
    const names = Object.keys(subs);
    $("reviewSubjects").hidden = names.length < 2;
    $("reviewSubjects").innerHTML = '<button type="button" class="fchip' + (!S.reviewSubject ? " active" : "") + '" data-rsubject="">全部 <b>' + allDue.length + "</b></button>" +
      names.map((n) => '<button type="button" class="fchip' + (S.reviewSubject === n ? " active" : "") + '" data-rsubject="' + esc(n) + '" style="--sc:' + subjColor(n) + '"><i></i>' + esc(n) + "<b>" + subs[n] + "</b></button>").join("");
    $("reviewKeys").hidden = !queue.length;
    if (!queue.length) {
      if (!S.questions.length) { $("reviewArea").innerHTML = '<div class="rcard">' + emptyHTML("i-cards", "還沒有可以複習的題目", "新收錄的錯題會在隔天出現在這裡", '<button class="btn btn-primary btn-sm" data-go="add">' + icon("i-plus") + "新增錯題</button>") + "</div>"; return; }
      const upcoming = S.questions.map((q) => q.dueDate).filter(Boolean).sort()[0];
      if (doneToday) {
        $("reviewArea").innerHTML = '<div class="rcard done-card"><span class="seal">好棒</span><h2>今天的複習全部完成</h2><p>完成 ' + doneToday + " 題 " + (upcoming ? "下一次複習在 " + esc(dateShort(upcoming)) : "") + '</p><div class="btn-row"><button class="btn btn-primary" data-go="add">' + icon("i-plus") + '收錄新錯題</button><button class="btn btn-ghost" data-go="analytics">' + icon("i-chart") + "看看進步</button></div></div>";
      } else {
        $("reviewArea").innerHTML = '<div class="rcard">' + emptyHTML("i-leaf", "今天沒有到期的題目", upcoming ? "下一次複習在 " + dateShort(upcoming) + " 先收錄新錯題或回顧弱點單元" : "先收錄新錯題吧", '<button class="btn btn-ghost btn-sm" data-go="library">' + icon("i-stack") + "瀏覽錯題</button>") + "</div>";
      }
      return;
    }
    const q = queue.find((x) => x.id === S.reviewing) || queue[0];
    S.reviewing = q.id;
    const img = imgURL(q), iv = nextIntervals(q), lv = q.difficulty || 3;
    let body = '<article class="rcard" id="reviewCard"><div class="rv-head"><div class="q-tags"><span class="tag" style="--sc:' + subjColor(q.subject) + '">' + esc(q.subject) + '</span><span class="tag plain">' + esc(q.topic || "未分類") + '</span><span class="diff" title="難度 ' + lv + '">' + [1, 2, 3, 4, 5].map((k) => '<i class="' + (k <= lv ? "on" : "") + '"></i>').join("") + '</span></div><span class="rv-round">第 ' + ((q.reviewCount || 0) + 1) + " 次重做</span></div>" +
      (img ? '<img class="rv-img" src="' + img + '" alt="題目照片" data-zoom="' + esc(q.id) + '">' : "") +
      '<div class="rv-q">' + esc(q.question || "請依照上方照片或圖像作答") + "</div>" + visualHTML(q);
    if (S.revealed) {
      body += '<div class="rv-answer"><div class="rv-block"><h3>答案</h3><p class="rv-key">' + esc(q.answer || "沒有填寫答案") + '</p></div><div class="rv-block"><h3>完整詳解</h3><p>' + esc(q.solution || "還沒有詳解") + "</p></div>" + (q.reflection ? '<div class="rv-block"><h3>當時寫給自己的話</h3><p class="rv-note">' + esc(q.reflection) + "</p></div>" : "") + "</div>" +
        '<div class="rate"><button class="rate-btn rate-again" data-review="again">' + icon("i-close") + "不會<small>" + intervalLabel(iv.again) + '再做</small><kbd class="kbd">1</kbd></button><button class="rate-btn rate-hard" data-review="hard">' + icon("i-wave") + "模糊<small>" + intervalLabel(iv.hard) + '再看</small><kbd class="kbd">2</kbd></button><button class="rate-btn rate-good" data-review="good">' + icon("i-check") + "答對<small>" + intervalLabel(iv.good) + '再複習</small><kbd class="kbd">3</kbd></button></div>';
    } else {
      body += '<button class="btn btn-primary reveal-btn" data-review="reveal">' + icon("i-eye") + '我作答好了 看詳解<kbd class="kbd only-desk">空白鍵</kbd></button>';
    }
    body += '<div class="rv-foot"><span>評分會影響下次複習日期 請先不要偷看答案</span>' + (queue.length > 1 ? '<button class="btn btn-quiet" data-review="skip">' + icon("i-skip") + "先跳過</button>" : "") + "</div></article>";
    $("reviewArea").innerHTML = body;
    renderMath($("reviewArea"));
  }
  async function reviewRating(rating, btn) {
    if (rating === "reveal") { S.revealed = true; renderReview(); FX.haptic(6); const f = document.querySelector(".rate-good"); if (f && matchMedia("(pointer: fine)").matches) f.focus({ preventScroll: true }); return; }
    if (rating === "skip") { if (S.reviewing) S.skipped.add(S.reviewing); S.reviewing = null; S.revealed = false; leaveCard(renderReview); return; }
    const q = S.questions.find((x) => x.id === S.reviewing); if (!q || !S.revealed) return;
    const good = rating === "good", streak = good ? (q.streak || 0) + 1 : 0;
    const interval = rating === "again" ? 1 : rating === "hard" ? 2 : INTERVALS[Math.min(Math.max(0, streak - 1), INTERVALS.length - 1)];
    const next = Object.assign({}, q, { dueDate: plusDays(today(), interval), streak, reviewCount: (q.reviewCount || 0) + 1, updatedAt: stamp() });
    const log = { id: uid(), questionId: q.id, subject: q.subject, topic: q.topic, date: today(), createdAt: stamp(), rating, difficulty: q.difficulty || 3 };
    try {
      await dbBatch([["questions", "put", next], ["reviews", "put", log]]);
      S.questions = S.questions.map((x) => (x.id === q.id ? next : x));
      S.reviews.push(log);
      S.skipped.delete(q.id);
    } catch (e) { console.error(e); toast("無法記錄複習 請檢查儲存空間", { tone: "warn" }); return; }
    S.session.done++;
    const card = $("reviewCard");
    if (good) {
      S.session.good++; S.session.combo++; S.session.best = Math.max(S.session.best, S.session.combo);
      FX.check(card); if (btn) FX.fromEl(btn, { count: 34, power: 9 }); FX.haptic([10, 30, 14]);
      const c = S.session.combo;
      toast(c >= 3 ? (c >= 10 ? "連對 " + c + " 題 你現在無人能擋" : c >= 5 ? "連對 " + c + " 題 狀態正好" : "連對 " + c + " 題 手感正熱") : pick(MSG.good), { tone: c >= 5 ? "gold" : "ok", icon: c >= 3 ? "i-flame" : "i-check" });
    } else {
      S.session.combo = 0; FX.haptic(8);
      toast(pick(rating === "hard" ? MSG.hard : MSG.again), { tone: "ok", icon: rating === "hard" ? "i-wave" : "i-leaf" });
    }
    S.reviewing = null; S.revealed = false;
    const remaining = reviewQueue().length;
    setTimeout(() => leaveCard(() => {
      renderReview(); renderChrome();
      if (!remaining) {
        const doneToday = S.reviews.filter((r) => r.date === today()).length;
        celebrate({ seal: "好棒", title: "今天的複習全部完成", body: pick(MSG.done), stats: [[String(doneToday), "完成題數"], [String(S.session.good), "這輪答對"], [String(S.session.best), "最高連對"]] });
      }
      afterAction();
    }), good ? 520 : 120);
  }
  function leaveCard(fn) {
    const card = $("reviewCard");
    if (!card || !FX.on()) { fn(); return; }
    card.classList.add("leave");
    setTimeout(fn, 300);
  }

  /* 學習分析 */
  function monday(iso) { const d = parseDate(iso), k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return localDate(d); }
  function renderAnalytics() {
    const inPast = (s, n) => s && dayDiff(today(), String(s).slice(0, 10)) >= 0 && dayDiff(today(), String(s).slice(0, 10)) < n;
    const last7 = S.reviews.filter((r) => inPast(r.date, 7)), good7 = last7.filter((r) => r.rating === "good").length;
    FX.count($("anaAdded"), S.questions.filter((q) => inPast(q.createdDate, 7)).length);
    FX.count($("anaReviewed"), last7.length);
    FX.count($("anaAccuracy"), last7.length ? Math.round(good7 / last7.length * 100) : null, "%");
    $("anaAccuracySample").textContent = last7.length ? "共 " + last7.length + " 次重做" : "還沒有樣本";
    const hard = S.questions.filter((q) => (q.difficulty || 3) >= 4);
    FX.count($("anaHard"), hard.length ? Math.round(hard.filter(isMastered).length / hard.length * 100) : null, "%");

    /* 學習足跡熱力圖 */
    const map = activityMap(), t = today(), weeks = 26;
    const startMon = plusDays(monday(t), -7 * (weeks - 1));
    let cells = "", months = "", lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
      const wd = plusDays(startMon, w * 7), m = parseDate(wd).getMonth();
      if (m !== lastMonth) { if (w < weeks - 1) months += '<span style="left:' + (w / weeks * 100).toFixed(2) + '%">' + (m + 1) + "月</span>"; lastMonth = m; }
      for (let i = 0; i < 7; i++) {
        const d = plusDays(wd, i), n = map.get(d) || 0;
        const l = n <= 0 ? 0 : n < 2 ? 1 : n < 5 ? 2 : n < 10 ? 3 : 4;
        cells += '<i data-l="' + l + '" class="' + (d === t ? "today" : d > t ? "future" : "") + '" title="' + esc(dateShort(d) + " " + Math.floor(n) + " 個學習動作") + '"></i>';
      }
    }
    $("heatmap").innerHTML = '<div class="heat"><div class="heat-days"><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span><span>日</span></div><div><div class="heat-months">' + months + '</div><div class="heat-grid">' + cells + "</div></div></div>";
    requestAnimationFrame(() => { const wrap = $("heatmap").parentElement; if (wrap) wrap.scrollLeft = wrap.scrollWidth; });
    $("heatLegend").innerHTML = "少" + [0, 1, 2, 3, 4].map((l) => '<i style="background:var(--heat' + l + ')"></i>').join("") + "多";

    /* 每週答對率 */
    const wk = [];
    for (let i = 7; i >= 0; i--) {
      const start = plusDays(monday(t), -7 * i), log = S.reviews.filter((r) => monday(r.date) === start), correct = log.filter((r) => r.rating === "good").length;
      wk.push({ start, n: log.length, rate: log.length ? Math.round(correct / log.length * 100) : 0 });
    }
    $("weekAccuracy").innerHTML = wk.map((w, i) => { const d = parseDate(w.start); return '<div class="wk' + (w.n ? "" : " empty-wk") + '" title="' + esc(dateShort(w.start) + "起的一週 " + w.n + " 次重做") + '"><b>' + (w.n ? w.rate + "%" : "") + '</b><i class="wk-bar" style="--i:' + i + ";height:" + (w.n ? Math.max(4, w.rate) : 3) + '%"></i><span>' + (d.getMonth() + 1) + "月<small>" + d.getDate() + "日</small></span></div>"; }).join("");
    const prev7 = S.reviews.filter((r) => { const age = dayDiff(t, r.date); return age >= 7 && age < 14; });
    const recentPct = last7.length ? good7 / last7.length * 100 : 0, prevPct = prev7.length ? prev7.filter((r) => r.rating === "good").length / prev7.length * 100 : 0;
    const delta = Math.round(recentPct - prevPct), dEl = $("weeklyDelta");
    if (last7.length >= 5 && prev7.length >= 5) {
      dEl.textContent = delta > 0 ? "最近七天比前七天進步 " + delta + " 個百分點 本期 " + last7.length + " 次 上期 " + prev7.length + " 次" : delta === 0 ? "最近七天與前七天持平 穩定也是一種實力" : "最近七天比前七天少 " + Math.abs(delta) + " 個百分點 可能是題目變難了 先回頭補弱點";
      dEl.classList.toggle("down", delta < 0);
    } else { dEl.textContent = "最近七天 " + last7.length + " 次 前七天 " + prev7.length + " 次 兩期各滿五次後顯示進步幅度"; dEl.classList.remove("down"); }

    /* 各科 */
    const names = SUBJECTS.map((s) => s[0]).filter((n) => S.questions.some((q) => q.subject === n)).concat([...new Set(S.questions.map((q) => q.subject))].filter((n) => !inSubjects(n)));
    $("subjectProgress").innerHTML = names.length ? names.map((n) => {
      const arr = S.questions.filter((q) => q.subject === n), p = Math.round(arr.filter(isMastered).length / arr.length * 100);
      return '<div class="bar-row" style="--sc:' + subjColor(n) + '"><div class="bar-row-head"><span><i></i>' + esc(n) + " <small>" + arr.length + " 題</small></span><b>" + p + '%</b></div><div class="meter"><i style="width:' + p + '%"></i></div></div>';
    }).join("") : emptyHTML("i-chart", "還沒有科目資料", "新增錯題後會顯示各科掌握比例");

    const reasons = {}; S.questions.forEach((q) => { const k = q.reason || "其他"; reasons[k] = (reasons[k] || 0) + 1; });
    const rs = Object.entries(reasons).sort((a, b) => b[1] - a[1]), rmax = rs.length ? rs[0][1] : 1;
    $("errorReasons").innerHTML = rs.length ? rs.map(([k, v], i) => '<div class="bar-row" style="--sc:' + (i === 0 ? "var(--red)" : "var(--ink-3)") + '"><div class="bar-row-head"><span><i></i>' + esc(k) + "</span><b>" + v + ' 題</b></div><div class="meter"><i style="width:' + Math.round(v / rmax * 100) + '%"></i></div></div>').join("") : emptyHTML("i-bulb", "還沒有錯誤原因紀錄", "收錄時標記原因 就能找到習慣性失誤");

    const groups = {}; S.questions.filter((q) => !isMastered(q)).forEach((q) => { const k = (q.subject || "其他") + "\u0000" + (q.topic || "未分類"); groups[k] = (groups[k] || 0) + 1; });
    const gs = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 7);
    $("weakTopics").innerHTML = gs.length ? gs.map(([k, v], i) => { const [s, tp] = k.split("\u0000"); return '<div class="list-item"><span class="list-left"><span class="rank">' + (i + 1) + '</span><span class="meta"><span style="color:' + subjColor(s) + ';font-weight:700">' + esc(s) + "</span><span>" + esc(tp) + "</span></span></span><b>" + v + " 題未掌握</b></div>"; }).join("") : emptyHTML("i-leaf", "目前沒有待補強單元", "全部掌握了 或還沒有錯題");

    renderCheckinPanel();
    const dl = S.daily.filter((d) => (d.total || 0) > 0).sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(-14);
    $("dailyAnalysis").innerHTML = dl.length ? '<div class="daily-chart">' + dl.map((d, i) => { const p = d.total ? Math.round(d.correct / d.total * 100) : 0; return '<div class="dc" title="' + esc(dateShort(d.id) + " 做 " + d.total + " 題 答對 " + d.correct + " 題") + '"><b>' + (d.total ? p + "%" : "") + '</b><i style="--i:' + i + ";height:" + Math.max(3, p) + '%"></i><span>' + parseDate(d.id).getDate() + "日</span></div>"; }).join("") + "</div>" +
      dl.slice().reverse().slice(0, 5).map((d) => '<div class="list-item"><span>' + esc(dateShort(d.id)) + " " + esc(weekdayCN(d.id)) + "</span><span>做 " + d.total + " 題 答對 " + d.correct + " 題 <b>" + (d.total ? Math.round(d.correct / d.total * 100) + "%" : "") + "</b></span></div>").join("")
      : emptyHTML("i-calendar", "還沒有每日練習紀錄", "在總覽填寫今天的做題數與答對數");

    const list = achievementState();
    $("achieveCount").textContent = "已解鎖 " + list.filter((a) => a.ok).length + " 枚 共 " + list.length + " 枚";
    $("achievementGrid").innerHTML = list.map(badgeHTML).join("");
  }

  /* 打卡月曆 */
  function monthGrid(ym) {
    const [y, m] = ym.split("-").map(Number), first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate(), lead = (first.getDay() + 6) % 7, t = today();
    let h = ["一", "二", "三", "四", "五", "六", "日"].map((w) => '<span class="ck-wd">' + w + "</span>").join("");
    for (let i = 0; i < lead; i++) h += '<span class="ck-day blank"></span>';
    for (let d = 1; d <= days; d++) {
      const iso = y + "-" + pad(m) + "-" + pad(d), r = ckRow(iso), on = !!(r && r.checkin);
      const tip = on ? dateShort(iso) + " " + timeCN(r.checkin.at) + " 打卡" + (r.checkin.mood ? " " + r.checkin.mood : "") + (r.checkin.minutes ? " 預計讀書 " + minutesLabel(r.checkin.minutes) : "") : dateShort(iso);
      h += '<span class="ck-day' + (on ? " on" : "") + (iso === t ? " today" : "") + (iso > t ? " future" : "") + '" title="' + esc(tip) + '">' + (on ? miniSeal(iso, d, S.ckPop === iso) : d) + "</span>";
    }
    return h;
  }
  const monthLabel = (ym) => { const [y, m] = ym.split("-").map(Number); return y + "年" + m + "月"; };
  const shiftMonth = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + "-" + pad(d.getMonth() + 1); };
  function monthStats(ym) {
    const rows = S.daily.filter((r) => r.checkin && r.id.slice(0, 7) === ym);
    const mins = rows.reduce((a, r) => a + (Number(r.checkin.minutes) || 0), 0);
    return "這個月蓋了 " + rows.length + " 枚印章" + (mins ? " 預計讀書合計 " + minutesLabel(mins) : "");
  }
  function renderCheckinPanel() {
    S.anaCkMonth = S.anaCkMonth || today().slice(0, 7);
    const ck = ckInfo(), ym = S.anaCkMonth;
    $("anaCkLabel").textContent = monthLabel(ym);
    $("anaCkNext").disabled = ym >= today().slice(0, 7);
    $("anaCkGrid").innerHTML = monthGrid(ym);
    $("anaCkSummary").textContent = monthStats(ym);
    $("anaCkStats").innerHTML = "<div><strong>" + ck.total + "</strong><span>累積印章</span></div><div><strong>" + ck.best + "</strong><span>最長連續天數</span></div><div><strong>" + ck.month + "</strong><span>本月打卡</span></div><div><strong>" + (ck.avgMin ? esc(minutesLabel(ck.avgMin)) : "尚無") + "</strong><span>平均預計讀書</span></div>" +
      "<p>" + (ck.total ? (ck.topMood ? "最常出現的狀態是 " + esc(ck.topMood[0]) + " " : "") + (ck.todayDone ? "今天已經蓋章 繼續保持" : "今天還沒蓋章 到總覽按一下印章") : "還沒有打卡紀錄 每天蓋一枚章 一百天後回頭看會很感動") + "</p>";
  }
  function initCheckin() {
    $("ckMood").innerHTML = MOODS.map(([n, c]) => '<label class="pick"><input type="radio" name="ckMoodPick" value="' + esc(n) + '"><span style="--sc:' + c + '"><i></i>' + esc(n) + "</span></label>").join("");
  }
  function fillCheckin(animate) {
    const t = today(), row = ckRow(t), done = !!(row && row.checkin), ck = ckInfo();
    $("ckDate").textContent = dateShort(t); $("ckWeekday").textContent = weekdayCN(t);
    $("ckStage").classList.toggle("done", done);
    $("ckImpression").innerHTML = done ? '<span class="seal big' + (animate ? "" : " still") + '"><b>已打卡</b><small>第 ' + ck.total + " 枚 " + esc(timeCN(row.checkin.at)) + "</small></span>" : "";
    $("ckHint").innerHTML = done ? (ck.cur >= 2 ? "已經連續打卡 <b>" + ck.cur + "</b> 天 狀態與時間都可以再修改" : "今天已經蓋章 狀態與時間都可以再修改") : "按住印章一下 蓋上今天的章";
    const draft = S.ckDraft || cfg("ckDraft", null);
    const c = done ? row.checkin : (draft && draft.date === t ? draft : {});
    all('input[name="ckMoodPick"]').forEach((i) => { i.checked = i.value === c.mood; });
    S.ckMinutes = Number(c.minutes) || 0; $("ckMinutesLabel").textContent = minutesLabel(S.ckMinutes);
    if (document.activeElement !== $("ckNote")) $("ckNote").value = c.note || "";
    S.ckMonth = S.ckMonth || t.slice(0, 7);
    $("ckMonthLabel").textContent = monthLabel(S.ckMonth);
    $("ckNext").disabled = S.ckMonth >= t.slice(0, 7);
    $("ckGrid").innerHTML = monthGrid(S.ckMonth);
    $("ckMonthStats").textContent = monthStats(S.ckMonth);
  }
  function openCheckin() {
    S.ckMonth = today().slice(0, 7); $("ckSaved").textContent = "";
    fillCheckin(false);
    openOverlay($("checkinSheet"));
    if (!ckOn(today()) && matchMedia("(pointer: fine)").matches) setTimeout(() => $("ckStamp").focus({ preventScroll: true }), 120);
  }
  function ckFields() {
    return { mood: radioVal("ckMoodPick", ""), minutes: S.ckMinutes || 0, note: clean($("ckNote").value).slice(0, 40) };
  }
  async function doCheckIn() {
    const t = today();
    if (ckOn(t) || S.ckBusy) return;
    S.ckBusy = true;
    const prev = ckRow(t) || {};
    const rec = Object.assign({}, prev, { id: t, total: prev.total || 0, correct: prev.correct || 0, checkin: Object.assign({ at: new Date().toISOString() }, ckFields()), updatedAt: stamp() });
    try {
      await dbRequest("daily", "put", rec);
      S.daily = S.daily.filter((d) => d.id !== t).concat(rec);
    } catch (e) { S.ckBusy = false; toast("打卡沒有存成功 請檢查儲存空間", { tone: "warn" }); return; }
    S.ckBusy = false; S.ckDraft = null; S.ckPop = t; setCfg("ckDraft", null);
    fillCheckin(true);
    const ck = ckInfo(), h = new Date().getHours();
    setTimeout(() => { FX.fromEl($("ckImpression"), { count: 56, power: 10 }); }, 160);
    FX.haptic([24, 60, 30]);
    toast(h >= 4 && h < 7 ? "早起的鳥兒 今天一定很有收穫" : h >= 23 || h < 4 ? "這麼晚還來打卡 讀完記得早點睡" : ck.cur >= 2 ? "連續打卡 " + ck.cur + " 天 習慣正在養成" : pick(CK_MSG), { icon: "i-stamp" });
    renderChrome(); renderStampCard(); if (S.tab === "analytics") renderCheckinPanel();
    setTimeout(() => { S.ckPop = null; }, 1200);
    if (CK_MILESTONES.includes(ck.cur)) setTimeout(() => celebrate({ seal: ck.cur + "天", title: "連續打卡 " + ck.cur + " 天", body: ck.cur >= 30 ? "已經是你的習慣了 考試那天你會感謝現在的自己" : "習慣正在成形 明天也來蓋一枚", colors: ACH_COLORS[3], stats: [[String(ck.cur), "連續天數"], [String(ck.total), "累積印章"]] }), 900);
    setTimeout(() => checkAchievements(false), 950);
  }
  let ckTimer = null;
  function saveCheckinFields() {
    const t = today(), row = ckRow(t);
    if (!row || !row.checkin) {
      S.ckDraft = Object.assign({ date: t }, ckFields());
      clearTimeout(ckTimer);
      ckTimer = setTimeout(() => { setCfg("ckDraft", S.ckDraft); $("ckSaved").textContent = "已自動儲存 蓋章時會一起記錄"; }, 450);
      return;
    }
    clearTimeout(ckTimer);
    ckTimer = setTimeout(async () => {
      const rec = Object.assign({}, row, { checkin: Object.assign({}, row.checkin, ckFields()), updatedAt: stamp() });
      try { await dbRequest("daily", "put", rec); S.daily = S.daily.filter((d) => d.id !== t).concat(rec); $("ckSaved").textContent = "已更新今天的打卡內容"; renderStampCard(); }
      catch (e) { $("ckSaved").textContent = "更新失敗 請再試一次"; }
    }, 450);
  }

  /* 設定 */
  function renderSettings() {
    if (document.activeElement !== $("nicknameField")) $("nicknameField").value = S.nickname;
    if (!$("setExamPick").contains(document.activeElement)) renderExamPicker($("setExamPick"), settingsExamState());
    $("goalField").value = S.goal;
    $("chimeToggle").checked = cfg("chime", true) !== false;
    $("wakeToggle").checked = cfg("wake", true) !== false;
    $("availWeekday").textContent = minutesLabel(availMinutes(false));
    $("availWeekend").textContent = minutesLabel(availMinutes(true));
    $("effectsToggle").checked = S.effects;
    $("hapticsToggle").checked = S.haptics;
    $("liteToggle").checked = S.lite;
    $("ocrPrefetchToggle").checked = cfg("ocrPrefetch", true) !== false;
    ocrModelUI(OCR.mstate, OCR.mpct);
    all("[data-theme-pick]").forEach((b) => b.classList.toggle("active", b.dataset.themePick === S.theme));
    const lb = lastBackup(), days = lb ? dayDiff(today(), lb) : 999;
    $("backupState").textContent = days > 6 ? "最近七天沒有備份紀錄 建議現在匯出一份 存到雲端或硬碟" : "最近一次備份在 " + dateCN(lb) + " 每週備份一次就很安心";
    storageStatus();
  }
  async function storageStatus() {
    const node = $("storageState"), bar = $("storageBar"), chip = $("persistChip");
    if (!navigator.storage || !navigator.storage.estimate) { node.textContent = "這個瀏覽器無法回報可用空間 請持續每週備份"; return; }
    try {
      const [est, persisted] = await Promise.all([navigator.storage.estimate(), typeof navigator.storage.persisted === "function" ? navigator.storage.persisted() : Promise.resolve(false)]);
      const mb = (n) => Number(n || 0) / 1048576;
      const used = mb(est.usage), quota = mb(est.quota);
      const fmt = (v) => (v < 1 ? "不到 1 MB" : Math.round(v).toLocaleString("en-US").replace(/,/g, " ") + " MB");
      node.textContent = "已使用 " + fmt(used) + " 瀏覽器配額約 " + fmt(quota) + " 目前收錄 " + S.questions.length + " 題";
      bar.style.width = quota ? Math.max(2, Math.min(100, used / quota * 100)) + "%" : "0%";
      chip.textContent = persisted ? "已授予" : "尚未授予";
      chip.className = "tag " + (persisted ? "mastered" : "plain");
    } catch (e) { node.textContent = "暫時無法取得儲存空間狀態 仍建議每週備份"; }
  }
  async function requestPersist() {
    if (!navigator.storage || !navigator.storage.persist) { toast("這個瀏覽器不支援持久保存", { tone: "warn" }); return; }
    try { const ok = await navigator.storage.persist(); toast(ok ? "已獲得持久保存權限" : "瀏覽器沒有授予 請持續備份", { tone: ok ? "ok" : "warn" }); await storageStatus(); }
    catch (e) { toast("目前無法申請持久保存", { tone: "warn" }); }
  }

  /* 編輯器 */
  function initEditor() {
    $("subjectChips").innerHTML = SUBJECTS.map(([n, c], i) => '<label class="pick"><input type="radio" name="subject" value="' + esc(n) + '"' + (i === 0 ? " checked" : "") + '><span style="--sc:' + c + '"><i></i>' + esc(n) + "</span></label>").join("");
    $("reasonChips").innerHTML = REASONS.map((n, i) => '<label class="pick"><input type="radio" name="reason" value="' + esc(n) + '"' + (i === 0 ? " checked" : "") + "><span>" + esc(n) + "</span></label>").join("");
  }
  const radioVal = (name, def) => { const n = document.querySelector('input[name="' + name + '"]:checked'); return n ? n.value : def; };
  function setRadio(name, value) {
    let n = document.querySelector('input[name="' + name + '"][value="' + String(value).replace(/["\\]/g, "\\$&") + '"]');
    if (!n && name === "subject" && value) {
      const box = $("subjectChips");
      box.insertAdjacentHTML("beforeend", '<label class="pick"><input type="radio" name="subject" value="' + esc(value) + '"><span style="--sc:' + subjColor(value) + '"><i></i>' + esc(value) + "</span></label>");
      n = box.lastElementChild.querySelector("input");
    }
    if (!n) n = document.querySelector('input[name="' + name + '"]');
    if (n) n.checked = true;
  }
  function updateTopics() {
    const subject = radioVal("subject", ""), freq = {};
    S.questions.forEach((q) => { if (q.topic && (!subject || q.subject === subject)) freq[q.topic] = (freq[q.topic] || 0) + 1; });
    $("topicList").innerHTML = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([t]) => '<option value="' + esc(t) + '"></option>').join("");
  }
  function updateLevel() { $("levelLabel").textContent = LEVELS[radioVal("difficulty", "3")] || ""; }
  function updateComplete() {
    const items = [
      ["題目", !!($("questionText").value.trim() || S.image || S.visuals.length)], ["答案", !!$("answerText").value.trim()],
      ["詳解", !!$("solutionText").value.trim()], ["單元", !!$("topicField").value.trim()], ["給自己的話", !!$("reflectionText").value.trim()]
    ];
    const done = items.filter((x) => x[1]).length, pct = Math.round(done / items.length * 100);
    $("completePct").textContent = pct + "%";
    $("completeBar").style.width = pct + "%";
    $("completeList").innerHTML = items.map(([n, ok]) => '<li class="' + (ok ? "on" : "") + '"><span class="ck">' + icon("i-check") + "</span>" + n + "</li>").join("");
  }
  function editorSnapshot() {
    return {
      editing: S.editing, image: safeImage(S.image), visuals: normalizedVisuals(S.visuals), question: $("questionText").value, answer: $("answerText").value, solution: $("solutionText").value,
      reflection: $("reflectionText").value, subject: radioVal("subject", firstSubject()), topic: $("topicField").value, source: $("sourceField").value,
      difficulty: Number(radioVal("difficulty", "3")), reason: radioVal("reason", "觀念不清")
    };
  }
  /* 自動儲存
     有題目文字或照片時 停止輸入不到一秒就寫入錯題本
     新題目第一次儲存就會出現在資料庫 之後的修改都直接更新同一題 */
  let saveTimer = null, saving = null, savePending = false, lastSig = "";
  const editorSig = () => { const v = editorSnapshot(); return JSON.stringify([v.question, v.answer, v.solution, v.reflection, v.subject, v.topic, v.source, v.difficulty, v.reason, v.image.length, v.image.slice(-64), JSON.stringify(v.visuals.map((x) => [x.id, x.kind, x.image.length, x.image.slice(-40), x.title, x.chartData, x.xAxis, x.yAxis]))]); };
  function scheduleDraft() {
    updateComplete();
    clearTimeout(saveTimer);
    if (editorSig() !== lastSig) setSaveState("pending");
    saveTimer = setTimeout(autoSave, 650);
  }
  function setSaveState(state) {
    S.saveState = state;
    const texts = {
      idle: "輸入題目或加入照片 就會自動儲存", pending: "正在編輯 停下來就會自動儲存", saving: "儲存中",
      saved: "已自動儲存 " + (S.savedAt ? timeCN(S.savedAt) : ""), need: "需要題目文字或照片 才能自動儲存", error: "自動儲存失敗 可能是瀏覽器空間不足"
    };
    $("autosave").dataset.state = state;
    $("autosaveText").textContent = texts[state] || "";
    updateTopSub();
  }
  function updateTopSub() {
    const el = $("todayText"), n = new Date();
    el.classList.remove("saving", "saved");
    if (S.tab === "add" && S.saveState && S.saveState !== "idle") {
      el.textContent = S.saveState === "saved" ? "已自動儲存 " + (S.savedAt ? timeCN(S.savedAt) : "") : S.saveState === "saving" || S.saveState === "pending" ? "自動儲存中" : $("autosaveText").textContent;
      el.classList.add(S.saveState === "saved" ? "saved" : "saving");
    } else el.textContent = (n.getMonth() + 1) + "月" + n.getDate() + "日 週" + WEEK[n.getDay()];
  }
  function buildQuestion(previous) {
    return Object.assign({}, previous || {}, {
      id: previous ? previous.id : uid(), createdAt: previous ? previous.createdAt : stamp(), createdDate: previous ? previous.createdDate : today(),
      updatedAt: stamp(), image: safeImage(S.image), visuals: normalizedVisuals(S.visuals), question: $("questionText").value.trim(), answer: $("answerText").value.trim(), solution: $("solutionText").value.trim(), reflection: $("reflectionText").value.trim(),
      subject: radioVal("subject", firstSubject()), topic: $("topicField").value.trim(), source: $("sourceField").value.trim(),
      difficulty: Number(radioVal("difficulty", "3")), reason: radioVal("reason", "觀念不清"),
      dueDate: previous ? previous.dueDate : plusDays(today(), 1), streak: previous ? (previous.streak || 0) : 0, reviewCount: previous ? (previous.reviewCount || 0) : 0
    });
  }
  function autoSave() {
    clearTimeout(saveTimer); saveTimer = null;
    if (saving) { savePending = true; return saving; }
    const sig = editorSig();
    const hasContent = !!($("questionText").value.trim() || S.image || S.visuals.length);
    if (!hasContent) {
      const snap = editorSnapshot();
      if (snap.answer || snap.solution || snap.topic || snap.reflection) dbRequest("config", "put", { key: "editorDraft", value: snap, updatedAt: stamp() }).catch(() => {});
      setSaveState(S.editing || snap.answer || snap.solution || snap.topic || snap.reflection ? "need" : "idle");
      return Promise.resolve();
    }
    if (sig === lastSig && S.editing) { setSaveState("saved"); return Promise.resolve(); }
    setSaveState("saving");
    const previous = S.questions.find((q) => q.id === S.editing);
    const q = buildQuestion(previous);
    saving = (async () => {
      try {
        await dbRequest("questions", "put", q);
        if (previous) S.questions = S.questions.map((x) => (x.id === q.id ? q : x));
        else { S.questions.push(q); S.editing = q.id; S.autoNew = q.id; setEditorMode(true); }
        dropImg(q.id);
        lastSig = sig; S.savedAt = new Date().toISOString();
        dbRequest("config", "put", { key: "editorSession", value: { id: q.id, autoNew: S.autoNew === q.id, at: S.savedAt }, updatedAt: stamp() }).catch(() => {});
        dbRequest("config", "delete", "editorDraft").catch(() => {}); delete S.cfg.editorDraft;
        setSaveState("saved"); renderChrome();
      } catch (e) { console.error(e); setSaveState("error"); }
      finally {
        saving = null;
        if (savePending) { savePending = false; autoSave(); }
      }
    })();
    return saving;
  }
  async function flushSave() { clearTimeout(saveTimer); await autoSave(); if (saving) await saving; }
  function setEditorMode(editing) {
    const isNew = editing && S.autoNew === S.editing;
    buildGrid($("editorHeading"), editing && !isNew ? "編輯錯題" : "新增錯題");
    $("editorLede").textContent = editing && !isNew ? "修改會自動儲存 也會保留原本的複習進度" : "邊寫邊自動儲存 從一張照片開始留住今天弄懂的觀念";
    $("saveLabel").textContent = editing && !isNew ? "完成編輯" : "完成這一題";
    $("cancelEdit").textContent = isNew ? "捨棄這一題" : editing ? "復原這次修改" : "清空重來";
  }
  function fillEditor(d) {
    releaseOcrSource(); S.image = safeImage(d.image); S.visuals = normalizedVisuals(d.visuals); previewImage(); previewVisuals();
    $("questionText").value = d.question || ""; $("answerText").value = d.answer || ""; $("solutionText").value = d.solution || "";
    $("reflectionText").value = d.reflection || ""; $("topicField").value = d.topic || ""; $("sourceField").value = d.source || "";
    setRadio("subject", d.subject || firstSubject()); setRadio("reason", d.reason || "觀念不清"); setRadio("difficulty", Number(d.difficulty) || 3);
    updateLevel(); updateTopics(); updateComplete();
    if (UI.level) UI.level.sync();
  }
  async function offerDraft() {
    const sess = cfg("editorSession", null);
    if (sess && sess.id && Date.now() - new Date(sess.at).getTime() < 12 * 3600000) {
      const q = S.questions.find((x) => x.id === sess.id);
      if (q) {
        S.editing = q.id; S.autoNew = sess.autoNew ? q.id : null; S.editOriginal = sess.autoNew ? null : (S.editOriginal || null);
        fillEditor(q); lastSig = editorSig(); S.savedAt = sess.at; setEditorMode(true); setSaveState("saved");
        return;
      }
    }
    const d = cfg("editorDraft", null);
    if (!d || (!d.question && !d.solution && !d.image && !d.answer && !d.topic)) return;
    const ok = await ask({ title: "找到上次沒存的草稿", body: "要接著編輯嗎 捨棄後無法找回", ok: "繼續編輯", cancel: "捨棄草稿", icon: "i-edit" });
    if (!ok) { await dbRequest("config", "delete", "editorDraft").catch(() => {}); delete S.cfg.editorDraft; return; }
    S.editing = d.editing && S.questions.some((q) => q.id === d.editing) ? d.editing : null;
    fillEditor(d); setEditorMode(!!S.editing);
    setTab("add"); toast("已還原草稿");
  }
  function resetEditor() {
    clearTimeout(OCR.autoTimer);
    if (OCR.running) stopOcr(true);
    OCR.lastAutoText = "";
    clearTimeout(saveTimer); saveTimer = null; savePending = false;
    if (S.db) { dbRequest("config", "delete", "editorDraft").catch(() => {}); dbRequest("config", "delete", "editorSession").catch(() => {}); }
    delete S.cfg.editorDraft; delete S.cfg.editorSession;
    releaseOcrSource(); $("questionForm").reset(); S.image = ""; S.visuals = []; S.editing = null; S.autoNew = null; S.editOriginal = null; previewImage(); previewVisuals();
    lastSig = ""; S.savedAt = null;
    setRadio("subject", firstSubject()); setRadio("reason", "觀念不清"); setRadio("difficulty", 3);
    setEditorMode(false); updateLevel(); updateTopics(); updateComplete();
    status("ocrStatus", OCR_DEFAULT_STATUS); status("saveStatus", "");
    $("ocrMeter").hidden = true; $("galleryInput").value = ""; $("cameraInput").value = "";
    if (UI.level) UI.level.sync();
    setSaveState("idle");
  }
  function previewImage() {
    const im = $("photoPreview");
    im.hidden = !S.image; $("photoEmpty").hidden = !!S.image; $("photoDrop").classList.toggle("has-img", !!S.image);
    if (S.image) im.src = S.image; else im.removeAttribute("src");
  }
  function processedImage(img, rotation) {
    rotation = rotation || 0;
    const edge = 1600, scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = rotation % 180 ? h : w; canvas.height = rotation % 180 ? w : h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rotation * Math.PI / 180); ctx.drawImage(img, -w / 2, -h / 2, w, h);
    let image = canvas.toDataURL("image/jpeg", 0.8);
    for (const quality of [0.7, 0.6, 0.5]) { if (image.length <= 700000) break; image = canvas.toDataURL("image/jpeg", quality); }
    return image;
  }
  async function loadPhoto(file) {
    if (!file) return;
    if (!/^image\//.test(file.type || "") && !/\.(heic|heif)$/i.test(file.name || "")) { toast("請選擇圖片檔", { tone: "warn" }); return; }
    if (file.size > 25 * 1024 * 1024) { toast("圖片太大 請選擇小於 25 MB 的圖片", { tone: "warn" }); return; }
    status("ocrStatus", "正在處理圖片");
    let url;
    try {
      url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error("decode")); img.src = url; });
      if (OCR.running) stopOcr(true);
      releaseOcrSource(); S.image = processedImage(img); rememberOcrSource(img);
      S.visuals = S.visuals.filter((v) => !String(v.title || "").startsWith("自動擷取："));
      previewImage(); previewVisuals(); scheduleDraft();
      status("ocrStatus", "圖片已加入 正在背景辨識文字與圖像");
      queueAutoScan();
      FX.haptic(8);
    } catch (e) { status("ocrStatus", "這張圖片無法讀取 請改用 JPG 或 PNG", true); }
    finally { if (url) URL.revokeObjectURL(url); }
  }
  async function rotatePhoto() {
    if (!S.image) { toast("請先加入圖片", { tone: "warn" }); return; }
    const img = new Image();
    try {
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error("rotate")); img.src = S.image; });
      const previousSource = OCR.source;
      const rotated = previousSource ? document.createElement("canvas") : null;
      if (rotated) {
        rotated.width = previousSource.height; rotated.height = previousSource.width;
        const g = rotated.getContext("2d");
        g.translate(rotated.width / 2, rotated.height / 2); g.rotate(Math.PI / 2);
        g.drawImage(previousSource, -previousSource.width / 2, -previousSource.height / 2);
      }
      S.image = processedImage(img, 90);
      releaseOcrSource();
      if (rotated) { OCR.source = rotated; OCR.sourceReady = true; }
      previewImage(); scheduleDraft(); queueAutoScan();
    } catch (e) { toast("無法旋轉這張照片", { tone: "warn" }); }
  }
  /* 高精度文字辨識 只在目前編輯工作階段保留高畫質來源
     題庫仍存縮圖 避免 IndexedDB 配額被原始照片填滿
     Tesseract 預設精度模型在瀏覽器本機執行 不上傳照片 */
  const OCR = {
    rect: { x: 0.04, y: 0.04, w: 0.92, h: 0.92 }, lang: "",
    worker: null, wLang: "", running: false, token: 0, idle: null,
    last: 0, watch: null, preloading: null, ready: false,
    mstate: "idle", mpct: 0, statusText: "",
    source: null, sourceReady: false, candidates: [], selected: 0, mode: "text", autoTimer: null, lastAutoText: ""
  };
  let ocrLoading = null;
  function releaseOcrSource() {
    if (OCR.source) { OCR.source.width = 0; OCR.source.height = 0; }
    OCR.source = null; OCR.sourceReady = false;
  }
  function rememberOcrSource(img) {
    const limit = S.lite || (navigator.deviceMemory && navigator.deviceMemory <= 3) ? 2600 : 4100;
    const scale = Math.min(1, limit / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const g = canvas.getContext("2d");
    if (!g) return;
    g.fillStyle = "#fff"; g.fillRect(0, 0, canvas.width, canvas.height);
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    OCR.source = canvas; OCR.sourceReady = true;
  }
  function ensureOCR() {
    if (window.Tesseract) return Promise.resolve();
    if (!ocrLoading) ocrLoading = new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
      tag.onload = () => (window.Tesseract ? resolve() : reject(new Error("ocr")));
      tag.onerror = () => reject(new Error("ocr"));
      document.head.appendChild(tag);
    }).catch((e) => { ocrLoading = null; throw e; });
    return ocrLoading;
  }
  const langForSubject = (sub) => (["英文", "英語"].includes(sub) ? "eng" : "chi_tra+eng");
  function ocrProgress(m) {
    OCR.last = Date.now();
    const steps = {
      "loading tesseract core": ["下載辨識程式", 2, 14], "initializing tesseract": ["啟動辨識程式", 14, 18],
      "loading language traineddata": ["下載精準語言模型", 18, 42], "loading language traineddata (from cache)": ["讀取語言資料", 18, 42],
      "initializing api": ["準備辨識", 42, 48], "recognizing text": ["辨識中", 48, 100]
    };
    const st = steps[m.status]; if (!st) return;
    const k = Math.max(0, Math.min(1, Number(m.progress) || 0));
    $("ocrProgBar").style.width = (st[1] + (st[2] - st[1]) * k).toFixed(1) + "%";
    $("ocrProgText").textContent = st[0] + " " + Math.round(k * 100) + "%";
  }
  async function dropWorker() {
    clearTimeout(OCR.idle);
    const w = OCR.worker; OCR.worker = null; OCR.wLang = "";
    if (w) { try { await w.terminate(); } catch (e) {} }
  }
  const OCR_DEFAULT_STATUS = "上傳圖片後會自動辨識文字和圖像 原圖保留供核對";
  function ocrModelUI(state, pct) {
    OCR.mstate = state; OCR.mpct = pct || 0;
    const texts = {
      ready: "高精度模型已下載 可直接辨識", downloading: "高精度模型下載中 " + Math.round(OCR.mpct) + "%",
      idle: "尚未下載高精度模型 首次使用會自動下載",
      failed: "模型下載失敗 請連網重試", offline: "目前沒有網路 連線後再下載", saver: "省流量模式開啟中 可手動下載"
    };
    $("ocrModelState").textContent = texts[state] || "";
    $("ocrModelBar").style.width = (state === "ready" ? 100 : state === "downloading" ? OCR.mpct : 0) + "%";
    $("ocrModelBtn").disabled = state === "downloading";
    $("ocrModelBtnText").textContent = state === "ready" ? "重新檢查檔案" : state === "downloading" ? "下載中" : "立即下載";
    const st = $("ocrStatus");
    if (!OCR.running && (st.textContent === OCR_DEFAULT_STATUS || st.textContent === OCR.statusText)) {
      const line = state === "ready" ? "文字模型已備妥 上傳圖片後自動處理" : state === "downloading" ? "高精度模型下載中 " + Math.round(OCR.mpct) + "%" : OCR_DEFAULT_STATUS;
      st.textContent = line; st.classList.remove("error"); OCR.statusText = line;
    }
  }
  function canPrefetch(manual) {
    if (navigator.onLine === false) { ocrModelUI("offline"); return false; }
    const c = navigator.connection;
    if (!manual && c && (c.saveData || /2g/.test(c.effectiveType || ""))) { ocrModelUI("saver"); return false; }
    return true;
  }
  function preloadOCR(manual) {
    if (OCR.preloading) return OCR.preloading;
    if (OCR.ready && !manual) return Promise.resolve();
    if (!canPrefetch(manual)) return Promise.resolve();
    ocrModelUI("downloading", 1);
    OCR.preloading = (async () => {
      let w = null;
      try {
        await ensureOCR();
        const span = { "loading tesseract core": [1, 30], "initializing tesseract": [30, 34], "loading language traineddata": [34, 92], "loading language traineddata (from cache)": [34, 92], "initializing api": [92, 99] };
        const logger = (m) => {
          const r = span[m.status]; if (r) ocrModelUI("downloading", r[0] + (r[1] - r[0]) * Math.max(0, Math.min(1, Number(m.progress) || 0)));
          if (OCR.running) ocrProgress(m);
        };
        // Tesseract 預設語言模型以準確率為優先 不再強制使用 tessdata_fast
        w = await Tesseract.createWorker("chi_tra+eng", 1, { logger });
        OCR.ready = true; localStorageSet("learneasyly-ocr-quality-v1", "1"); ocrModelUI("ready");
        const keep = S.tab === "add" || !$("ocrSheet").hidden;
        if (keep && !OCR.worker) {
          OCR.worker = w; OCR.wLang = "chi_tra+eng"; w = null;
          clearTimeout(OCR.idle); OCR.idle = setTimeout(() => { if (!OCR.running) dropWorker(); }, 180000);
        }
      } catch (e) { console.warn("ocr preload", e); ocrModelUI(navigator.onLine === false ? "offline" : "failed"); }
      finally { if (w) { try { await w.terminate(); } catch (e) {} } OCR.preloading = null; }
    })();
    return OCR.preloading;
  }
  function scheduleOcrPrefetch() {
    OCR.ready = localStorageGet("learneasyly-ocr-quality-v1") === "1";
    ocrModelUI(OCR.ready ? "ready" : "idle");
    if (OCR.ready || !cfg("ocrPrefetch", true) || S.lite) return;
    const go = () => { if (document.visibilityState === "visible" && !OCR.ready) preloadOCR(false); };
    setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 8000 }) : go()), 5000);
  }
  async function getWorker(lang) {
    if (OCR.preloading) { try { await OCR.preloading; } catch (e) {} }
    await ensureOCR();
    if (OCR.worker && OCR.wLang === lang) return OCR.worker;
    await dropWorker();
    OCR.worker = await Tesseract.createWorker(lang, 1, { logger: (m) => ocrProgress(m) });
    OCR.wLang = lang;
    OCR.ready = true; localStorageSet("learneasyly-ocr-quality-v1", "1");
    return OCR.worker;
  }
  function prepForOCR(img, r, variant) {
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const sx = Math.max(0, Math.round(r.x * W)), sy = Math.max(0, Math.round(r.y * H));
    const sw = Math.max(8, Math.min(W - sx, Math.round(r.w * W)));
    const sh = Math.max(8, Math.min(H - sy, Math.round(r.h * H)));
    const longest = Math.max(sw, sh);
    const limit = S.lite || (navigator.deviceMemory && navigator.deviceMemory <= 3) ? 2400 : 3400;
    const scale = Math.min(3, limit / longest);
    const cw = Math.max(8, Math.round(sw * scale)), ch = Math.max(8, Math.round(sh * scale));
    const c = document.createElement("canvas"); c.width = cw; c.height = ch;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.fillStyle = "#fff"; g.fillRect(0, 0, cw, ch);
    g.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    if (variant === "original") return c;
    const data = g.getImageData(0, 0, cw, ch), d = data.data;
    const hist = new Uint32Array(256), gray = new Uint8Array(cw * ch);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const v = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      gray[p] = v; hist[v]++;
    }
    if (variant === "adaptive") {
      // 區域自適應二值化 改善陰影及紙張泛黃 只在低可信度時啟用
      const stride = cw + 1, integral = new Uint32Array(stride * (ch + 1));
      for (let y = 0; y < ch; y++) {
        let sum = 0;
        for (let x = 0; x < cw; x++) {
          sum += gray[y * cw + x];
          integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + sum;
        }
      }
      const rad = Math.max(12, Math.min(45, Math.round(Math.min(cw, ch) / 45)));
      for (let y = 0; y < ch; y++) {
        const y0 = Math.max(0, y - rad), y1 = Math.min(ch, y + rad + 1);
        for (let x = 0; x < cw; x++) {
          const x0 = Math.max(0, x - rad), x1 = Math.min(cw, x + rad + 1);
          const area = (x1 - x0) * (y1 - y0);
          const mean = (integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0]) / area;
          const value = gray[y * cw + x] < mean - 10 ? 0 : 255;
          const i = (y * cw + x) * 4;
          d[i] = d[i + 1] = d[i + 2] = value; d[i + 3] = 255;
        }
      }
    } else {
      let lo = 0, hi = 255, acc = 0, total = cw * ch;
      for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.005) { lo = v; break; } }
      acc = 0;
      for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.005) { hi = v; break; } }
      const span = Math.max(70, hi - lo), strength = 0.83;
      for (let p = 0; p < gray.length; p++) {
        const raw = gray[p], adjusted = Math.max(0, Math.min(255, (raw - lo) * 255 / span));
        const v = Math.round(raw * (1 - strength) + adjusted * strength), i = p * 4;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
    }
    g.putImageData(data, 0, 0);
    return c;
  }
  const cleanOCR = (t) => String(t || "").replace(/\r/g, "")
    .replace(/([㐀-鿿　-〿＀-￯])[ \t]+(?=[㐀-鿿　-〿＀-￯])/g, "$1")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  function ocrQuality(result) {
    const text = cleanOCR(result && result.data && result.data.text);
    const raw = Number(result && result.data && result.data.confidence);
    const confidence = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
    const junk = (text.match(/[□�]/g) || []).length;
    return { text, confidence, score: confidence + Math.min(8, text.length / 12) - junk * 6, engine: "Tesseract" };
  }
  // Searchable PDFs are produced by the same on-device OCR pass.
  // Wrapping an image in PDF format cannot improve recognition accuracy.
  async function recognizeWithSearchablePdf(worker, canvas, withPdf = false) {
    let result;
    try {
      result = await worker.recognize(canvas, { pdfTitle: "Learn Angle 題目辨識" }, { pdf: !!withPdf, blocks: true });
    } catch (err) {
      console.warn("searchable PDF unavailable; keep the regular OCR result", err);
      result = await worker.recognize(canvas, {}, { blocks: true });
    }
    const recognized = ocrQuality(result);
    const bytes = result && result.data && result.data.pdf;
    recognized.pdf = bytes && bytes.length ? bytes : null;
    recognized.layout = Array.isArray(result && result.data && result.data.blocks) ? result.data.blocks : [];
    recognized.ocrWidth = canvas.width;
    recognized.ocrHeight = canvas.height;
    return recognized;
  }
  function downloadableOcrPdf() {
    const selected = OCR.candidates[OCR.selected];
    if (!selected || !selected.pdf || !selected.pdf.length) {
      toast("本次未產生可搜尋 PDF 可先複製辨識文字", { tone: "warn" });
      return;
    }
    const data = new Uint8Array(selected.pdf);
    const blob = new Blob([data], { type: "application/pdf" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "LearnAngle-OCR-result.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast("已準備 OCR 原始 PDF 文字仍需校對");
  }
  async function copyOcrReviewText() {
    const value = $("ocrReviewText").value;
    if (!value.trim()) { toast("目前沒有可複製的文字", { tone: "warn" }); return; }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const field = $("ocrReviewText");
        field.focus();
        field.select();
        if (!document.execCommand("copy")) throw new Error("copy unsupported");
      }
      toast("已複製辨識文字 可直接貼到題目欄位");
    } catch (e) {
      $("ocrReviewText").focus();
      $("ocrReviewText").select();
      toast("請長按文字選擇複製", { tone: "warn" });
    }
  }
  function ocrPhotoPreview(img, r) {
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const x = r.x * W, y = r.y * H, w = Math.max(1, r.w * W), h = Math.max(1, r.h * H);
    const scale = Math.min(1, 1100 / Math.max(w, h));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  }



  // PP-OCRv5: an independent OCR architecture for difficult Chinese print.
  // Progressive enhancement: never require its CDN or ONNX models to use the app.
  const NEURAL = { instance: null, loading: null, blocked: false, toTW: null };
  async function getNeuralOcr() {
    if (NEURAL.instance) return NEURAL.instance;
    if (NEURAL.blocked || navigator.onLine === false) return null;
    if (!NEURAL.loading) NEURAL.loading = (async () => {
      const module = await import("https://esm.sh/@paddleocr/paddleocr-js@0.4.2?bundle");
      const OCRModel = module.PaddleOCR || (module.default && module.default.PaddleOCR);
      if (!OCRModel || !OCRModel.create) throw new Error("PaddleOCR module not available");
      return OCRModel.create({
        lang: "ch", ocrVersion: "PP-OCRv5", worker: false,
        textDetectionBatchSize: 1, textRecognitionBatchSize: 2,
        ortOptions: { backend: "wasm", numThreads: 1, simd: true }
      });
    })().then((ocr) => (NEURAL.instance = ocr)).catch((error) => {
      NEURAL.blocked = true;
      console.warn("PP-OCRv5 is unavailable, retaining local Tesseract", error);
      return null;
    }).finally(() => { NEURAL.loading = null; });
    return NEURAL.loading;
  }
  function neuralBBox(poly) {
    if (!Array.isArray(poly) || !poly.length) return null;
    const points = Array.isArray(poly[0]) ? poly : typeof poly[0] === "number"
      ? [poly.slice(0, 2), poly.slice(2, 4), poly.slice(4, 6), poly.slice(6, 8)] : [];
    const x = points.map((p) => Number(p[0])).filter(Number.isFinite);
    const y = points.map((p) => Number(p[1])).filter(Number.isFinite);
    if (x.length < 2 || y.length < 2) return null;
    return { x0: Math.min(...x), x1: Math.max(...x), y0: Math.min(...y), y1: Math.max(...y) };
  }
  async function convertToTraditional(value) {
    if (!/[汉语国会题图认]/.test(value)) return value;
    try {
      if (!NEURAL.toTW) {
        const module = await import("https://cdn.jsdelivr.net/npm/opencc-js@1.5.0-beta.0/dist/esm/full.js");
        const OpenCC = module.default || module;
        NEURAL.toTW = OpenCC.Converter({ from: "cn", to: "tw" });
      }
      return NEURAL.toTW(value);
    } catch (error) { console.warn("Optional script conversion skipped", error); return value; }
  }
  async function recognizeNeural(image) {
    const ocr = await getNeuralOcr();
    if (!ocr) return null;
    const data = await ocr.predict(image);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result || !Array.isArray(result.items)) return null;
    const lines = result.items.map((item) => ({
      text: String(item.text || "").trim(),
      bbox: neuralBBox(item.poly || item.polygon || item.points),
      score: Number(item.score)
    })).filter((item) => item.text);
    // Sort text by visual rows, then left-to-right within each row.
    lines.sort((a, b) => {
      if (!a.bbox || !b.bbox) return 0;
      const ay = (a.bbox.y0 + a.bbox.y1)/2, by = (b.bbox.y0 + b.bbox.y1)/2;
      const tolerance = Math.min(a.bbox.y1 - a.bbox.y0, b.bbox.y1 - b.bbox.y0) * .4;
      return Math.abs(ay - by) < tolerance ? a.bbox.x0 - b.bbox.x0 : ay - by;
    });
    const textValue = cleanOCR(await convertToTraditional(lines.map((l) => l.text).join("\n")));
    const scores = lines.map((l) => l.score).filter(Number.isFinite);
    const confidence = scores.length ? scores.reduce((a, b) => a+b, 0) / scores.length * 100 : 0;
    const layout = [{ paragraphs: [{ lines: lines.filter((l) => l.bbox).map((l) => ({
      words: [{ text: l.text, bbox: l.bbox }]
    })) }] }];
    return { text: textValue, confidence: Math.max(0, Math.min(100, confidence)),
      score: confidence + Math.min(8, textValue.length / 12),
      engine: "PaddleOCR", pdf: null, layout, ocrWidth: image.width, ocrHeight: image.height };
  }
  function rankOcr(c, isMath) {
    const t = cleanOCR(c && c.text);
    if (!t) return -Infinity;
    const han = (t.match(/[\u3400-\u9fff]/g) || []).length;
    const good = (t.match(/[\u3400-\u9fffA-Za-z0-9]/g) || []).length;
    const junk = (t.match(/[□�]/g) || []).length;
    const punctuation = (t.match(/[\u25a0-\u25ff]/g) || []).length;
    const math = isMath && /[=＋+－\\-×÷∠√∑:：²³]/.test(t) ? 2 : 0;
    return Math.min(88, Number(c.confidence || 0)) * .55 +
      Math.min(16, han * .22) + Math.min(10, t.length * .07) +
      math - junk * 15 - punctuation * 5 - 14 * (1 - good / Math.max(1, t.length));
  }
  function sortOcr(candidates, isMath) {
    return candidates.filter((x) => x && x.text).sort((a, b) => rankOcr(b,isMath) - rankOcr(a,isMath));
  }

  // Uploads are processed on the current device without sending images to a paid API.
  // A new photo invalidates any in-flight recognition result so earlier photos cannot overwrite edits.
  function queueAutoScan() {
    clearTimeout(OCR.autoTimer);
    if (OCR.running) stopOcr(true);
    OCR.token++;
    const sourceKey = S.image;
    if (!sourceKey) return;
    OCR.autoTimer = setTimeout(() => {
      if (S.image !== sourceKey) return;
      OCR.lang = langForSubject(radioVal("subject", ""));
      runOcr(true, true);
    }, 350);
  }

  // Detect residual ink after masking recognized words.  This is deliberately
  // conservative: a chart's values must never be invented from image pixels.
  function automaticVisuals(source, primary) {
    const srcW = source.naturalWidth || source.width, srcH = source.naturalHeight || source.height;
    const blocks = Array.isArray(primary.layout) ? primary.layout : [];
    const words = [];
    for (const block of blocks) for (const paragraph of (block.paragraphs || []))
      for (const line of (paragraph.lines || [])) for (const word of (line.words || []))
        if (word.bbox && String(word.text || "").trim()) words.push(word.bbox);
    // Without enough reliable text positions a region could just be unrecognized prose.
    if (words.length < 5 || !primary.ocrWidth || !primary.ocrHeight) return [];
    const factor = Math.min(1, 520 / Math.max(srcW, srcH));
    const w = Math.round(srcW * factor), h = Math.round(srcH * factor);
    if (!w || !h) return [];
    const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(source, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w * h);
    for (const b of words) {
      const x0 = Math.max(0, Math.floor(b.x0 / primary.ocrWidth * w) - 3);
      const y0 = Math.max(0, Math.floor(b.y0 / primary.ocrHeight * h) - 3);
      const x1 = Math.min(w, Math.ceil(b.x1 / primary.ocrWidth * w) + 3);
      const y1 = Math.min(h, Math.ceil(b.y1 / primary.ocrHeight * h) + 3);
      for (let y = y0; y < y1; y++) mask.fill(1, y * w + x0, y * w + x1);
    }
    const cell = 8, cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
    const counts = new Uint16Array(cols * rows);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; if (mask[p]) continue;
      const i = p * 4, lum = .299 * pixels[i] + .587 * pixels[i + 1] + .114 * pixels[i + 2];
      if (lum < 145) counts[Math.floor(y / cell) * cols + Math.floor(x / cell)]++;
    }
    const occupied = new Uint8Array(cols * rows);
    for (let i = 0; i < counts.length; i++) if (counts[i] >= 3) occupied[i] = 1;
    const linked = new Uint8Array(occupied.length);
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      if (!occupied[cy * cols + cx]) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) linked[ny * cols + nx] = 1;
      }
    }
    const seen = new Uint8Array(linked.length), regions = [];
    for (let i = 0; i < linked.length; i++) {
      if (!linked[i] || seen[i]) continue;
      let left = cols, top = rows, right = 0, bottom = 0, ink = 0;
      const queue = [i]; seen[i] = 1;
      for (let q = 0; q < queue.length; q++) {
        const at = queue[q], x = at % cols, y = Math.floor(at / cols);
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
        ink += counts[at];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const ni = ny * cols + nx;
          if (linked[ni] && !seen[ni]) { seen[ni] = 1; queue.push(ni); }
        }
      }
      const rw = (right - left + 1) * cell, rh = (bottom - top + 1) * cell;
      const frac = rw * rh / (w * h);
      if (rw < w * .20 || rh < h * .12 || frac < .025 || frac > .72 || ink < 60) continue;
      const pad = cell * 2;
      regions.push({ x0: Math.max(0, left * cell - pad), y0: Math.max(0, top * cell - pad),
        x1: Math.min(w, (right + 1) * cell + pad), y1: Math.min(h, (bottom + 1) * cell + pad),
        area: rw * rh });
    }
    regions.sort((a, b) => b.area - a.area);
    const chosen = [];
    for (const r of regions) {
      const overlap = chosen.some((c) => {
        const iw = Math.max(0, Math.min(r.x1, c.x1) - Math.max(r.x0, c.x0));
        const ih = Math.max(0, Math.min(r.y1, c.y1) - Math.max(r.y0, c.y0));
        return iw * ih > .45 * Math.min((r.x1-r.x0)*(r.y1-r.y0), (c.x1-c.x0)*(c.y1-c.y0));
      });
      if (!overlap) chosen.push(r);
      if (chosen.length === 4) break;
    }
    return chosen.sort((a, b) => a.y0 - b.y0).map((r, idx) => {
      // Long perpendicular strokes are a hint, not proof, that this is a plotted chart.
      let horizontal = 0, vertical = 0;
      for (let y = Math.floor(r.y0); y < r.y1; y += 3) {
        let longest = 0, run = 0;
        for (let x = Math.floor(r.x0); x < r.x1; x++) {
          const p = (y * w + x) * 4, dark = (.299*pixels[p]+.587*pixels[p+1]+.114*pixels[p+2]) < 155;
          run = dark ? run + 1 : 0; longest = Math.max(longest, run);
        }
        if (longest > (r.x1-r.x0)*.4) horizontal++;
      }
      for (let x = Math.floor(r.x0); x < r.x1; x += 3) {
        let longest = 0, run = 0;
        for (let y = Math.floor(r.y0); y < r.y1; y++) {
          const p = (y * w + x) * 4, dark = (.299*pixels[p]+.587*pixels[p+1]+.114*pixels[p+2]) < 155;
          run = dark ? run + 1 : 0; longest = Math.max(longest, run);
        }
        if (longest > (r.y1-r.y0)*.4) vertical++;
      }
      const isChart = horizontal >= 1 && vertical >= 1;
      const crop = ocrPhotoPreview(source, { x: r.x0 / w, y: r.y0 / h, w: (r.x1-r.x0)/w, h:(r.y1-r.y0)/h });
      return { id: uid(), kind: isChart ? "chart" : "illustration",
        image: crop, original: isChart ? crop : "", title: "自動擷取：" + (isChart ? "圖表" : "示圖") + " " + (idx+1),
        chartType: "line", xAxis: "", yAxis: "", chartData: "" };
    });
  }

  /* 圖文分區：保留舊題目相容的手動圖表編輯流程 */
  const CHART = { crop: "", editId: null };
  function previewVisuals() {
    const list = $("visualList");
    const items = normalizedVisuals(S.visuals);
    list.innerHTML = items.length ? items.map((v, i) =>
      '<article class="visual-card"><img src="' + v.image + '" alt="' + esc(v.kind === "chart" ? "圖表" : "示圖") + '">' +
      '<div class="visual-card-info"><strong>' + esc(v.title || (v.kind === "chart" ? "重製圖表" : "裁切示圖")) + '</strong><small>' +
      (v.kind === "chart" ? (v.chartData ? "圖表數據可再編輯" : "圖表原圖已獨立保存 未推測數值") : "示圖已獨立保存 不混入題目文字") +
      '</small><div class="visual-card-actions">' +
      (v.kind === "chart" && v.chartData ? '<button type="button" data-visual-edit="' + esc(v.id) + '">編輯圖表</button>' : "") +
      '<button type="button" data-visual-remove="' + esc(v.id) + '">移除區塊</button></div></div></article>'
    ).join("") : '<p class="visual-empty">上傳圖片後會在背景辨識圖表及示圖 若未偵測到可疑圖像則保留完整原圖</p>';
    $("visualCount").textContent = items.length ? items.length + " 個區塊" : "";
  }
  function addVisual(v) {
    if (S.visuals.length >= 12) { toast("每題最多保存十二個圖像區塊", { tone: "warn" }); return false; }
    S.visuals.push(v); previewVisuals(); scheduleDraft(); FX.haptic(8);
    return true;
  }
  function setOcrMode(mode) {
    OCR.mode = ["text", "chart", "illustration"].includes(mode) ? mode : "text";
    all("#ocrModes [data-ocr-mode]").forEach((b) => {
      const active = b.dataset.ocrMode === OCR.mode;
      b.classList.toggle("active", active); b.setAttribute("aria-pressed", String(active));
    });
    $("ocrLang").hidden = OCR.mode !== "text";
    $("ocrAll").hidden = OCR.mode !== "text";
    const labels = { text: "辨識選取文字", chart: "擷取並重製圖表", illustration: "裁切儲存示圖" };
    $("ocrGo").innerHTML = icon(OCR.mode === "text" ? "i-scan" : "i-image") + labels[OCR.mode];
    $("ocrTip").textContent = {
      text: "只圈選文字區域 圖表及示圖請切換專用模式",
      chart: "圈選整張圖表 再輸入正確數據重製 不會猜測圖表數值",
      illustration: "圈選幾何圖與照片等示圖 直接擷取成獨立圖片"
    }[OCR.mode];
  }
  async function cropSelectedRegion() {
    let img = OCR.sourceReady ? OCR.source : null;
    if (!img) {
      img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve; img.onerror = reject; img.src = S.image;
      });
    }
    if (!img) throw new Error("missing image");
    return ocrPhotoPreview(img, OCR.rect);
  }
  function chartRows(value) {
    const lines = String(value || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length < 2 || lines.length > 40) return null;
    const parsed = [];
    for (const line of lines) {
      const parts = line.split(/[,，\t ]+/).filter(Boolean);
      if (parts.length < 2) return null;
      const y = Number(parts.pop());
      if (!Number.isFinite(y)) return null;
      parsed.push({ name: parts.join(" ").slice(0, 24), value: y });
    }
    return parsed;
  }
  function paintChart(canvas, rows, type, title, xAxis, yAxis) {
    if (!canvas || !rows) return;
    canvas.width = 1100; canvas.height = 680;
    const g = canvas.getContext("2d");
    if (!g) return;
    const w = canvas.width, h = canvas.height, l = 122, right = 65, top = 94, bottom = 144;
    const plotW = w - l - right, plotH = h - top - bottom;
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#233d58"; g.textAlign = "center"; g.font = "bold 28px system-ui";
    g.fillText(String(title || "圖表重製").slice(0, 45), w / 2, 52);
    const numbers = rows.map((p) => p.value);
    let min = Math.min(...numbers, 0), max = Math.max(...numbers, 0);
    if (max === min) { max = min + 1; min -= 1; }
    const step = (max - min) / 5; const valY = (v) => top + (max - v) / (max - min) * plotH;
    g.strokeStyle = "#e1e8ef"; g.lineWidth = 2;
    g.fillStyle = "#536377"; g.textAlign = "right"; g.font = "19px system-ui";
    for (let i = 0; i <= 5; i++) {
      const v = min + step * i, y = valY(v);
      g.beginPath(); g.moveTo(l, y); g.lineTo(l + plotW, y); g.stroke();
      g.fillText(Number(v.toFixed(2)).toString(), l - 13, y + 7);
    }
    g.strokeStyle = "#314a61"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(l, top); g.lineTo(l, top + plotH); g.lineTo(l + plotW, top + plotH); g.stroke();
    const gap = plotW / rows.length;
    const numericXs = type !== "bar" && rows.every((p) => p.name.trim() !== "" && Number.isFinite(Number(p.name)));
    const xs = numericXs ? rows.map((p) => Number(p.name)) : [];
    const xMin = numericXs ? Math.min(...xs) : 0, xMax = numericXs ? Math.max(...xs) : 1;
    const xFor = (i) => numericXs && xMax !== xMin ? l + (xs[i] - xMin) / (xMax - xMin) * plotW : l + gap * (i + .5);
    g.font = "18px system-ui"; g.fillStyle = "#35495d"; g.textAlign = "center";
    if (numericXs && xMax !== xMin) {
      for (let i = 0; i <= 5; i++) {
        const t = i / 5, val = xMin + (xMax - xMin) * t;
        g.fillText(Number(val.toFixed(2)).toString(), l + plotW * t, top + plotH + 31);
      }
    } else rows.forEach((p, i) => {
      if (rows.length > 12 && i % Math.ceil(rows.length / 12) !== 0) return;
      const name = p.name.length > 9 ? p.name.slice(0, 8) + "…" : p.name;
      g.fillText(name, xFor(i), top + plotH + 31);
    });
    g.strokeStyle = "#2f5f8f"; g.fillStyle = "#4f8bbf"; g.lineWidth = 5;
    if (type === "bar") {
      rows.forEach((p, i) => {
        const y = valY(p.value), zero = valY(0), bw = Math.max(5, gap * .65);
        g.fillRect(xFor(i) - bw / 2, Math.min(y, zero), bw, Math.max(1, Math.abs(zero - y)));
      });
    } else {
      if (type === "line") {
        g.beginPath();
        rows.forEach((p, i) => { const x = xFor(i), y = valY(p.value); i ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.stroke();
      }
      rows.forEach((p, i) => {
        g.beginPath(); g.arc(xFor(i), valY(p.value), 7, 0, Math.PI * 2); g.fill();
      });
    }
    g.font = "21px system-ui"; g.fillStyle = "#33495d"; g.textAlign = "center";
    g.fillText(String(xAxis || "橫軸").slice(0, 30), l + plotW / 2, h - 35);
    g.save(); g.translate(35, top + plotH / 2); g.rotate(-Math.PI / 2);
    g.fillText(String(yAxis || "縱軸").slice(0, 30), 0, 0); g.restore();
    g.font = "15px system-ui"; g.fillStyle = "#718194"; g.textAlign = "right";
    g.fillText("由校正數據重製", w - 26, h - 26);
  }
  function chartPreview() {
    const parsed = chartRows($("chartData").value);
    const scatterNeedsNumbers = $("chartType").value === "scatter" && parsed && parsed.some((p) => !Number.isFinite(Number(p.name)));
    const rows = scatterNeedsNumbers ? null : parsed;
    $("chartHint").textContent = scatterNeedsNumbers ? "散點圖橫軸必須輸入數字 請對照原圖校正" : rows ? "已讀取 " + rows.length + " 筆資料 可再對照原圖校正" : "請輸入二至四十筆資料 每行為標籤空格數值";
    $("chartHint").classList.toggle("warn", !rows);
    const canvas = $("chartCanvas");
    if (rows) paintChart(canvas, rows, $("chartType").value, $("chartTitle").value, $("chartXAxis").value, $("chartYAxis").value);
    else { const g = canvas.getContext("2d"); g.clearRect(0, 0, canvas.width, canvas.height); }
    $("chartSave").disabled = !rows;
  }
  function showChartEditor(v) {
    CHART.crop = safeImage(v && (v.original || v.image)) || CHART.crop;
    CHART.editId = v && v.id || null;
    $("chartOriginal").src = CHART.crop;
    $("chartType").value = v && v.chartType || "line";
    $("chartTitle").value = v && v.title || "";
    $("chartXAxis").value = v && v.xAxis || "";
    $("chartYAxis").value = v && v.yAxis || "";
    $("chartData").value = v && v.chartData || "";
    $("chartKeep").hidden = !!CHART.editId;
    chartPreview();
    openOverlay($("chartSheet"));
  }
  async function chooseVisualRegion() {
    if (!S.image || OCR.running) return;
    if (OCR.mode === "text") { runOcr(false); return; }
    $("ocrGo").disabled = true;
    try {
      const crop = await cropSelectedRegion();
      if (OCR.mode === "illustration") {
        if (addVisual({ id: uid(), kind: "illustration", image: crop, original: "", title: "裁切示圖" })) {
          closeOverlay($("ocrSheet")); status("ocrStatus", "示圖已獨立擷取並自動儲存"); toast("已儲存示圖 不會混入文字");
        }
      } else {
        closeOverlay($("ocrSheet"));
        await new Promise((resolve) => whenSettled(resolve));
        CHART.crop = crop; showChartEditor(null);
      }
    } catch (e) { console.error(e); toast("無法裁切這個區域 請重新選取", { tone: "warn" }); }
    finally { $("ocrGo").disabled = false; }
  }
  function saveChartFigure(keepOriginal) {
    const previous = S.visuals.find((v) => v.id === CHART.editId);
    let figure;
    if (keepOriginal) {
      figure = { id: uid(), kind: "illustration", image: CHART.crop, title: $("chartTitle").value.trim() || "圖表原圖" };
    } else {
      const rows = chartRows($("chartData").value);
      if (!rows || ($("chartType").value === "scatter" && rows.some((p) => !Number.isFinite(Number(p.name))))) { toast("請先輸入有效的圖表數據", { tone: "warn" }); return; }
      const canvas = $("chartCanvas");
      paintChart(canvas, rows, $("chartType").value, $("chartTitle").value, $("chartXAxis").value, $("chartYAxis").value);
      figure = {
        id: CHART.editId || uid(), kind: "chart", image: canvas.toDataURL("image/png"),
        original: safeImage(CHART.crop), title: $("chartTitle").value.trim() || "重製圖表",
        chartType: $("chartType").value, xAxis: $("chartXAxis").value.trim(),
        yAxis: $("chartYAxis").value.trim(), chartData: $("chartData").value.trim()
      };
    }
    if (previous) {
      S.visuals = S.visuals.map((v) => v.id === previous.id ? figure : v);
      previewVisuals(); scheduleDraft();
    } else if (!addVisual(figure)) return;
    closeOverlay($("chartSheet"));
    status("ocrStatus", keepOriginal ? "已保留圖表原圖 可稍後重製" : "圖表已依照輸入資料重新繪製並自動儲存");
    toast(keepOriginal ? "已保留圖表裁圖" : "圖表重製完成");
    CHART.crop = ""; CHART.editId = null;
  }
  function wireVisuals() {
    $("runVisual").addEventListener("click", () => openOcr("chart"));
    $("visualList").addEventListener("click", (e) => {
      const remove = e.target.closest("[data-visual-remove]");
      const edit = e.target.closest("[data-visual-edit]");
      if (remove) {
        S.visuals = S.visuals.filter((v) => v.id !== remove.dataset.visualRemove);
        previewVisuals(); scheduleDraft();
      } else if (edit) {
        const v = S.visuals.find((x) => x.id === edit.dataset.visualEdit);
        if (v && v.kind === "chart") showChartEditor(v);
      }
    });
    $("chartClose").addEventListener("click", () => closeOverlay($("chartSheet")));
    $("chartKeep").addEventListener("click", () => saveChartFigure(true));
    $("chartSave").addEventListener("click", () => saveChartFigure(false));
    ["chartData", "chartTitle", "chartXAxis", "chartYAxis"].forEach((id) => $(id).addEventListener("input", chartPreview));
    $("chartType").addEventListener("change", chartPreview);
  }

  function layoutSel() {
    const r = OCR.rect, sel = $("ocrSel");
    sel.style.left = r.x * 100 + "%"; sel.style.top = r.y * 100 + "%"; sel.style.width = r.w * 100 + "%"; sel.style.height = r.h * 100 + "%";
  }
  function setOcrBusy(on) {
    $("ocrSheet").classList.toggle("busy", on);
    $("ocrProg").hidden = !on; $("ocrGo").disabled = on; $("ocrAll").disabled = on; all("#ocrModes button").forEach((b) => b.disabled = on);
    $("ocrCancel").textContent = on ? "停止辨識" : "取消";
    all("#ocrLang .seg-item").forEach((b) => { b.disabled = on; });
  }
  function openOcr(mode) {
    if (!S.image) { toast("請先加入圖片", { tone: "warn" }); return; }
    OCR.lang = langForSubject(radioVal("subject", ""));
    all("#ocrLang .seg-item").forEach((b) => b.classList.toggle("active", b.dataset.lang === OCR.lang));
    const tip = $("ocrTip"); tip.classList.remove("warn");
    setOcrMode(mode);
    $("ocrImg").src = S.image; layoutSel(); setOcrBusy(false);
    openOverlay($("ocrSheet"));
    $("ocrSheet")._onClose = () => { if (OCR.running) stopOcr(true); };
    requestAnimationFrame(() => { if (UI.ocrLang) UI.ocrLang.sync(true); });
  }
  function stopOcr(silent) {
    OCR.token++; OCR.running = false; clearInterval(OCR.watch);
    dropWorker();
    setOcrBusy(false);
    if (!silent) $("ocrTip").textContent = "已停止辨識 可以重新圈選範圍";
  }
  function showOcrResult(candidates, originalPreview) {
    OCR.candidates = candidates;
    OCR.selected = 0;
    $("ocrReviewImg").src = originalPreview;
    setOcrCandidate(OCR.selected);
    $("ocrReviewAlt").hidden = candidates.length < 2;
    openOverlay($("ocrReview"));
    $("ocrReview")._onClose = () => {
      $("ocrReviewImg").removeAttribute("src"); OCR.candidates = [];
    };
    setTimeout(() => $("ocrReviewText").focus({ preventScroll: true }), 70);
  }
  function setOcrCandidate(index) {
    const c = OCR.candidates[index]; if (!c) return;
    OCR.selected = index;
    $("ocrReviewText").value = c.text;
    const warning = c.confidence < 80 || /數學/.test(radioVal("subject", ""));
    $("ocrReviewScore").textContent = (c.engine || "文字辨識") + " 模型參考分 " + Math.round(c.confidence) + " 非正確率";
    $("ocrReviewScore").classList.toggle("warn", warning);
    $("ocrReviewHint").textContent = warning
      ? "請逐字比對原圖 尤其是數字 正負號 分數 根號與上下標 辨識分數不代表正確率"
      : "請對照原圖檢查內容 文字辨識仍有可能漏字或認錯";
    $("ocrReviewAlt").textContent = index === 0 ? "查看另一模型辨識結果" : "返回建議結果";
    $("ocrReviewPdf").disabled = !(c.pdf && c.pdf.length);
    $("ocrReviewPdf").title = c.pdf ? "下載 OCR 產生的原始可搜尋 PDF" : "本次未產生 PDF";
  }
  async function runOcr(full, automatic = false) {
    if (OCR.running || !S.image) return;
    const token = ++OCR.token;
    const imageAtStart = S.image;
    OCR.running = true; OCR.last = Date.now();
    if (automatic) status("ocrStatus", "背景正在分析文字與圖像 請勿關閉此頁");
    setOcrBusy(true); $("ocrProgBar").style.width = "2%"; $("ocrProgText").textContent = "準備中";
    const tip = $("ocrTip"); tip.classList.remove("warn");
    tip.textContent = OCR.worker && OCR.wLang === OCR.lang ? "正在以高精度模型辨識" : "首次使用需下載高精度模型 檔案較大";
    OCR.watch = setInterval(() => {
      if (Date.now() - OCR.last > 25000) { tip.classList.add("warn"); tip.textContent = "辨識需要較多運算 請稍候 或停止後縮小選取範圍"; }
    }, 4000);
    try {
      let img = OCR.sourceReady ? OCR.source : null;
      if (!img) {
        img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("img")); img.src = S.image; });
      }
      const r = full ? { x: 0, y: 0, w: 1, h: 1 } : OCR.rect;
      const originalPreview = ocrPhotoPreview(img, r);
      const canvas = prepForOCR(img, r, "balanced");
      const w = await getWorker(OCR.lang);
      if (token !== OCR.token) return;
      await w.setParameters({ tessedit_pageseg_mode: full ? "3" : "6", preserve_interword_spaces: "1" });
      const primary = await recognizeWithSearchablePdf(w, canvas, !automatic);
      if (token !== OCR.token) return;
      const candidates = [primary];
      const isMath = /數學/.test(radioVal("subject", ""));
      const lowQuality = full || primary.confidence < 85 || primary.text.length < 8;
      const lowMemory = S.lite || (navigator.deviceMemory && navigator.deviceMemory <= 3);
      if ((lowQuality || isMath) && !lowMemory) {
        OCR.last = Date.now();
        tip.textContent = "正在嘗試另一種影像處理方式";
        $("ocrProgText").textContent = "加強辨識中";
        try {
          const alt = prepForOCR(img, r, "adaptive");
          await w.setParameters({ tessedit_pageseg_mode: full ? "6" : "11", preserve_interword_spaces: "1" });
          const second = await recognizeWithSearchablePdf(w, alt);
          if (token !== OCR.token) return;
          if (second.text && second.text !== primary.text) candidates.push(second);
        } catch (err) { console.warn("ocr alternative", err); }
      }
      // Compare a third, unfiltered read when a mathematical question still looks uncertain.
      // Aggressive thresholding can delete faint minus signs and fraction bars.
      const bestConfidence = Math.max(...candidates.map((x) => x.confidence));
      if ((isMath || bestConfidence < 68) && !lowMemory && canvas.width * canvas.height <= 6500000) {
        OCR.last = Date.now();
        try {
          const natural = prepForOCR(img, r, "original");
          await w.setParameters({ tessedit_pageseg_mode: full ? "3" : "6", preserve_interword_spaces: "1" });
          const third = await recognizeWithSearchablePdf(w, natural);
          if (token !== OCR.token) return;
          if (third.text && !candidates.some((x) => x.text === third.text)) candidates.push(third);
        } catch (e) { console.warn("original image OCR", e); }
      }
      // Cross-check the hard cases with an independent local neural OCR engine.
      if ((isMath || candidates.every((x) => x.confidence < 85)) &&
          !S.lite && !(navigator.connection && navigator.connection.saveData)) {
        try {
          OCR.last = Date.now();
          $("ocrProgText").textContent = "正在進行跨模型校對";
          if (automatic) status("ocrStatus", "正在用第二套文字模型校對 仍於本機執行");
          const neural = await recognizeNeural(prepForOCR(img, r, "original"));
          if (token !== OCR.token) return;
          if (neural && neural.text && !candidates.some((x) => x.text === neural.text)) candidates.push(neural);
        } catch (error) { console.warn("Neural comparison unavailable", error); }
      }
      OCR.running = false; clearInterval(OCR.watch); setOcrBusy(false);
      if (!candidates.some((x) => x.text) && !automatic) { tip.classList.add("warn"); tip.textContent = "沒有辨識到文字 請調整圈選範圍 或用清晰照片再試"; return; }
      closeOverlay($("ocrSheet"));
      await new Promise((resolve) => whenSettled(resolve));
      if (token !== OCR.token || S.image !== imageAtStart) return;
      if (automatic) {
        const ordered = sortOcr(candidates, isMath);
        const best = ordered[0];
        const competing = ordered[1];
        const uncertainMath = isMath && !!competing &&
          ((best.text.match(/[0-9]+(?:\\.[0-9]+)?/g) || []).join(",") !==
           (competing.text.match(/[0-9]+(?:\\.[0-9]+)?/g) || []).join(","));
        if (best) {
          const input = $("questionText");
          if (!input.value.trim() || input.value === OCR.lastAutoText) {
            input.value = best.text; OCR.lastAutoText = best.text; scheduleDraft();
          }
        }
        try {
          const regions = automaticVisuals(img, candidates.find((x) => x.engine === "PaddleOCR" && x.layout && x.layout.length) || primary);
          S.visuals = S.visuals.filter((v) => !String(v.title || "").startsWith("自動擷取："));
          const room = Math.max(0, 12 - S.visuals.length);
          if (room && regions.length) S.visuals.push(...regions.slice(0, room));
          previewVisuals(); scheduleDraft();
          status("ocrStatus", best
            ? (uncertainMath ? "不同模型讀到的數字有差異 " : "文字已辨識 ") +
              (regions.length ? "另擷取 " + Math.min(regions.length, room) + " 個圖像區塊 " : "") +
              "請對照原圖核對公式與數字"
            : "未辨識到可靠文字 原始圖片已保留 請手動輸入");
        } catch (e) {
          console.warn("automatic visual extraction", e);
          status("ocrStatus", "文字已辨識 圖像分區未完成 原始圖片仍完整保留");
        }
        return;
      }
      showOcrResult(sortOcr(candidates, isMath).slice(0, 2), originalPreview);
    } catch (e) {
      if (token !== OCR.token) return;
      console.error(e);
      OCR.running = false; clearInterval(OCR.watch); setOcrBusy(false); dropWorker();
      tip.classList.add("warn");
      tip.textContent = navigator.onLine === false ? "離線尚未備妥語言模型 請連網後重試" : "辨識程式無法啟動 請重試 或使用手機內建選取文字";
      if (automatic) status("ocrStatus", tip.textContent, true);
    } finally {
      clearTimeout(OCR.idle);
      OCR.idle = setTimeout(() => { if (!OCR.running) dropWorker(); }, 180000);
    }
  }
  async function applyOcrReview() {
    const text = cleanOCR($("ocrReviewText").value);
    if (!text) { toast("請先輸入或校正辨識文字", { tone: "warn" }); $("ocrReviewText").focus(); return; }
    const current = $("questionText").value.trim();
    closeOverlay($("ocrReview"));
    await new Promise((resolve) => whenSettled(resolve));
    let replace = true;
    if (current) replace = await ask({ title: "要怎麼放入辨識結果", body: "題目已經有內容 你可以取代原本文字 或接在後面", ok: "取代原本文字", cancel: "接在後面", icon: "i-scan" });
    $("questionText").value = replace || !current ? text : current + "\n" + text;
    scheduleDraft();
    status("ocrStatus", "已確認辨識內容並自動儲存 數學符號請再對照原圖");
    toast("已加入題目文字", { icon: "i-scan" });
    FX.haptic(10);
  }
  function wireOcr() {
    const stage = $("ocrStage"), sel = $("ocrSel");
    let drag = null;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    stage.addEventListener("pointerdown", (e) => {
      if (OCR.running) return;
      e.preventDefault();
      const b = stage.getBoundingClientRect();
      const px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
      const h = e.target.dataset && e.target.dataset.h;
      const r = Object.assign({}, OCR.rect);
      const inside = px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
      drag = { mode: h || (inside ? "move" : "new"), sx: px, sy: py, r, b };
      if (drag.mode === "new") { OCR.rect = { x: px, y: py, w: 0.001, h: 0.001 }; layoutSel(); }
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    stage.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const b = drag.b, px = clamp((e.clientX - b.left) / b.width, 0, 1), py = clamp((e.clientY - b.top) / b.height, 0, 1);
      const r = drag.r, dx = px - drag.sx, dy = py - drag.sy, min = 0.06;
      let x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
      if (drag.mode === "move") { const nx = clamp(r.x + dx, 0, 1 - r.w), ny = clamp(r.y + dy, 0, 1 - r.h); OCR.rect = { x: nx, y: ny, w: r.w, h: r.h }; }
      else if (drag.mode === "new") { x0 = Math.min(drag.sx, px); y0 = Math.min(drag.sy, py); x1 = Math.max(drag.sx, px); y1 = Math.max(drag.sy, py); OCR.rect = { x: x0, y: y0, w: Math.max(0.001, x1 - x0), h: Math.max(0.001, y1 - y0) }; }
      else {
        if (drag.mode.includes("w")) x0 = clamp(r.x + dx, 0, x1 - min);
        if (drag.mode.includes("e")) x1 = clamp(r.x + r.w + dx, x0 + min, 1);
        if (drag.mode.includes("n")) y0 = clamp(r.y + dy, 0, y1 - min);
        if (drag.mode.includes("s")) y1 = clamp(r.y + r.h + dy, y0 + min, 1);
        OCR.rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      layoutSel();
    });
    const end = () => {
      if (!drag) return;
      if (OCR.rect.w < 0.06 || OCR.rect.h < 0.04) OCR.rect = drag.mode === "new" ? drag.r : OCR.rect;
      drag = null; layoutSel();
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    $("ocrGo").addEventListener("click", chooseVisualRegion);
    $("ocrModes").addEventListener("click", (e) => { const b = e.target.closest("[data-ocr-mode]"); if (b && !OCR.running) setOcrMode(b.dataset.ocrMode); });
    $("ocrAll").addEventListener("click", () => runOcr(true));
    $("ocrCancel").addEventListener("click", () => { if (OCR.running) stopOcr(false); else closeOverlay($("ocrSheet")); });
    $("ocrReviewCancel").addEventListener("click", () => closeOverlay($("ocrReview")));
    $("ocrReviewApply").addEventListener("click", applyOcrReview);
    $("ocrReviewCopy").addEventListener("click", copyOcrReviewText);
    $("ocrReviewPdf").addEventListener("click", downloadableOcrPdf);
    $("ocrReviewAlt").addEventListener("click", () => setOcrCandidate(OCR.selected === 0 ? 1 : 0));
    $("ocrReviewRetry").addEventListener("click", () => {
      closeOverlay($("ocrReview"));
      whenSettled(() => openOcr());
    });
    $("ocrLang").addEventListener("click", (e) => {
      const b = e.target.closest("[data-lang]"); if (!b || OCR.running) return;
      OCR.lang = b.dataset.lang;
      all("#ocrLang .seg-item").forEach((x) => x.classList.toggle("active", x === b));
      if (UI.ocrLang) UI.ocrLang.sync();
    });
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      try {
        const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
      } catch (err) { return false; }
    }
  }
  /* 完成這一題 內容早已自動儲存 這裡負責收尾與慶祝 */
  async function saveQuestion(ev) {
    if (ev) ev.preventDefault();
    const btn = $("saveBtn");
    if (btn.disabled) return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    btn.disabled = true;
    try { await flushSave(); } finally { btn.disabled = false; }
    const q = S.questions.find((x) => x.id === S.editing);
    if (!q) { status("saveStatus", "先輸入題目文字或加入照片 就會自動收錄", true); toast("還沒有內容 先輸入題目或加入照片", { tone: "warn" }); $("questionText").focus(); return; }
    if (S.saveState === "error") { status("saveStatus", "最後一次自動儲存失敗 請先備份再釋出空間", true); return; }
    const isNew = S.autoNew === q.id;
    FX.fromEl(btn, { count: isNew ? 54 : 24, power: 11 }); FX.haptic([12, 40, 12]);
    btn.classList.add("ok"); setTimeout(() => btn.classList.remove("ok"), 900);
    resetEditor();
    S.flashId = q.id; S.libStatus = "all"; S.libSubject = ""; $("searchInput").value = ""; $("searchClear").hidden = true; $("sortFilter").value = "new"; S.pageSize = 24;
    setTab("library");
    requestAnimationFrame(() => { window.scrollTo({ top: 0, behavior: "instant" }); if (UI.status) UI.status.sync(); });
    toast(isNew ? pick(MSG.save) : "修改都已自動儲存", { action: isNew ? { label: "再收一題", run: () => setTab("add") } : null, duration: 4200 });
    afterAction(false); renderChrome();
  }
  function editQuestion(q) {
    resetEditor(); S.editing = q.id; S.autoNew = null; S.editOriginal = Object.assign({}, q);
    fillEditor(q); lastSig = editorSig(); setEditorMode(true);
    setTab("add");
  }

  /* 錯題詳細 */
  function viewQuestion(q, listName, from) {
    const ids = listName === "library" ? (S.libIds || []) : listName === "recent" ? S.questions.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5).map((x) => x.id) : [q.id];
    S.modalList = ids.includes(q.id) ? ids : [q.id];
    S.modalIndex = S.modalList.indexOf(q.id);
    fillModal(q);
    openOverlay($("detailModal"));
    sharedImage(from && from.querySelector(".q-thumb img,.subj-tile img"), $("modalBody").querySelector(".sheet-img"));
  }
  /* 卡片縮圖飛進詳細頁 共享元素轉場 */
  function sharedImage(src, dst) {
    if (!src || !dst || !FX.on() || !dst.animate) return;
    const go = () => {
      const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
      if (!a.width || !b.width) return;
      const sx = a.width / b.width, sy = a.height / b.height;
      dst.animate([
        { transform: "translate(" + (a.left - b.left) + "px," + (a.top - b.top) + "px) scale(" + sx + "," + sy + ")", transformOrigin: "0 0", borderRadius: "40px", opacity: 0.6 },
        { transform: "none", transformOrigin: "0 0", borderRadius: "18px", opacity: 1 }
      ], { duration: 560, easing: "cubic-bezier(.2,.9,.2,1)" });
    };
    if (dst.complete) requestAnimationFrame(go); else dst.addEventListener("load", go, { once: true });
  }
  function fillModal(q) {
    const img = imgURL(q), lv = q.difficulty || 3;
    $("modalTitle").textContent = (q.subject || "錯題") + " " + (q.topic || "");
    $("modalPrev").disabled = S.modalIndex <= 0;
    $("modalNext").disabled = S.modalIndex < 0 || S.modalIndex >= S.modalList.length - 1;
    const tag = isDue(q) ? '<span class="tag due">今天複習</span>' : isMastered(q) ? '<span class="tag mastered">已掌握</span>' : '<span class="tag learning">' + esc(relDue(q.dueDate)) + "</span>";
    const sec = (t, v, cls) => (v ? '<div class="sheet-sec"><h3>' + esc(t) + '</h3><p class="' + (cls || "") + '">' + esc(v) + "</p></div>" : "");
    $("modalBody").innerHTML = '<div class="q-tags"><span class="tag" style="--sc:' + subjColor(q.subject) + '">' + esc(q.subject) + "</span>" + tag + '<span class="diff" title="難度 ' + lv + '">' + [1, 2, 3, 4, 5].map((k) => '<i class="' + (k <= lv ? "on" : "") + '"></i>').join("") + "</span></div>" +
      (img ? '<img class="sheet-img" alt="原始錯題照片" src="' + img + '" data-zoom="' + esc(q.id) + '">' : "") +
      sec("題目", q.question || (img || normalizedVisuals(q.visuals).length ? "" : "沒有題目文字")) + visualHTML(q) + sec("答案", q.answer || "還沒有填寫", "rv-key") + sec("詳解", q.solution || "還沒有填寫") + sec("給未來的自己", q.reflection, "rv-note") +
      '<div class="sheet-grid"><div><span>錯誤原因</span><strong>' + esc(q.reason || "未標記") + "</strong></div><div><span>下次複習</span><strong>" + esc(dateShort(q.dueDate) || "未排程") + "</strong></div><div><span>重做次數</span><strong>" + (q.reviewCount || 0) + " 次</strong></div><div><span>連續答對</span><strong>" + (q.streak || 0) + " 次</strong></div><div><span>加入日期</span><strong>" + esc(dateShort(q.createdDate)) + "</strong></div><div><span>題目來源</span><strong>" + esc(q.source || "未填寫") + "</strong></div></div>" +
      '<div class="sheet-actions"><button class="btn btn-primary" data-action="edit" data-id="' + esc(q.id) + '">' + icon("i-edit") + "編輯這題</button>" + (isDue(q) ? "" : '<button class="btn btn-ghost" data-action="queue" data-id="' + esc(q.id) + '">' + icon("i-cards") + "排入今天複習</button>") + '<button class="btn btn-quiet" data-action="delete" data-id="' + esc(q.id) + '">' + icon("i-trash") + "刪除</button></div>";
    $("modalBody").scrollTop = 0;
    renderMath($("modalBody"));
  }
  function stepModal(dir) {
    const i = S.modalIndex + dir; if (i < 0 || i >= S.modalList.length) return;
    const q = S.questions.find((x) => x.id === S.modalList[i]); if (!q) return;
    S.modalIndex = i; fillModal(q);
  }

  /* 刪除與復原 */
  async function deleteQuestion(q) {
    const logs = S.reviews.filter((x) => x.questionId === q.id);
    try {
      await dbBatch([["questions", "delete", q.id]].concat(logs.map((r) => ["reviews", "delete", r.id])));
    } catch (e) { toast("刪除失敗 請再試一次", { tone: "warn" }); return; }
    S.questions = S.questions.filter((x) => x.id !== q.id);
    S.reviews = S.reviews.filter((x) => x.questionId !== q.id);
    dropImg(q.id);
    refreshViews();
    toast("已刪除這道錯題", {
      icon: "i-trash", duration: 6500,
      action: { label: "復原", run: async () => {
        try {
          await dbBatch([["questions", "put", q]].concat(logs.map((r) => ["reviews", "put", r])));
          S.questions.push(q); S.reviews = S.reviews.concat(logs); refreshViews(); toast("已復原");
        } catch (e) { toast("復原失敗", { tone: "warn" }); }
      } }
    });
  }
  async function handleAction(el) {
    const q = S.questions.find((x) => x.id === el.dataset.id); if (!q) return;
    const a = el.dataset.action;
    if (a === "view") viewQuestion(q, el.dataset.list, el);
    else if (a === "edit") { const open = !$("detailModal").hidden; if (open) closeOverlay($("detailModal")); whenSettled(() => editQuestion(q)); }
    else if (a === "delete") { if (!$("detailModal").hidden) closeOverlay($("detailModal")); deleteQuestion(q); }
    else if (a === "queue") {
      const next = Object.assign({}, q, { dueDate: today(), updatedAt: stamp() });
      await dbRequest("questions", "put", next); S.questions = S.questions.map((x) => (x.id === q.id ? next : x));
      closeOverlay($("detailModal")); refreshViews(); toast("已排入今天複習", { icon: "i-cards", action: { label: "現在複習", run: () => { setTab("review"); S.reviewing = q.id; renderReview(); } } });
    }
  }

  /* 圖片檢視 放大鏡 */
  function openLightbox(src, lens) {
    if (!src) return;
    const img = $("lightImg");
    img.src = src;
    openOverlay($("lightbox"));
    const go = () => { if (UI.lens) UI.lens.enable(!!lens); $("lensToggle").classList.toggle("on", !!lens); $("lightTip").textContent = lens ? "拖曳放大鏡檢查細節" : "點放大鏡檢查小字與公式"; };
    if (img.complete) requestAnimationFrame(go); else img.onload = go;
    $("lightbox")._onClose = () => { if (UI.lens) UI.lens.enable(false); };
  }

  /* 每日練習 數字一改就自動儲存 */
  let dailyTimer = null;
  function dailyState(state, text) { $("dailySave").dataset.state = state; $("dailySaveText").textContent = text; }
  function scheduleDaily() {
    updateDailyRate();
    clearTimeout(dailyTimer);
    dailyState("saving", "自動儲存中");
    dailyTimer = setTimeout(saveDaily, 600);
  }
  async function saveDaily(ev) {
    if (ev) ev.preventDefault();
    clearTimeout(dailyTimer); dailyTimer = null;
    const total = Number($("dailyTotal").value), correct = Number($("dailyCorrect").value);
    if (!Number.isInteger(total) || !Number.isInteger(correct) || total < 0 || correct < 0) { dailyState("warn", "請輸入零以上的整數"); return; }
    if (correct > total) { dailyState("warn", "答對數比做題數多 改好後會自動儲存"); return; }
    const prev = ckRow(today());
    if (!prev && !total && !correct) { dailyState("idle", "改數字就會自動儲存"); return; }
    if (prev && prev.total === total && prev.correct === correct) { dailyState("saved", "已自動儲存"); return; }
    const row = Object.assign({}, prev || {}, { id: today(), total, correct, updatedAt: stamp() });
    try { await dbRequest("daily", "put", row); } catch (e) { dailyState("warn", "自動儲存失敗 請檢查儲存空間"); return; }
    S.daily = S.daily.filter((d) => d.id !== row.id).concat(row);
    dailyState("saved", "已自動儲存 " + timeCN(row.updatedAt));
    FX.haptic(6);
    if (total >= 10 && correct / total >= 0.8 && cfg("dailyCheer", "") !== today()) {
      setCfg("dailyCheer", today());
      FX.fromEl($("dailyRateBar"), { count: 30, power: 8 });
      toast("答對率 " + Math.round(correct / total * 100) + "% 比平常更穩", { icon: "i-star" });
    }
    renderChrome(); checkAchievements(false);
  }

  /* 備份 */
  const BACKUP_KEYS = ["examId", "examYear", "examName", "examDate", "nickname", "dailyGoal", "plans", "gsatScores", "admitFav", "availWeekday", "availWeekend", "chime", "wake", "theme", "effects", "haptics"];
  function exportBackup() {
    const extras = {}; BACKUP_KEYS.forEach((k) => { if (Object.prototype.hasOwnProperty.call(S.cfg, k)) extras[k] = S.cfg[k]; });
    const data = { format: "learneasyly-backup", app: "Learn Angle", version: 2, exportedAt: stamp(), examDate: S.examDate, settings: extras, questions: S.questions, reviews: S.reviews, daily: S.daily };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "稜角備份" + today().replace(/-/g, "") + ".json";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 15000);
    localStorageSet("learneasyly-last-backup", today()); setCfg("lastBackup", today());
    toast("備份檔開始下載 請存到雲端或硬碟", { icon: "i-download" });
    renderSettings(); renderOverview(); checkAchievements(false);
  }
  async function importBackup(file) {
    if (!file) return;
    try {
      if (file.size > 200 * 1024 * 1024) throw new Error("備份檔超過 200 MB 請先確認內容");
      let data;
      try { data = JSON.parse(await file.text()); } catch (e) { throw new Error("檔案無法解析 不是有效的備份檔"); }
      if (!data || data.format !== "learneasyly-backup" || !Array.isArray(data.questions) || !Array.isArray(data.reviews) || !Array.isArray(data.daily)) throw new Error("這不是 LearnEasyly 的備份檔");
      for (const [name, items] of [["錯題", data.questions], ["複習紀錄", data.reviews], ["每日紀錄", data.daily]]) {
        if (items.length > 50000) throw new Error(name + "筆數超過合理上限");
        for (const it of items) if (!it || typeof it !== "object" || typeof it.id !== "string" || it.id.length > 150) throw new Error(name + "資料格式有誤");
      }
      const ok = await ask({ title: "合併匯入備份", body: "備份內有 " + data.questions.length + " 題 會合併到目前的錯題本 相同題目會以備份版本覆蓋 建議先匯出目前資料", ok: "開始合併", cancel: "取消", icon: "i-upload" });
      if (!ok) return;
      const tx = S.db.transaction(["questions", "reviews", "daily", "config"], "readwrite");
      const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || new Error("abort")); tx.onerror = () => reject(tx.error || new Error("error")); });
      for (const q of data.questions) tx.objectStore("questions").put(Object.assign({}, q, { image: safeImage(q.image), visuals: normalizedVisuals(q.visuals) }));
      for (const r of data.reviews) tx.objectStore("reviews").put(r);
      for (const d of data.daily) tx.objectStore("daily").put(d);
      if (/^\d{4}-\d{2}-\d{2}$/.test(data.examDate || "") && !(data.settings && data.settings.examId)) tx.objectStore("config").put({ key: "examDate", value: data.examDate });
      if (data.settings && typeof data.settings === "object") BACKUP_KEYS.forEach((k) => { if (Object.prototype.hasOwnProperty.call(data.settings, k)) tx.objectStore("config").put({ key: k, value: data.settings[k], updatedAt: stamp() }); });
      await done;
      imgCache.forEach((v) => URL.revokeObjectURL(v.url)); imgCache.clear();
      await loadAll(); renderAll();
      toast("備份已合併 原有的其他資料都保留著", { icon: "i-upload" });
      checkAchievements(false);
    } catch (e) { console.error(e); toast(/[一-鿿]/.test(e.message || "") ? e.message : "匯入失敗 原本的資料沒有被更動", { tone: "warn", duration: 4800 }); }
    finally { $("importFile").value = ""; }
  }
  async function eraseAll() {
    const ok = await ask({ title: "最後確認", body: "所有錯題 照片 複習紀錄與設定都會從這台裝置消失 確定已經下載備份了嗎", ok: "清除全部", cancel: "再想想", danger: true });
    if (!ok) return;
    for (const k of ["questions", "reviews", "daily", "config"]) await dbRequest(k, "clear");
    try { localStorage.removeItem("learneasyly-last-backup"); } catch (e) {}
    imgCache.forEach((v) => URL.revokeObjectURL(v.url)); imgCache.clear();
    stopTicker(); wakeOff();
    await loadAll(); resetEditor(); S.achievements = {}; setCfg("achievements", {});
    renderAll(); setTab("overview"); toast("本機資料已清除");
  }

  /* 目標考試 */
  function estimateSession(id, ay) {
    const t = EXAM_TYPES[id], y = ay + 1911;
    if (!t) return null;
    for (let d = t.sat[0]; d <= t.sat[1]; d++) {
      const dt = new Date(y, t.m - 1, d);
      if (dt.getDay() !== 6) continue;
      if (id === "gsat" && LUNAR_NEW_YEAR[y]) { const lny = LUNAR_NEW_YEAR[y]; if (plusDays(localDate(dt), 2) > plusDays(lny, -7)) dt.setDate(dt.getDate() - 7); }
      dt.setDate(dt.getDate() + t.off);
      const st = localDate(dt);
      return { ay, start: st, end: plusDays(st, t.days - 1), official: false, time: t.time, timeOfficial: false };
    }
    return null;
  }
  function examSessions(id) {
    const map = new Map(), y0 = new Date().getFullYear() - 1911;
    for (let ay = y0 - 1; ay <= y0 + 4; ay++) { const e = estimateSession(id, ay); if (e) map.set(ay, e); }
    Object.entries(EXAM_BUILTIN[id] || {}).forEach(([ay, r]) => map.set(Number(ay), Object.assign({ ay: Number(ay), official: true }, r)));
    const remote = S.examsData && S.examsData.exams && S.examsData.exams[id] && Array.isArray(S.examsData.exams[id].sessions) ? S.examsData.exams[id].sessions : [];
    const HM = /^\d{2}:\d{2}$/;
    remote.forEach((x) => {
      if (!x || !Number.isInteger(x.ay) || !ISO.test(x.start || "")) return;
      const cur = map.get(x.ay), off = x.status ? x.status === "official" : !!x.official;
      if (!off && cur && cur.official) return;
      const time = HM.test(x.time || "") ? x.time : cur && cur.time ? cur.time : EXAM_TYPES[id].time;
      map.set(x.ay, { ay: x.ay, start: x.start, end: ISO.test(x.end || "") && x.end >= x.start ? x.end : x.start, official: off, time,
        timeOfficial: HM.test(x.time || "") ? (x.timeStatus ? x.timeStatus === "official" : off) : !!(cur && cur.timeOfficial), note: x.note || "" });
    });
    const t = today();
    return [...map.values()].filter((x) => x.end >= t).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 4);
  }
  function migrateExam() {
    if (cfg("examId", "")) return;
    const d = cfg("examDate", "");
    const isGsat = !ISO.test(d) || d === DEFAULT_DATE || d < today() || examSessions("gsat").some((x) => x.start === d);
    S.cfg.examId = isGsat ? "gsat" : "custom";
    if (!isGsat) S.cfg.examName = "學測";
    setCfg("examId", S.cfg.examId); if (!isGsat) setCfg("examName", "學測");
  }
  function examFromState(st) {
    st = st || { id: "gsat" };
    if (st.id === "custom") {
      const date = ISO.test(st.date || "") ? st.date : plusDays(today(), 120), name = clean(st.name || "").slice(0, 16) || "目標考試";
      return { id: "custom", name, full: name, start: date, end: date, ay: 0, label: "自訂目標", official: true, custom: true, time: "", timeOfficial: false, target: examTarget(date, "") };
    }
    const id = EXAM_TYPES[st.id] ? st.id : "gsat", t = EXAM_TYPES[id], list = examSessions(id);
    const x = list.find((k) => k.ay === Number(st.ay)) || list[0] || estimateSession(id, new Date().getFullYear() - 1910);
    const time = x.time || t.time;
    return { id, name: t.name, full: t.full, start: x.start, end: x.end, ay: x.ay, label: x.ay + " " + t.unit, official: !!x.official, time, timeOfficial: !!x.timeOfficial, note: x.note || "", target: examTarget(x.start, time) };
  }
  /* 開考時刻一律以台灣時間計算 */
  function examTarget(date, time) {
    const n = String(date).split("-").map(Number), h = /^(\d{2}):(\d{2})$/.exec(time || "") || [0, "00", "00"];
    return Date.UTC(n[0], n[1] - 1, n[2], Number(h[1]) - 8, Number(h[2]));
  }
  const timeCNhm = (hm) => { const m = /^(\d{2}):(\d{2})$/.exec(hm || ""); return m ? Number(m[1]) + "點" + m[2] + "分" : ""; };
  function untilText(ms, short) {
    if (ms <= 0) return "已經開考";
    const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60;
    if (short) return d ? d + " 天 " + h + " 小時" : h ? h + " 小時 " + m + " 分" : m + " 分鐘";
    return (d ? d + " 天 " : "") + h + " 小時 " + m + " 分";
  }
  function resolveExam() { return examFromState(settingsExamState()); }
  function settingsExamState() { return { id: cfg("examId", "gsat"), ay: Number(cfg("examYear", 0)) || 0, name: cfg("examName", ""), date: ISO.test(cfg("examDate", "")) ? cfg("examDate") : "" }; }
  function renderExamPicker(root, st) {
    if (!root) return;
    const ex = examFromState(st);
    const types = EXAM_IDS.map((id) => { const t = EXAM_TYPES[id]; return '<button type="button" class="ex-type' + (st.id === id ? " on" : "") + '" data-ex="' + id + '" aria-pressed="' + (st.id === id) + '"><b>' + esc(t.name) + "</b><small>" + esc(t.note) + "</small></button>"; }).join("") +
      '<button type="button" class="ex-type' + (st.id === "custom" ? " on" : "") + '" data-ex="custom" aria-pressed="' + (st.id === "custom") + '"><b>自訂</b><small>其他考試</small></button>';
    let sub;
    if (st.id === "custom") {
      const d = ex.start;
      sub = '<div class="ex-custom"><input class="ex-name" maxlength="16" placeholder="考試名稱 例如 英檢中級" value="' + esc(st.name || "") + '" aria-label="考試名稱" autocomplete="off"><label class="date-pick"><svg class="ic"><use href="#i-calendar"/></svg><span class="ex-date-label">' + esc(dateCN(d) + " " + weekdayCN(d)) + '</span><input type="date" class="ex-date" value="' + esc(d) + '" aria-label="考試日期"></label></div>' +
        '<p class="ex-note">自訂考試的日期不會自動更新 考完可以再回來設定下一個目標</p>';
    } else {
      const t = EXAM_TYPES[ex.id], list = examSessions(ex.id);
      sub = '<div class="ex-years">' + list.map((x) => '<button type="button" class="ex-year' + (x.ay === ex.ay ? " on" : "") + '" data-ay="' + x.ay + '" aria-pressed="' + (x.ay === ex.ay) + '"><b>' + x.ay + " " + esc(t.unit) + "</b><span>" + esc(dateCN(x.start)) + "</span><small>" + esc(weekdayCN(x.start)) + " " + esc(timeCNhm(x.time || t.time)) + "開考</small>" + '<i class="' + (x.official ? "is-off" : "is-est") + '">' + (x.official ? "官方公告" : "預估") + "</i></button>").join("") + "</div>" +
        '<p class="ex-note">' + esc(t.full) + " 預估日期會在官方公布後自動更新 考完會自動換到下一次</p>";
    }
    root.innerHTML = '<div class="ex-types">' + types + "</div>" + sub;
  }
  function mountExamPicker(root, getState, onChange) {
    if (!root) return;
    root.addEventListener("click", (e) => {
      const ty = e.target.closest("[data-ex]"), yr = e.target.closest("[data-ay]");
      if (!ty && !yr) return;
      const st = Object.assign({}, getState());
      if (ty) {
        if (st.id === ty.dataset.ex) return;
        st.id = ty.dataset.ex; st.ay = 0;
        if (st.id === "custom" && !ISO.test(st.date || "")) st.date = plusDays(today(), 120);
      } else st.ay = Number(yr.dataset.ay);
      FX.haptic(5);
      renderExamPicker(root, st);
      onChange(st);
    });
    let tmr = null;
    root.addEventListener("input", (e) => {
      if (!e.target.classList.contains("ex-name")) return;
      const st = Object.assign({}, getState(), { name: e.target.value });
      clearTimeout(tmr); tmr = setTimeout(() => onChange(st), 500);
    });
    root.addEventListener("change", (e) => {
      if (!e.target.classList.contains("ex-date")) return;
      const v = e.target.value; if (!ISO.test(v)) return;
      const st = Object.assign({}, getState(), { date: v });
      const lb = root.querySelector(".ex-date-label"); if (lb) lb.textContent = dateCN(v) + " " + weekdayCN(v);
      onChange(st);
    });
  }
  function applyExamChoice(st, quiet) {
    const prev = S.exam;
    setCfg("examId", st.id); setCfg("examYear", st.id === "custom" ? 0 : Number(st.ay) || 0);
    if (st.id === "custom") { setCfg("examName", clean(st.name || "").slice(0, 16)); if (ISO.test(st.date || "")) setCfg("examDate", st.date); }
    S.exam = resolveExam(); S.examDate = S.exam.start;
    setCfg("examSeen", { id: S.exam.id, ay: S.exam.ay, start: S.exam.start, official: S.exam.official });
    if (!prev || prev.id !== S.exam.id) applySubjects(S.exam.id);
    renderOverview(); renderChrome();
    if (!quiet && (!prev || prev.id !== S.exam.id || prev.start !== S.exam.start)) toast("目標改為 " + S.exam.name + " " + dateCN(S.exam.start), { icon: "i-calendar" });
  }
  function noteExamChange() {
    const seen = cfg("examSeen", null), ex = S.exam;
    if (seen && seen.id === ex.id && !ex.custom) {
      if (seen.ay && ex.ay > seen.ay) {
        setTimeout(() => celebrate({ title: "上一次" + ex.name + "辛苦了", body: "目標已經自動換成 " + ex.label + " " + ex.name + " 休息一下 再出發", icon: "i-flag", colors: ACH_COLORS[0], button: "繼續前進" }), 800);
        if (cfg("examYear", 0)) setCfg("examYear", 0);
      } else if (seen.ay === ex.ay && ex.official && (!seen.official || seen.start !== ex.start)) {
        toast(ex.label + " " + ex.name + " 日期已公布 " + dateCN(ex.start), { icon: "i-calendar", duration: 5200 });
      }
    }
    if (!seen || seen.id !== ex.id || seen.ay !== ex.ay || seen.start !== ex.start || seen.official !== ex.official) setCfg("examSeen", { id: ex.id, ay: ex.ay, start: ex.start, official: ex.official });
  }
  /* 定期取回 data/exams.json 由 GitHub Actions 每週自動更新 */
  async function fetchExams(force) {
    const last = Number(cfg("examsFetchedAt", 0)) || 0;
    if (!force && Date.now() - last < 12 * 3600 * 1000) return;
    if (navigator.onLine === false) return;
    try {
      const res = await fetch("./data/exams.json", { cache: "no-cache" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || typeof data !== "object" || !data.exams) return;
      S.examsData = data; setCfg("examsData", data); setCfg("examsFetchedAt", Date.now());
      const before = S.exam && S.exam.start + S.exam.official;
      S.exam = resolveExam(); S.examDate = S.exam.start;
      noteExamChange();
      if (before !== S.exam.start + S.exam.official) { renderOverview(); if (S.tab === "settings") renderSettings(); }
    } catch (e) { console.warn("exams", e); }
  }
  function applySubjects(id) {
    const names = SUBJECT_SETS[id] || SUBJECT_SETS.gsat;
    SUBJECTS = names.map((n) => [n, COLOR_BANK[n] || "#6b7a74"]);
    if (!$("subjectChips")) return;
    const cur = radioVal("subject", "");
    $("subjectChips").innerHTML = SUBJECTS.map(([n, c], i) => '<label class="pick"><input type="radio" name="subject" value="' + esc(n) + '"' + (i === 0 ? " checked" : "") + '><span style="--sc:' + c + '"><i></i>' + esc(n) + "</span></label>").join("");
    if (cur && (S.editing || ($("questionText") && $("questionText").value.trim()))) setRadio("subject", cur);
    if (S.timer && !inSubjects(S.timer.subject) && !tmActive()) { S.timer.subject = firstSubject(); tmSave(); }
    if ($("timerSubject")) { buildTimerChips(); }
  }

  /* 精確倒數 每三十秒更新一次 只在總覽顯示時更新 */
  function renderBoardLive() {
    const ex = S.exam; if (!ex || !$("boardLive")) return;
    const ms = ex.target - Date.now();
    $("boardLive").innerHTML = ex.custom ? "" : ms > 0 ? "距離開考 <b>" + esc(untilText(ms)) + "</b>" + (ex.timeOfficial ? "" : " 開考時刻依去年考程") : ex.end >= today() ? "考試進行中 每一節都穩穩寫完" : "";
  }
  function nextSessionOf(id) { const l = examSessions(id); return l[0] || null; }
  function renderExamRows() {
    if (!$("examRows")) return;
    const now = Date.now(), rows = EXAM_IDS.map((id) => ({ id, x: nextSessionOf(id) })).filter((r) => r.x).sort((a, b) => a.x.start.localeCompare(b.x.start));
    $("examRows").innerHTML = rows.map(({ id, x }) => {
      const t = EXAM_TYPES[id], time = x.time || t.time, target = examTarget(x.start, time), ms = target - now, mine = S.exam && S.exam.id === id;
      const days = Math.max(0, dayDiff(x.start, today()));
      return '<div class="exam-row' + (mine ? " is-mine" : "") + '" style="--ec:' + t.color + '">' +
        '<div class="er-name"><strong>' + esc(t.name) + "</strong><span>" + x.ay + " " + esc(t.unit) + "</span></div>" +
        '<div class="er-date"><b>' + esc(dateCN(x.start)) + "</b><span>" + esc(weekdayCN(x.start)) + " " + esc(timeCNhm(time)) + "開考" + (x.timeOfficial ? "" : " 暫定") + "</span></div>" +
        '<div class="er-count"><b>' + days + "</b><span>天</span><small>" + (ms > 0 ? "又 " + (Math.floor(ms / 3600000) % 24) + " 小時" : "進行中") + "</small></div>" +
        '<div class="er-side"><span class="er-tag ' + (x.official ? "is-off" : "is-est") + '">' + (x.official ? "官方公告" : "預估") + "</span>" +
        (mine ? '<span class="er-mine">我的目標</span>' : '<button type="button" class="er-set" data-set-exam="' + id + '">設為目標</button>') + "</div></div>";
    }).join("");
    const up = S.examsData && (S.examsData.checkedAt || S.examsData.updatedAt);
    $("examsFoot").textContent = "官方日期來自大考中心 教育部 國中教育會考與技專校院招生委員會的公告 預估日期依往年規則推算 官方公布後自動更新" + (up ? " 資料檢查於 " + dateCN(String(up).slice(0, 10)) : "");
  }

  /* 讀書計時 以時間戳記計算 背景或重新整理都不會失準 */
  const TM = { int: null, wake: null, audio: null, saveT: null };
  function tm() {
    if (!S.timer) S.timer = Object.assign({ run: false, acc: 0, at: 0, first: 0, mode: "up", subject: "", kind: KINDS[0], note: "", planId: "" }, cfg("timer", {}) || {});
    if (!S.timer.subject || !inSubjects(S.timer.subject)) S.timer.subject = S.timer.subject && COLOR_BANK[S.timer.subject] ? S.timer.subject : firstSubject();
    return S.timer;
  }
  function tmSave() { const t = tm(); setCfg("timer", Object.assign({}, t)); }
  const tmElapsed = () => { const t = tm(); return Math.max(0, t.acc + (t.run ? Date.now() - t.at : 0)); };
  const tmTarget = () => { const m = tm().mode; return m === "25" ? 1500000 : m === "50" ? 3000000 : 0; };
  const tmActive = () => { const t = tm(); return t.run || t.acc > 0; };
  function clockParts(ms) { const sec = Math.floor(ms / 1000); return { h: Math.floor(sec / 3600), m: Math.floor(sec / 60) % 60, s: sec % 60, total: Math.floor(sec / 60) }; }
  function clockHTML(ms) {
    const c = clockParts(ms), sep = '<i class="sep" aria-hidden="true"></i>';
    return (c.h ? "<b>" + c.h + "</b>" + sep + "<b>" + pad(c.m) + "</b>" : "<b>" + pad(c.m) + "</b>") + sep + "<b>" + pad(c.s) + "</b>";
  }
  function clockLabel(ms) { const c = clockParts(ms); return (c.h ? c.h + " 小時 " : "") + c.m + " 分 " + c.s + " 秒"; }
  function tmShown() { const tg = tmTarget(), el = tmElapsed(); return tg ? Math.max(0, tg - el) : el; }
  function tmTick() {
    const t = tm(), el = tmElapsed(), tg = tmTarget();
    if (tg && t.run && el >= tg) { tmFinish(true); return; }
    const shown = tmShown(), html = clockHTML(shown), active = tmActive();
    const pct = tg ? Math.min(100, el / tg * 100) : (el % 3600000) / 36000;
    if (S.tab === "study") {
      $("timerDisplay").innerHTML = html; $("timerDisplay").setAttribute("aria-label", (tg ? "剩下 " : "已專注 ") + clockLabel(shown));
      $("timerRuler").style.width = pct + "%";
    }
    $("miniTimer").hidden = !active; $("tabLive").hidden = !active; $("sideTimer").hidden = !active;
    if (active) {
      $("miniTimerTime").innerHTML = clockHTML(shown); $("miniTimer").classList.toggle("paused", !t.run);
      $("miniTimerDot").style.background = subjColor(t.subject);
      $("sideTimer").innerHTML = clockHTML(shown);
      $("tabLive").classList.toggle("paused", !t.run);
    }
    if (!$("focusMode").hidden) { $("focusTime").innerHTML = html; $("focusRuler").style.width = pct + "%"; }
    if (S.studyCardLive) $("scStartText").innerHTML = (t.run ? "計時中 " : "已暫停 ") + '<span class="mini-clock">' + html + "</span>";
    document.title = t.run ? (tg ? "剩下 " : "專注中 ") + (clockParts(shown).h ? clockParts(shown).h + " " : "") + pad(clockParts(shown).m) + " " + pad(clockParts(shown).s) + " 稜角" : (S.baseTitle || "稜角 Learn Angle");
  }
  function startTicker() { stopTicker(); TM.int = setInterval(tmTick, 500); tmTick(); }
  function stopTicker() { if (TM.int) clearInterval(TM.int); TM.int = null; }
  function ensureAudio() {
    try { if (!TM.audio) { const A = window.AudioContext || window.webkitAudioContext; if (A) TM.audio = new A(); } if (TM.audio && TM.audio.state === "suspended") TM.audio.resume(); } catch (e) {}
  }
  function chime() {
    if (cfg("chime", true) === false) return;
    if (!TM.audio && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    ensureAudio(); const ctx = TM.audio; if (!ctx) return;
    try {
      [[880, 0], [1318.5, 0.22], [1760, 0.44]].forEach(([f, d]) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + d;
        o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
        o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 1);
      });
    } catch (e) {}
  }
  async function wakeOn() {
    if (cfg("wake", true) === false || !("wakeLock" in navigator) || TM.wake) return;
    try { TM.wake = await navigator.wakeLock.request("screen"); TM.wake.addEventListener("release", () => { TM.wake = null; }); } catch (e) { TM.wake = null; }
  }
  function wakeOff() { try { if (TM.wake) TM.wake.release(); } catch (e) {} TM.wake = null; }
  function tmStart() {
    const t = tm();
    if (t.run) return;
    ensureAudio();
    if (!t.first || t.acc === 0) t.first = Date.now();
    t.at = Date.now(); t.run = true; tmSave();
    FX.haptic(10); startTicker(); renderTimer();
    if (!$("focusMode").hidden) wakeOn();
  }
  function tmPause() {
    const t = tm(); if (!t.run) return;
    t.acc = tmElapsed(); t.run = false; tmSave();
    FX.haptic(6); tmTick(); renderTimer(); wakeOff();
  }
  function tmToggle() { if (tm().run) tmPause(); else tmStart(); }
  function tmReset() {
    const t = tm();
    Object.assign(t, { run: false, acc: 0, at: 0, first: 0, planId: "" });
    tmSave(); stopTicker(); tmTick(); renderTimer(); wakeOff();
  }
  async function tmFinish(auto) {
    const t = tm(), el = tmElapsed(), tg = tmTarget();
    if (!tmActive()) return;
    if (!auto && el < 60000) {
      const drop = await ask({ title: "還不到一分鐘", body: "這段時間太短 要捨棄這次計時嗎", ok: "捨棄", cancel: "繼續計時", icon: "i-timer" });
      if (drop) { tmReset(); toast("已捨棄這次計時", { icon: "i-timer" }); }
      return;
    }
    const sec = Math.round((tg ? Math.min(el, tg) : el) / 1000);
    const start = new Date(t.first || Date.now() - el), end = auto ? new Date(start.getTime() + sec * 1000) : new Date();
    const rec = { id: uid(), start: start.toISOString(), end: end.toISOString(), sec, subject: t.subject, kind: t.kind, note: clean(t.note).slice(0, 60), mode: t.mode, planId: t.planId || "" };
    const planId = t.planId;
    Object.assign(t, { run: false, acc: 0, at: 0, first: 0, planId: "" });
    if (!auto) t.note = "";
    tmSave(); stopTicker(); wakeOff();
    const ok = await putSession(rec, localDate(start));
    if (!ok) { toast("紀錄沒有存成功 請檢查儲存空間", { tone: "warn" }); return; }
    const mins = Math.max(1, Math.round(sec / 60));
    if (auto) {
      chime(); FX.haptic([30, 80, 30, 80, 40]);
      if (!$("focusMode").hidden) closeOverlay($("focusMode"));
      celebrate({ seal: mins + "分", title: (t.mode === "25" ? "完成一個番茄" : "完成一段深度專注"), body: "起來走走 喝口水 休息五分鐘再回來", colors: ACH_COLORS[0], stats: [[String(mins), "這次分鐘"], [String(Math.round(minutesOn(today()))), "今天分鐘"]], button: "休息一下" });
    } else {
      if (!$("focusMode").hidden) closeOverlay($("focusMode"));
      toast(pick(FOCUS_MSG).replace("{m}", mins), { icon: "i-timer" });
      if (mins >= 25) FX.rain();
    }
    if (planId) {
      const p = S.plans.find((x) => x.id === planId), d = localDate(start);
      if (p && !isPlanDone(p.id, d) && planMinutes(p.id, d) >= (p.minutes || 0)) { await setPlanDone(p.id, d, true); setTimeout(() => toast("排程完成 " + (p.title || p.subject), { icon: "i-plan" }), auto ? 1200 : 900); }
    }
    renderTimer(); tmTick();
    refreshViews();
    setTimeout(() => checkAchievements(false), 600);
  }
  function startFromPlan(p) {
    const go = async () => {
      const t = tm();
      Object.assign(t, { subject: p.subject || t.subject, kind: p.kind || t.kind, note: p.title || "", planId: p.id, mode: p.minutes === 25 ? "25" : p.minutes === 50 ? "50" : "up" });
      tmSave(); setTab("study"); buildTimerChips(); renderTimer(); tmStart();
      toast("開始 " + (p.title || p.subject), { icon: "i-play" });
    };
    if (tmActive()) {
      ask({ title: "目前正在計時", body: "要先把這段計時存起來 再開始新的排程嗎", ok: "存起來再開始", cancel: "取消", icon: "i-timer" }).then(async (ok) => { if (!ok) return; await tmFinish(false); go(); });
    } else go();
  }
  function buildTimerChips() {
    const t = tm();
    $("timerSubject").innerHTML = SUBJECTS.map(([n, c]) => '<label class="pick"><input type="radio" name="tmSubject" value="' + esc(n) + '"' + (t.subject === n ? " checked" : "") + '><span style="--sc:' + c + '"><i></i>' + esc(n) + "</span></label>").join("");
    $("timerKind").innerHTML = KINDS.map((n) => '<label class="pick"><input type="radio" name="tmKind" value="' + esc(n) + '"' + (t.kind === n ? " checked" : "") + "><span>" + esc(n) + "</span></label>").join("");
    if (document.activeElement !== $("timerNote")) $("timerNote").value = t.note || "";
  }
  function renderTimer() {
    const t = tm(), active = tmActive();
    $("timerCard").classList.toggle("running", t.run);
    $("timerCard").classList.toggle("paused", active && !t.run);
    $("timerCard").style.setProperty("--sc", subjColor(t.subject));
    all("#timerMode .seg-item").forEach((b) => b.classList.toggle("active", b.dataset.mode === t.mode));
    if (UI.mode) UI.mode.sync();
    $("timerMain").innerHTML = icon(t.run ? "i-pause" : "i-play");
    $("timerMain").setAttribute("aria-label", t.run ? "暫停" : active ? "繼續計時" : "開始計時");
    $("timerStop").hidden = !active; $("timerReset").hidden = !active || t.run;
    const tg = tmTarget();
    $("timerState").textContent = t.run ? (tg ? "專心在 " + t.subject + " " + t.kind + " 時間到會提醒你" : "正在專心 " + t.subject + " " + t.kind) : active ? "暫停中 按繼續回來 或按完成存起來" : tg ? "番茄鐘 " + (tg / 60000) + " 分鐘 時間到會自動記錄" : "選好科目和要做的事 按下開始";
    const p = t.planId && S.plans.find((x) => x.id === t.planId);
    $("timerPlanLink").hidden = !p;
    if (p) $("timerPlanLink").innerHTML = icon("i-plan") + "<span>這段會算進排程 " + esc(p.title || p.subject) + "</span>";
    $("focusPauseText").textContent = t.run ? "暫停" : "繼續";
    $("focusSubj").textContent = t.subject + " " + t.kind + (t.note ? " " + t.note : "");
    tmTick();
  }
  function openFocus() {
    const t = tm();
    $("focusQuote").innerHTML = cheerHTML(pick(QUOTES));
    openOverlay($("focusMode"));
    renderTimer();
    if (!t.run) tmStart(); else wakeOn();
    document.documentElement.classList.add("focusing");
    $("focusMode")._onClose = () => { wakeOff(); document.documentElement.classList.remove("focusing"); };
  }

  /* 讀書紀錄 存在每日紀錄裡 跟著備份一起匯出 */
  function allSessions() { const out = []; S.daily.forEach((d) => (d.sessions || []).forEach((x) => out.push(Object.assign({ date: d.id }, x)))); return out; }
  function sessionsOn(d) { const r = ckRow(d); return r && Array.isArray(r.sessions) ? r.sessions.slice() : []; }
  function minutesOn(d) { return sessionsOn(d).reduce((a, x) => a + (x.sec || 0), 0) / 60; }
  async function putSession(rec, date, removeFrom) {
    try {
      const ops = [];
      if (removeFrom && removeFrom !== date) {
        const old = ckRow(removeFrom);
        if (old) { const o2 = Object.assign({}, old, { sessions: (old.sessions || []).filter((x) => x.id !== rec.id), updatedAt: stamp() }); ops.push(["daily", "put", o2]); }
      }
      const prev = ckRow(date) || { id: date, total: 0, correct: 0 };
      const list = (prev.sessions || []).filter((x) => x.id !== rec.id).concat(rec).sort((a, b) => String(a.start).localeCompare(String(b.start)));
      const row = Object.assign({}, prev, { sessions: list, updatedAt: stamp() });
      ops.push(["daily", "put", row]);
      await dbBatch(ops);
      ops.forEach(([, , r]) => { S.daily = S.daily.filter((x) => x.id !== r.id).concat(r); });
      return true;
    } catch (e) { console.error(e); return false; }
  }
  async function dropSession(id, date) {
    const row = ckRow(date); if (!row) return;
    const gone = (row.sessions || []).find((x) => x.id === id);
    const r2 = Object.assign({}, row, { sessions: (row.sessions || []).filter((x) => x.id !== id), updatedAt: stamp() });
    try { await dbRequest("daily", "put", r2); S.daily = S.daily.filter((x) => x.id !== date).concat(r2); } catch (e) { toast("刪除失敗 請再試一次", { tone: "warn" }); return; }
    refreshViews();
    toast("已刪除這段紀錄", { icon: "i-trash", action: gone ? { label: "復原", run: async () => { await putSession(gone, date); refreshViews(); } } : null });
  }
  const timeOf = (iso) => { const d = new Date(iso); return d.getHours() + "點" + pad(d.getMinutes()) + "分"; };
  const hhmmCN = (v) => { const m = /^(\d{1,2}):(\d{2})$/.exec(v || ""); return m ? Number(m[1]) + "點" + m[2] + "分" : ""; };
  const minLabel = (mins) => minutesLabel(Math.round(mins)) === "還沒決定" ? "0 分鐘" : minutesLabel(Math.round(mins));
  function sessionRowHTML(x, date) {
    const mins = Math.max(1, Math.round((x.sec || 0) / 60)), p = x.planId && S.plans.find((k) => k.id === x.planId);
    return '<div class="log-item" style="--sc:' + subjColor(x.subject) + '"><span class="subj-tile">' + subjShort(x.subject) + '</span><div class="log-main"><strong>' + esc(x.subject) + " " + esc(x.kind || "") + "</strong>" +
      '<span class="meta"><span>' + esc(timeOf(x.start)) + " 開始</span>" + (x.mode === "25" || x.mode === "50" ? "<span>番茄 " + x.mode + "</span>" : "") + (p ? "<span>排程 " + esc(p.title || p.subject) + "</span>" : "") + (x.note ? "<span>" + esc(x.note) + "</span>" : "") + "</span></div>" +
      '<b class="log-min">' + mins + "<small>分</small></b>" + '<button type="button" class="icon-btn mini" data-log-edit="' + esc(x.id) + '" data-date="' + esc(date) + '" aria-label="修改紀錄">' + icon("i-edit") + "</button></div>";
  }

  /* 讀書排程 */
  const weekdayOf = (iso) => parseDate(iso).getDay();
  function plansOn(d) {
    const wd = weekdayOf(d);
    return S.plans.filter((p) => (Array.isArray(p.repeat) && p.repeat.length ? p.repeat.includes(wd) && d >= (p.date || "0000") : p.date === d))
      .sort((a, b) => (a.time || "99").localeCompare(b.time || "99") || String(a.created).localeCompare(String(b.created)));
  }
  function isPlanDone(id, d) { const r = ckRow(d); return !!(r && r.planDone && r.planDone[id]); }
  function planMinutes(id, d) { return sessionsOn(d).filter((x) => x.planId === id).reduce((a, x) => a + (x.sec || 0), 0) / 60; }
  async function setPlanDone(id, d, v) {
    const prev = ckRow(d) || { id: d, total: 0, correct: 0 };
    const pd = Object.assign({}, prev.planDone || {});
    if (v) pd[id] = stamp(); else delete pd[id];
    const row = Object.assign({}, prev, { planDone: pd, updatedAt: stamp() });
    try { await dbRequest("daily", "put", row); S.daily = S.daily.filter((x) => x.id !== d).concat(row); } catch (e) { toast("沒有存成功 請再試一次", { tone: "warn" }); }
  }
  function savePlans() { setCfg("plans", S.plans); }
  function availMinutes(weekend) { return Math.max(30, Math.min(720, Number(cfg(weekend ? "availWeekend" : "availWeekday", weekend ? 240 : 120)) || (weekend ? 240 : 120))); }
  function planItemHTML(p, d) {
    const done = isPlanDone(p.id, d), got = planMinutes(p.id, d), pct = p.minutes ? Math.min(100, got / p.minutes * 100) : 0, isToday = d === today();
    const rep = Array.isArray(p.repeat) && p.repeat.length ? "每週" + p.repeat.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((w) => WEEKDAY_SHORT[w]).join("") : "";
    return '<div class="plan-item' + (done ? " done" : "") + '" style="--sc:' + subjColor(p.subject) + '">' +
      '<button type="button" class="pi-check" data-plan-done="' + esc(p.id) + '" data-date="' + d + '" aria-pressed="' + done + '" aria-label="' + (done ? "取消完成" : "標記完成") + '">' + icon("i-check") + "</button>" +
      '<div class="pi-main"><strong>' + esc(p.title || p.subject + " " + p.kind) + '</strong><span class="meta"><span class="pi-subj"><i></i>' + esc(p.subject) + "</span><span>" + esc(p.kind || "") + "</span>" + (p.time ? "<span>" + esc(hhmmCN(p.time)) + "</span>" : "") + (rep ? "<span>" + rep + "</span>" : "") + (p.auto ? "<span>自動排程</span>" : "") + "</span>" +
      '<div class="pi-prog"><div class="pi-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div><span class="pi-min"><b>' + Math.round(got) + "</b> 之 " + (p.minutes || 0) + " 分鐘</span></div></div>" +
      (isToday && !done ? '<button type="button" class="pi-start" data-plan-start="' + esc(p.id) + '" aria-label="開始計時">' + icon("i-play") + "</button>" : "") +
      '<button type="button" class="icon-btn mini" data-plan-edit="' + esc(p.id) + '" data-date="' + d + '" aria-label="編輯排程">' + icon("i-edit") + "</button></div>";
  }
  function renderPlan() {
    const t = today();
    S.planWeek = S.planWeek || monday(t);
    S.planDay = S.planDay || t;
    const mon = S.planWeek, sun = plusDays(mon, 6);
    if (S.planDay < mon || S.planDay > sun) S.planDay = mon <= t && t <= sun ? t : mon;
    $("weekLabel").textContent = mon === monday(t) ? "本週 " + dateShort(mon) + " 到 " + dateShort(sun) : dateShort(mon) + " 到 " + dateShort(sun);
    $("weekStrip").innerHTML = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = plusDays(mon, i), items = plansOn(d), done = items.filter((p) => isPlanDone(p.id, d)).length, mins = items.reduce((a, p) => a + (p.minutes || 0), 0);
      const studied = minutesOn(d);
      return '<button type="button" class="wd' + (d === S.planDay ? " on" : "") + (d === t ? " today" : "") + (d < t ? " past" : "") + '" data-plan-day="' + d + '" aria-pressed="' + (d === S.planDay) + '"><span class="wd-w">' + (d === t ? "今天" : "週" + WEEKDAY_SHORT[weekdayOf(d)]) + '</span><b>' + parseDate(d).getDate() + '</b><span class="wd-bar"><i style="width:' + (items.length ? done / items.length * 100 : 0) + '%"></i></span><small>' + (items.length ? items.length + " 項 " + mins + " 分" : studied >= 1 ? "讀 " + Math.round(studied) + " 分" : "未排") + "</small></button>";
    }).join("");
    const items = plansOn(S.planDay);
    const total = items.reduce((a, p) => a + (p.minutes || 0), 0), done = items.filter((p) => isPlanDone(p.id, S.planDay)).length;
    $("planSub").textContent = items.length ? dateShort(S.planDay) + " " + weekdayCN(S.planDay) + " 共 " + items.length + " 項 預計 " + minLabel(total) + " 已完成 " + done + " 項" : "安排每天要讀的內容 從排程開始計時會自動累積進度";
    $("planList").innerHTML = items.length ? items.map((p) => planItemHTML(p, S.planDay)).join("") :
      emptyHTML("i-plan", S.planDay < t ? "這天沒有排程" : "這天還沒有排程", S.planDay < t ? "可以補登讀書紀錄" : "按新增自己安排 或用自動排程一次排好一週", S.planDay >= t ? '<button type="button" class="btn btn-ghost btn-sm" data-plan-new="' + S.planDay + '">' + icon("i-plus") + "新增排程</button>" : "");
  }
  function openPlanSheet(p, date) {
    S.planEdit = p ? Object.assign({}, p) : { id: "", title: "", subject: tm().subject || firstSubject(), kind: KINDS[0], minutes: 50, time: "", date: date || S.planDay || today(), repeat: [] };
    const e = S.planEdit;
    $("planTitle").textContent = p ? "編輯排程" : "新增排程";
    $("planSaveText").textContent = p ? "儲存修改" : "加入排程";
    $("planDelete").hidden = !p;
    $("planText").value = e.title || "";
    $("planSubject").innerHTML = SUBJECTS.map(([n, c]) => '<label class="pick"><input type="radio" name="plSubject" value="' + esc(n) + '"' + (e.subject === n ? " checked" : "") + '><span style="--sc:' + c + '"><i></i>' + esc(n) + "</span></label>").join("");
    $("planKind").innerHTML = KINDS.map((n) => '<label class="pick"><input type="radio" name="plKind" value="' + esc(n) + '"' + (e.kind === n ? " checked" : "") + "><span>" + esc(n) + "</span></label>").join("");
    $("planMinutes").textContent = e.minutes + " 分鐘";
    $("planTime").value = e.time || "";
    $("planDate").value = e.date; $("planDateLabel").textContent = dateCN(e.date) + " " + weekdayCN(e.date);
    $("planRepeat").innerHTML = [1, 2, 3, 4, 5, 6, 0].map((w) => '<label class="pick"><input type="checkbox" name="plRepeat" value="' + w + '"' + ((e.repeat || []).includes(w) ? " checked" : "") + "><span>週" + WEEKDAY_SHORT[w] + "</span></label>").join("");
    openOverlay($("planSheet"));
    if (!p && matchMedia("(pointer: fine)").matches) setTimeout(() => $("planText").focus(), 120);
  }
  function savePlanSheet() {
    const e = S.planEdit; if (!e) return;
    const subject = radioVal("plSubject", e.subject), kind = radioVal("plKind", e.kind);
    const date = ISO.test($("planDate").value) ? $("planDate").value : e.date;
    const repeat = all('input[name="plRepeat"]:checked').map((i) => Number(i.value));
    const item = Object.assign({}, e, { title: clean($("planText").value).slice(0, 40), subject, kind, time: /^\d{2}:\d{2}$/.test($("planTime").value) ? $("planTime").value : "", date, repeat, updatedAt: stamp() });
    if (!item.id) { item.id = uid(); item.created = stamp(); S.plans.push(item); }
    else S.plans = S.plans.map((x) => (x.id === item.id ? Object.assign(item, { auto: x.auto && x.title === item.title ? x.auto : false }) : x));
    savePlans();
    S.planDay = repeat.length && !repeat.includes(weekdayOf(S.planDay)) ? S.planDay : date;
    if (S.planDay < S.planWeek || S.planDay > plusDays(S.planWeek, 6)) S.planWeek = monday(S.planDay);
    S.planEdit = null;
    closeOverlay($("planSheet"));
    FX.haptic(8);
    toast(e.id ? "排程已更新" : "已加入排程 " + (item.title || item.subject), { icon: "i-plan" });
    refreshViews();
  }
  async function deletePlan() {
    const e = S.planEdit; if (!e || !e.id) return;
    const rep = Array.isArray(e.repeat) && e.repeat.length;
    if (rep && !(await ask({ title: "刪除重複排程", body: "這是每週重複的排程 刪除後每一週都不會再出現", ok: "刪除", cancel: "保留", danger: true }))) return;
    const gone = S.plans.find((x) => x.id === e.id);
    S.plans = S.plans.filter((x) => x.id !== e.id); savePlans();
    S.planEdit = null; closeOverlay($("planSheet"));
    toast("已刪除排程", { icon: "i-trash", action: gone ? { label: "復原", run: () => { S.plans.push(gone); savePlans(); refreshViews(); } } : null });
    refreshViews();
  }
  /* 自動排程 依照弱點 到期複習與每天可讀的時間 排好這一週 */
  async function autoPlan() {
    const t = today(), mon = S.planWeek || monday(t), days = [0, 1, 2, 3, 4, 5, 6].map((i) => plusDays(mon, i)).filter((d) => d >= t);
    if (!days.length) { toast("這一週已經過去了 換到本週或下週再排", { tone: "warn" }); return; }
    const old = S.plans.filter((p) => p.auto && days.includes(p.date));
    if (old.length && !(await ask({ title: "重新自動排程", body: "這週已經有 " + old.length + " 個自動排程 會換成新的安排 你自己加的排程都會保留", ok: "重新安排", cancel: "取消", icon: "i-calendar" }))) return;
    S.plans = S.plans.filter((p) => !(p.auto && days.includes(p.date)));
    const pool = SUBJECTS.map((s) => s[0]).filter((n) => n !== "其他");
    const weight = {}; pool.forEach((n, i) => { weight[n] = 1 + (pool.length - i) * 0.01; });
    S.questions.forEach((q) => { if (weight[q.subject] != null) weight[q.subject] += isMastered(q) ? 0.2 : 1 + (isDue(q) ? 0.5 : 0); });
    const order = pool.slice().sort((a, b) => weight[b] - weight[a]);
    const topicOf = (subj) => { const f = {}; S.questions.filter((q) => q.subject === subj && !isMastered(q) && q.topic).forEach((q) => { f[q.topic] = (f[q.topic] || 0) + 1; }); const top = Object.entries(f).sort((a, b) => b[1] - a[1]); return top.length ? top.map((x) => x[0]) : []; };
    const topics = {}; order.forEach((n) => { topics[n] = topicOf(n); });
    let k = Number(cfg("autoPlanCursor", 0)) || 0, made = 0;
    const due = dueItems().length, kinds = ["寫題目", "讀課本", "寫考古題"];
    days.forEach((d, di) => {
      const wd = weekdayOf(d), weekend = wd === 0 || wd === 6;
      let left = availMinutes(weekend) - plansOn(d).reduce((a, p) => a + (p.minutes || 0), 0);
      if (S.questions.length && left >= 40) {
        const m = left >= 120 ? 30 : 20;
        S.plans.push({ id: uid(), created: stamp(), auto: true, date: d, repeat: [], time: "", subject: "其他", kind: "訂正錯題", minutes: m, title: d === t && due ? "複習錯題 今天到期 " + due + " 題" : "複習錯題本" });
        left -= m; made++;
      }
      while (left >= 25) {
        const subj = order[k % order.length], m = left >= 50 ? 50 : 25, tp = topics[subj] || [];
        const kind = subj === "英文" || subj === "英語" ? (k % 2 ? "背單字" : "寫題目") : kinds[(k + di) % kinds.length];
        const title = tp.length ? tp[(k + di) % tp.length] + " 弱點補強" : subj + " " + kind;
        S.plans.push({ id: uid(), created: stamp(), auto: true, date: d, repeat: [], time: "", subject: subj, kind, minutes: m, title });
        left -= m; k++; made++;
      }
    });
    setCfg("autoPlanCursor", k % 997); savePlans();
    FX.rain(); FX.haptic([12, 40, 16]);
    toast("排好 " + days.length + " 天 共 " + made + " 項 可以再自己調整", { icon: "i-calendar", duration: 4200 });
    refreshViews();
  }

  /* 補登與修改讀書紀錄 */
  function openLogSheet(x, date) {
    const now = new Date(Date.now() - 30 * 60000);
    S.logEdit = x ? Object.assign({}, x, { date }) : { id: "", subject: tm().subject || firstSubject(), kind: tm().kind || KINDS[0], sec: 1800, note: "", date: date || S.logDay || today(), start: "", mode: "up" };
    const e = S.logEdit, st = e.start ? new Date(e.start) : now;
    $("logTitle").textContent = x ? "修改讀書紀錄" : "補登讀書紀錄";
    $("logSaveText").textContent = x ? "儲存修改" : "加入紀錄";
    $("logDelete").hidden = !x;
    $("logSubject").innerHTML = SUBJECTS.map(([n, c]) => '<label class="pick"><input type="radio" name="lgSubject" value="' + esc(n) + '"' + (e.subject === n ? " checked" : "") + '><span style="--sc:' + c + '"><i></i>' + esc(n) + "</span></label>").join("");
    $("logKind").innerHTML = KINDS.map((n) => '<label class="pick"><input type="radio" name="lgKind" value="' + esc(n) + '"' + (e.kind === n ? " checked" : "") + "><span>" + esc(n) + "</span></label>").join("");
    S.logMin = Math.max(5, Math.round((e.sec || 1800) / 60));
    $("logMinutes").textContent = S.logMin + " 分鐘";
    $("logTime").value = pad(st.getHours()) + ":" + pad(st.getMinutes());
    $("logDate").value = e.date; $("logDateLabel").textContent = dateCN(e.date) + " " + weekdayCN(e.date);
    $("logNote").value = e.note || "";
    openOverlay($("logSheet"));
  }
  async function saveLogSheet() {
    const e = S.logEdit; if (!e) return;
    const date = ISO.test($("logDate").value) ? $("logDate").value : e.date;
    if (date > today()) { toast("不能補登未來的日子", { tone: "warn" }); return; }
    const tm2 = /^(\d{2}):(\d{2})$/.exec($("logTime").value) || [0, "19", "00"];
    const d0 = parseDate(date); d0.setHours(Number(tm2[1]), Number(tm2[2]), 0, 0);
    const sec = S.logMin * 60;
    const rec = { id: e.id || uid(), start: d0.toISOString(), end: new Date(d0.getTime() + sec * 1000).toISOString(), sec, subject: radioVal("lgSubject", e.subject), kind: radioVal("lgKind", e.kind), note: clean($("logNote").value).slice(0, 60), mode: e.mode || "up", planId: e.planId || "", manual: true };
    const ok = await putSession(rec, date, e.id ? e.date : null);
    if (!ok) { toast("沒有存成功 請再試一次", { tone: "warn" }); return; }
    S.logEdit = null; closeOverlay($("logSheet"));
    toast(e.id ? "紀錄已更新" : "已補登 " + S.logMin + " 分鐘", { icon: "i-timer" });
    refreshViews(); setTimeout(() => checkAchievements(false), 500);
  }

  /* 讀書頁 */
  function renderStudy() {
    buildTimerChips(); renderTimer(); renderPlan();
    const t = today(); S.logDay = S.logDay || t;
    const list = sessionsOn(S.logDay).sort((a, b) => String(b.start).localeCompare(String(a.start)));
    const sum = list.reduce((a, x) => a + (x.sec || 0), 0) / 60;
    $("logSub").textContent = (S.logDay === t ? "今天" : dateShort(S.logDay)) + " " + list.length + " 段 合計 " + minLabel(sum);
    $("logList").innerHTML = list.length ? list.map((x) => sessionRowHTML(x, S.logDay)).join("") : emptyHTML("i-timer", "今天還沒有讀書紀錄", "按上面的開始 或補登剛剛讀的時間");
    const mon = monday(t); let max = 30; const rows = [];
    for (let i = 0; i < 7; i++) { const d = plusDays(mon, i), m = minutesOn(d), plan = plansOn(d).reduce((a, p) => a + (p.minutes || 0), 0); rows.push({ d, m, plan }); max = Math.max(max, m, plan); }
    const wsum = rows.reduce((a, r) => a + r.m, 0);
    $("weekSum").textContent = "本週合計 " + minLabel(wsum) + " 平均每天 " + Math.round(wsum / Math.max(1, Math.min(7, dayDiff(t, mon) + 1))) + " 分鐘";
    $("studyChart").innerHTML = rows.map((r, i) => '<div class="sday' + (r.d === t ? " today" : "") + (r.d > t ? " future" : "") + '" title="' + esc(dateShort(r.d) + " 讀了 " + Math.round(r.m) + " 分鐘 排程 " + r.plan + " 分鐘") + '"><b>' + (r.m >= 1 ? Math.round(r.m) : "") + '</b><div class="sbar"><i class="plan" style="height:' + (r.plan / max * 100) + '%"></i><i class="got" style="--i:' + i + ";height:" + Math.max(r.m ? 3 : 0, r.m / max * 100) + '%"></i></div><span>' + (r.d === t ? "今天" : "週" + WEEKDAY_SHORT[weekdayOf(r.d)]) + "</span></div>").join("");
    const subs = {};
    rows.forEach((r) => sessionsOn(r.d).forEach((x) => { subs[x.subject] = (subs[x.subject] || 0) + (x.sec || 0) / 60; }));
    const ss = Object.entries(subs).sort((a, b) => b[1] - a[1]), smax = ss.length ? ss[0][1] : 1;
    $("subjectMins").innerHTML = ss.length ? ss.map(([n, m]) => '<div class="bar-row" style="--sc:' + subjColor(n) + '"><div class="bar-row-head"><span><i></i>' + esc(n) + "</span><b>" + Math.round(m) + ' 分</b></div><div class="meter"><i style="width:' + (m / smax * 100).toFixed(1) + '%"></i></div></div>').join("") : '<p class="muted center">開始計時後 這裡會顯示各科讀了多久</p>';
  }
  function renderStudyCard() {
    const t = today(), mins = minutesOn(t), items = plansOn(t), planned = items.reduce((a, p) => a + (p.minutes || 0), 0);
    const row = ckRow(t), ckPlan = row && row.checkin ? Number(row.checkin.minutes) || 0 : 0, goal = planned || ckPlan;
    FX.count($("scMinutes"), Math.round(mins));
    $("scGoal").textContent = goal ? (planned ? "今天排程 " : "打卡預計 ") + minLabel(goal) + (mins >= goal ? " 已經達成" : " 還差 " + Math.max(1, Math.round(goal - mins)) + " 分鐘") : "今天還沒有排程 可以到讀書計畫安排";
    $("scBar").style.width = goal ? Math.min(100, mins / goal * 100) + "%" : (mins ? "100%" : "0%");
    const active = tmActive(); S.studyCardLive = active;
    $("scStart").classList.toggle("live", active);
    if (!active) $("scStartText").textContent = "開始計時";
    $("scSub").textContent = items.length ? "今天 " + items.length + " 項排程 完成 " + items.filter((p) => isPlanDone(p.id, t)).length + " 項" : "按下開始 記下每一段專注";
    const next = items.filter((p) => !isPlanDone(p.id, t)).slice(0, 3);
    $("scPlan").innerHTML = next.map((p) => '<div class="sc-item" style="--sc:' + subjColor(p.subject) + '"><i></i><span>' + esc(p.title || p.subject) + "</span><small>" + (p.time ? esc(hhmmCN(p.time)) + " " : "") + p.minutes + ' 分</small><button type="button" class="pi-start sm" data-plan-start="' + esc(p.id) + '" aria-label="開始計時">' + icon("i-play") + "</button></div>").join("") ||
      (items.length ? '<p class="sc-done">' + icon("i-check") + "今天的排程都完成了</p>" : "");
    if (active) tmTick();
  }

  /* 落點預估 */
  const listenRank = { A: 4, B: 3, C: 2, F: 1 };
  const scoreOf = (k) => { const v = S.scores[k]; return Number.isInteger(v) && v >= 0 && v <= 15 ? v : null; };
  const cumAt = (k, s) => GSAT.cum[k][15 - s];
  function fiveLevel(k, s) { const f = GSAT.five[k]; for (let i = 0; i < 5; i++) if (s >= f[i]) return i; return 5; }
  function stageSubjects(str) { return String(str).match(/數A|數B|國|英|社|自/g) || []; }
  function saveScores() { S.scores.updatedAt = stamp(); setCfg("gsatScores", Object.assign({}, S.scores)); }
  function hasScores() { return GSAT.subj.some(([k]) => scoreOf(k) != null); }
  function loadCaac() {
    if (S.caac) return Promise.resolve(S.caac);
    if (S.caacLoading) return S.caacLoading;
    S.caacLoading = fetch("./data/caac.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d && Array.isArray(d.depts)) { S.caac = d; d.depts.forEach((x) => { x.sn = (d.schools && d.schools[x.s]) || x.s; }); }
      else S.caac = { depts: [], schools: {}, missing: true };
      return S.caac;
    }).catch(() => { S.caac = { depts: [], schools: {}, missing: true }; return S.caac; }).finally(() => { S.caacLoading = null; });
    return S.caacLoading;
  }
  /* 檢定 同時列出數A與數B時視為擇一通過 */
  function stdPass(dep) {
    const std = dep.std || {}, check = (k) => {
      const need = std[k];
      if (k === "英聽") { const g = S.scores.listen || ""; if (!g) return "miss"; return (listenRank[g] || 0) < (listenRank[String(need).charAt(0)] || 0) ? "fail" : "ok"; }
      const s = scoreOf(k), lv = FIVE_KEY[String(need).charAt(0)];
      if (lv == null || !GSAT.five[k]) return "ok";
      if (s == null) return "miss";
      return s < GSAT.five[k][lv] ? "fail" : "ok";
    };
    const keys = Object.keys(std), both = std["數A"] && std["數B"];
    let miss = false;
    for (const k of keys) {
      if (both && (k === "數A" || k === "數B")) continue;
      const r = check(k); if (r === "fail") return "fail"; if (r === "miss") miss = true;
    }
    if (both) { const a = check("數A"), m = check("數B"); if (a !== "ok" && m !== "ok") { if (a === "fail" || m === "fail") return "fail"; miss = true; } }
    return miss ? "miss" : "ok";
  }
  function impliedStages(mul) {
    if (!Array.isArray(mul) || !mul.length) return [];
    const by = {};
    mul.forEach(([k, m]) => { const v = Number(m); if (!v) return; const subs = stageSubjects(k); if (subs.length > 1) by["s" + v + k] = { v, key: subs.join("") }; else { by[v] = by[v] || { v, subs: [] }; by[v].subs.push(subs[0]); } });
    return Object.values(by).sort((a, b) => b.v - a.v).map((x) => x.key || x.subs.slice().sort().join(""));
  }
  function evalDept(dep) {
    const sp = stdPass(dep);
    if (sp === "miss") return { c: "miss" };
    if (sp === "fail") return { c: "nostd" };
    const res = dep.res;
    if (!res || !Array.isArray(res.st) || !res.st.length) return { c: "safe", noScreen: true, stages: [] };
    let worst = Infinity, all0 = true, reachable = true, sel = 0;
    const stages = [];
    for (const [key, cut] of res.st) {
      const subs = stageSubjects(key);
      if (!subs.length) continue;
      let sum = 0;
      for (const k of subs) { const v = scoreOf(k); if (v == null) return { c: "miss" }; sum += v; }
      const tol = Math.ceil(subs.length / 2), margin = sum - cut;
      stages.push({ subs, cut, sum, margin, tol });
      if (margin < 0) all0 = false;
      if (margin < -tol) reachable = false;
      worst = Math.min(worst, margin / tol);
      sel += cut / (15 * subs.length);
    }
    if (!stages.length) return { c: "safe", noScreen: true, stages: [] };
    const norm = (arr) => arr.map((x) => stageSubjects(x).sort().join("")).sort().join("|");
    const now = impliedStages(dep.mul);
    const chg = now.length > 0 && norm(now) !== norm(stages.map((x) => x.subs.join("")));
    let c = !reachable ? "out" : worst >= 1 ? "safe" : all0 ? "maybe" : "reach";
    if (chg && c === "safe") c = "maybe";
    return { c, stages, chg, sel: sel / stages.length, last: stages[stages.length - 1] };
  }
  function scoreCardHTML(k, name, color) {
    const s = scoreOf(k), lv = s == null ? -1 : fiveLevel(k, s);
    const pcts = []; for (let v = 0; v <= 15; v++) pcts.push(cumAt(k, v) - (v < 15 ? cumAt(k, v + 1) : 0));
    const mx = Math.max.apply(null, pcts), f = GSAT.five[k];
    const bars = pcts.map((p, v) => '<i class="' + (s === v ? "me" : s != null && v < s ? "below" : "") + '" style="height:' + Math.max(3, p / mx * 100).toFixed(1) + '%" title="' + v + " 級分 約 " + Math.max(p >= 0.5 ? 1 : 0, Math.round(p)) + '%"></i>').join("");
    const ticks = f.map((x, i) => '<span style="left:' + ((x + 0.5) / 16 * 100).toFixed(2) + '%">' + FIVE_NAMES[i].charAt(0) + "</span>").join("");
    return '<div class="score-card' + (s == null ? " is-empty" : "") + '" style="--sc:' + color + '" data-sk="' + k + '">' +
      '<div class="sk-head"><strong>' + esc(name) + "</strong>" + (s == null ? '<span class="lv none">未輸入</span>' : '<span class="lv l' + lv + '">' + (lv < 5 ? FIVE_NAMES[lv] : "未達底標") + "</span>") + "</div>" +
      '<div class="sk-ctrl"><button type="button" class="step-btn" data-sd="-1" data-k="' + k + '" aria-label="' + esc(name) + '減一級分">' + icon("i-minus") + '</button><output class="sk-num">' + (s == null ? "<small>未輸入</small>" : s) + '</output><button type="button" class="step-btn" data-sd="1" data-k="' + k + '" aria-label="' + esc(name) + '加一級分">' + icon("i-plus") + "</button></div>" +
      '<div class="hist" aria-hidden="true">' + bars + '</div><div class="hist-ticks" aria-hidden="true">' + ticks + "</div>" +
      '<p class="sk-pos">' + (s == null ? "按加號從均標開始" : "全國前 <b>" + Math.max(1, Math.round(cumAt(k, s))) + "%</b> 贏過約 " + Math.min(99, Math.round(100 - cumAt(k, s))) + "% 考生") + "</p>" +
      (s == null ? "" : '<button type="button" class="sk-clear" data-sclear="' + k + '">設為未考</button>') + "</div>";
  }
  function renderScores() {
    $("scoreGrid").innerHTML = GSAT.subj.map(([k, n, c]) => scoreCardHTML(k, n, c)).join("");
    all("#listenSeg .seg-item").forEach((b) => b.classList.toggle("active", b.dataset.listen === (S.scores.listen || "")));
    if (UI.listen) UI.listen.sync();
    const got = GSAT.subj.filter(([k]) => scoreOf(k) != null), sum = got.reduce((a, [k]) => a + scoreOf(k), 0);
    const five = ["國", "英", "社", "自"].every((k) => scoreOf(k) != null) && (scoreOf("數A") != null || scoreOf("數B") != null);
    const best5 = five ? ["國", "英", "社", "自"].reduce((a, k) => a + scoreOf(k), 0) + Math.max(scoreOf("數A") || 0, scoreOf("數B") || 0) : 0;
    $("scoreSum").innerHTML = got.length ? "<span>已輸入 <b>" + got.length + "</b> 科 合計 <b>" + sum + "</b> 級分</span>" + (five ? "<span>國英數社自 五科 <b>" + best5 + "</b> 級分</span>" : "") : "<span>還沒有輸入級分</span>";
    $("scoreSub").textContent = "對照 " + GSAT.year + " 學年度學測 每一科都會顯示你在全國的位置";
  }
  function renderAdmit() {
    renderScores();
    const d = S.caac;
    if (!d) { $("admitList").innerHTML = '<div class="loading-row">' + icon("i-refresh") + "正在載入校系資料</div>"; loadCaac().then(() => { if (S.tab === "admit") renderAdmit(); }); return; }
    const groups = ADMIT_GROUPS.map((g) => g[0]);
    $("groupChips").innerHTML = '<button type="button" class="fchip' + (!S.admitGroup ? " active" : "") + '" data-agroup="">全部學群</button>' + groups.map((g) => '<button type="button" class="fchip' + (S.admitGroup === g ? " active" : "") + '" data-agroup="' + esc(g) + '">' + esc(g) + "</button>").join("");
    $("admitSource").innerHTML = d.missing || !d.depts.length ? "校系資料還沒有準備好" :
      "校系資料參考 University TW 整理之 " + esc(d.year || "") + " 年個人申請校系分則與 " + esc(d.resYear || "") + " 年一階篩選結果 更新於 " + esc(dateCN(String(d.updatedAt || "").slice(0, 10))) + (d.sample ? " 目前為部分校系示範資料 部署後會自動補齊" : "") + " 級分分布依據大考中心 " + GSAT.year + " 學年度學測級分人數百分比累計表 推估結果僅供參考";
    if (d.missing || !d.depts.length) {
      $("admitList").innerHTML = emptyHTML("i-school", "校系資料準備中", "部署到 GitHub 後 每月會自動從 University TW 整理最新資料");
      all("#chanceSeg [data-cn]").forEach((b) => { b.textContent = "0"; });
      return;
    }
    if (!hasScores()) {
      $("admitSub").textContent = "先在上面輸入各科級分";
      $("admitList").innerHTML = emptyHTML("i-target", "輸入級分就能開始比對", "可以用模擬考成績 或你預估的學測級分");
      all("#chanceSeg [data-cn]").forEach((b) => { b.textContent = "0"; });
      return;
    }
    const q = clean($("admitSearch").value).toLowerCase(), gre = S.admitGroup ? (ADMIT_GROUPS.find((g) => g[0] === S.admitGroup) || [0, /./])[1] : null;
    const rows = d.depts.map((dep) => ({ dep, r: evalDept(dep) }));
    const filtered = rows.filter(({ dep }) => (!q || (dep.sn + dep.n).toLowerCase().includes(q)) && (!gre || gre.test(dep.n)));
    const cnt = { safe: 0, maybe: 0, reach: 0, fav: 0 };
    filtered.forEach(({ dep, r }) => { if (cnt[r.c] != null) cnt[r.c]++; if (S.fav.includes(dep.c)) cnt.fav++; });
    all("#chanceSeg [data-cn]").forEach((b) => { b.textContent = cnt[b.dataset.cn]; });
    all("#chanceSeg .seg-item").forEach((b) => b.classList.toggle("active", b.dataset.chance === S.admitChance));
    if (UI.chance) UI.chance.sync();
    const nostd = filtered.filter(({ r }) => r.c === "nostd").length, miss = filtered.filter(({ r }) => r.c === "miss").length;
    $("admitSub").textContent = "共比對 " + filtered.length + " 個校系" + (nostd ? " 未達檢定 " + nostd + " 個" : "") + (miss ? " 缺少科目成績 " + miss + " 個" : "");
    let list = S.admitChance === "fav" ? filtered.filter(({ dep }) => S.fav.includes(dep.c)) : filtered.filter(({ r }) => r.c === S.admitChance);
    list.sort((a, b) => (b.r.sel || 0) - (a.r.sel || 0) || String(a.dep.c).localeCompare(String(b.dep.c)));
    const shown = list.slice(0, S.admitShow);
    $("admitList").innerHTML = shown.length ? shown.map(({ dep, r }) => admitItemHTML(dep, r)).join("") + (list.length > shown.length ? '<div class="load-more"><button type="button" class="btn btn-ghost" data-admit-more>顯示更多 還有 ' + (list.length - shown.length) + " 個</button></div>" : "")
      : emptyHTML(S.admitChance === "fav" ? "i-star" : "i-search", S.admitChance === "fav" ? "還沒有加入志願" : "這一類目前沒有校系", S.admitChance === "fav" ? "點校系右上角的星星 就能收進志願清單" : "換個機會分類 學群或關鍵字看看");
  }
  function admitItemHTML(dep, r) {
    const fav = S.fav.includes(dep.c);
    const stages = (r.stages || []).map((x) => '<span class="stg ' + (x.margin >= x.tol ? "ok" : x.margin >= 0 ? "edge" : "low") + '"><em>' + esc(x.subs.join("")) + "</em>去年 <b>" + x.cut + "</b> 你 <b>" + x.sum + "</b></span>").join("");
    const std = Object.entries(dep.std || {}).map(([k, v]) => k + " " + (k === "英聽" ? v : v + "標")).join(" ");
    const url = "https://university-tw.ldkrsi.men/caac/" + encodeURIComponent(dep.s) + "/" + encodeURIComponent(dep.c);
    return '<article class="admit-item c-' + r.c + '"><div class="ai-top"><span class="chance c-' + r.c + '">' + CHANCE[r.c] + '</span><div class="ai-name"><strong>' + esc(dep.n) + "</strong><span>" + esc(dep.sn) + "</span></div>" +
      '<button type="button" class="icon-btn fav-btn' + (fav ? " on" : "") + '" data-fav="' + esc(dep.c) + '" aria-pressed="' + fav + '" aria-label="' + (fav ? "移出志願" : "加入志願") + '">' + icon("i-star") + "</button></div>" +
      (stages ? '<div class="ai-stages">' + stages + "</div>" : r.noScreen ? '<div class="ai-stages"><span class="stg ok">去年沒有超額篩選 通過檢定即可</span></div>' : "") +
      '<div class="ai-meta">' + (dep.q ? "<span>名額 " + dep.q + "</span>" : "") + (std ? "<span>檢定 " + esc(std) + "</span>" : "") + (r.chg ? '<span class="warn">今年篩選方式有變動</span>' : "") + (r.last && r.last.margin === 0 && dep.res && dep.res.x ? '<span class="warn">同分可能還要超額比序</span>' : "") +
      '<a class="ai-src" href="' + url + '" target="_blank" rel="noopener">University TW' + icon("i-external") + "</a></div></article>";
  }
  function renderAdmitTeaser() {
    const box = $("atBody");
    if (!hasScores()) { box.innerHTML = '<p class="at-empty">輸入學測或模擬考級分 看看自己在全國的位置</p><button type="button" class="btn btn-ghost btn-sm" data-go="admit">' + icon("i-target") + "輸入級分</button>"; return; }
    const chips = GSAT.subj.filter(([k]) => scoreOf(k) != null).map(([k, , c]) => { const s = scoreOf(k), lv = fiveLevel(k, s); return '<span class="at-chip" style="--sc:' + c + '"><b>' + k + "</b>" + s + "<small>" + (lv < 5 ? FIVE_NAMES[lv] : "底標下") + "</small></span>"; }).join("");
    if (!S.caac) { box.innerHTML = '<div class="at-chips">' + chips + "</div>"; loadCaac().then(() => renderAdmitTeaser()); return; }
    if (!S.caac.depts.length) { box.innerHTML = '<div class="at-chips">' + chips + '</div><p class="at-empty">校系資料準備中</p>'; return; }
    const cnt = { safe: 0, maybe: 0, reach: 0 };
    S.caac.depts.forEach((dep) => { const c = evalDept(dep).c; if (cnt[c] != null) cnt[c]++; });
    box.innerHTML = '<div class="at-chips">' + chips + '</div><div class="at-stats"><div class="c-safe"><strong>' + cnt.safe + "</strong><span>機會高</span></div><div class=\"c-maybe\"><strong>" + cnt.maybe + "</strong><span>有機會</span></div><div class=\"c-reach\"><strong>" + cnt.reach + "</strong><span>挑戰</span></div></div>";
  }
  function stepScore(k, d) {
    const cur = scoreOf(k);
    S.scores[k] = cur == null ? GSAT.five[k][2] : Math.max(0, Math.min(15, cur + d));
    saveScores(); FX.haptic(4);
    const card = document.querySelector('.score-card[data-sk="' + k + '"]');
    const meta = GSAT.subj.find((x) => x[0] === k);
    if (card && meta) { card.outerHTML = scoreCardHTML(k, meta[1], meta[2]); }
    clearTimeout(S.admitT); S.admitT = setTimeout(() => { renderAdmit(); }, 260);
  }

  /* 讀書與落點的事件 */
  function setMode(m) {
    const t = tm();
    if (t.mode === m) return;
    if (tmActive()) { toast("計時中不能切換 先完成或捨棄這一段", { tone: "warn" }); renderTimer(); return; }
    t.mode = m; tmSave(); FX.haptic(4); renderTimer();
  }
  function setChance(c) { S.admitChance = c; S.admitShow = 30; renderAdmit(); FX.haptic(4); }
  function setListen(v) { S.scores.listen = v; saveScores(); renderAdmit(); FX.haptic(4); }
  function studyClick(t, ev) {
    const ps = t.closest("[data-plan-start]");
    if (ps) { ev.preventDefault(); const p = S.plans.find((x) => x.id === ps.dataset.planStart); if (p) startFromPlan(p); return true; }
    const pd = t.closest("[data-plan-done]");
    if (pd) {
      const id = pd.dataset.planDone, d = pd.dataset.date, v = !isPlanDone(id, d);
      setPlanDone(id, d, v).then(() => {
        if (v) { FX.haptic([10, 40, 14]); FX.fromEl(pd, { count: 18, power: 6 }); const left = plansOn(d).filter((p) => !isPlanDone(p.id, d)).length; toast(left ? "完成一項 還有 " + left + " 項" : "這天的排程全部完成", { icon: "i-plan" }); }
        refreshViews(); if (v) setTimeout(() => checkAchievements(false), 500);
      });
      return true;
    }
    const pe = t.closest("[data-plan-edit]");
    if (pe) { const p = S.plans.find((x) => x.id === pe.dataset.planEdit); if (p) openPlanSheet(p, pe.dataset.date); return true; }
    const pn = t.closest("[data-plan-new]");
    if (pn) { openPlanSheet(null, pn.dataset.planNew); return true; }
    const pday = t.closest("[data-plan-day]");
    if (pday) { S.planDay = pday.dataset.planDay; S.logDay = S.planDay <= today() ? S.planDay : today(); renderStudy(); FX.haptic(3); return true; }
    const le = t.closest("[data-log-edit]");
    if (le) { const x = sessionsOn(le.dataset.date).find((k) => k.id === le.dataset.logEdit); if (x) openLogSheet(x, le.dataset.date); return true; }
    const fav = t.closest("[data-fav]");
    if (fav) {
      const c = fav.dataset.fav, on = S.fav.includes(c);
      S.fav = on ? S.fav.filter((x) => x !== c) : S.fav.concat(c); setCfg("admitFav", S.fav);
      FX.haptic(on ? 4 : [8, 30, 10]); if (!on) FX.fromEl(fav, { count: 14, power: 5, gold: true });
      fav.classList.toggle("on", !on); fav.setAttribute("aria-pressed", String(!on));
      clearTimeout(S.admitT); S.admitT = setTimeout(renderAdmit, S.admitChance === "fav" ? 200 : 600);
      return true;
    }
    if (t.closest("[data-admit-more]")) { S.admitShow += 30; renderAdmit(); return true; }
    const ag = t.closest("[data-agroup]");
    if (ag) { S.admitGroup = ag.dataset.agroup; S.admitShow = 30; renderAdmit(); return true; }
    const se = t.closest("[data-set-exam]");
    if (se) { applyExamChoice({ id: se.dataset.setExam, ay: 0 }); FX.haptic([8, 30, 10]); if (S.tab === "settings") renderSettings(); return true; }
    const av = t.closest("[data-avail]");
    if (av) {
      const weekend = av.dataset.avail === "weekend", v = Math.max(30, Math.min(720, availMinutes(weekend) + Number(av.dataset.delta)));
      setCfg(weekend ? "availWeekend" : "availWeekday", v); $(weekend ? "availWeekend" : "availWeekday").textContent = minutesLabel(v); FX.haptic(4);
      return true;
    }
    return false;
  }
  function wireStudy() {
    $("timerMain").addEventListener("click", tmToggle);
    $("timerStop").addEventListener("click", () => tmFinish(false));
    $("timerReset").addEventListener("click", async () => { if (await ask({ title: "捨棄這次計時", body: "這段時間不會被記錄", ok: "捨棄", cancel: "保留", danger: true })) tmReset(); });
    $("timerMode").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode); });
    $("timerSubject").addEventListener("change", (e) => { tm().subject = e.target.value; tmSave(); renderTimer(); });
    $("timerKind").addEventListener("change", (e) => { tm().kind = e.target.value; tmSave(); renderTimer(); });
    $("timerNote").addEventListener("input", () => { tm().note = $("timerNote").value; clearTimeout(TM.saveT); TM.saveT = setTimeout(tmSave, 400); });
    $("focusBtn").addEventListener("click", openFocus);
    $("focusPause").addEventListener("click", () => { tmToggle(); if (tm().run) wakeOn(); });
    $("focusDone").addEventListener("click", () => tmFinish(false));
    $("focusClose").addEventListener("click", () => closeOverlay($("focusMode")));
    $("miniTimer").addEventListener("click", () => setTab("study"));
    $("scStart").addEventListener("click", () => { const go = !tmActive(); setTab("study"); if (go) tmStart(); });

    $("planAdd").addEventListener("click", () => openPlanSheet(null, S.planDay >= today() ? S.planDay : today()));
    $("planAuto").addEventListener("click", autoPlan);
    $("weekPrev").addEventListener("click", () => { S.planWeek = plusDays(S.planWeek || monday(today()), -7); S.planDay = S.planWeek; renderPlan(); });
    $("weekNext").addEventListener("click", () => { S.planWeek = plusDays(S.planWeek || monday(today()), 7); S.planDay = S.planWeek; renderPlan(); });
    $("planClose").addEventListener("click", () => closeOverlay($("planSheet")));
    $("planSave").addEventListener("click", savePlanSheet);
    $("planDelete").addEventListener("click", deletePlan);
    const PLAN_STEPS = [15, 20, 25, 30, 40, 50, 60, 75, 90, 120, 150, 180, 240, 300];
    const stepPlan = (dir) => {
      if (!S.planEdit) return;
      const cur = S.planEdit.minutes || 50, i = PLAN_STEPS.findIndex((x) => x >= cur);
      const j = i < 0 ? PLAN_STEPS.length - 1 : PLAN_STEPS[i] === cur ? i + dir : dir > 0 ? i : i - 1;
      S.planEdit.minutes = PLAN_STEPS[Math.max(0, Math.min(PLAN_STEPS.length - 1, j))];
      $("planMinutes").textContent = S.planEdit.minutes + " 分鐘"; FX.haptic(4);
    };
    $("planMinus").addEventListener("click", () => stepPlan(-1));
    $("planPlus").addEventListener("click", () => stepPlan(1));
    $("planDate").addEventListener("change", () => { const v = $("planDate").value; if (ISO.test(v)) $("planDateLabel").textContent = dateCN(v) + " " + weekdayCN(v); });
    $("planText").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); savePlanSheet(); } });

    $("logAdd").addEventListener("click", () => openLogSheet(null, S.logDay || today()));
    $("logClose").addEventListener("click", () => closeOverlay($("logSheet")));
    $("logSave").addEventListener("click", saveLogSheet);
    $("logDelete").addEventListener("click", async () => {
      const e = S.logEdit; if (!e || !e.id) return;
      if (!(await ask({ title: "刪除這段紀錄", body: "刪除後讀書時間會跟著減少", ok: "刪除", cancel: "保留", danger: true }))) return;
      S.logEdit = null; closeOverlay($("logSheet")); dropSession(e.id, e.date);
    });
    const stepLog = (d) => { S.logMin = Math.max(5, Math.min(600, (S.logMin || 30) + d)); $("logMinutes").textContent = S.logMin + " 分鐘"; FX.haptic(4); };
    $("logMinus").addEventListener("click", () => stepLog(-5));
    $("logPlus").addEventListener("click", () => stepLog(5));
    $("logDate").addEventListener("change", () => { const v = $("logDate").value; if (ISO.test(v)) $("logDateLabel").textContent = dateCN(v) + " " + weekdayCN(v); });

    $("scoreGrid").addEventListener("click", (e) => {
      const b = e.target.closest("[data-sd]"); if (b) { stepScore(b.dataset.k, Number(b.dataset.sd)); return; }
      const c = e.target.closest("[data-sclear]"); if (c) { S.scores[c.dataset.sclear] = null; saveScores(); renderAdmit(); }
    });
    $("scoreClear").addEventListener("click", async () => {
      if (!hasScores()) return;
      if (!(await ask({ title: "清空級分", body: "各科級分與英聽都會清空 志願清單會保留", ok: "清空", cancel: "取消", danger: true }))) return;
      S.scores = {}; saveScores(); renderAdmit();
    });
    $("listenSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-listen]"); if (b) setListen(b.dataset.listen); });
    $("chanceSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-chance]"); if (b) setChance(b.dataset.chance); });
    let st = null;
    $("admitSearch").addEventListener("input", () => { clearTimeout(st); st = setTimeout(() => { S.admitShow = 30; renderAdmit(); }, 180); });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      if (tm().run) { tmTick(); if (!$("focusMode").hidden) wakeOn(); }
      fetchExams(false);
    });
  }

  /* 重繪 */
  function refreshViews() {
    renderChrome(); renderOverview();
    if (S.tab === "library") renderLibrary();
    if (S.tab === "review") renderReview();
    if (S.tab === "analytics") renderAnalytics();
    if (S.tab === "settings") renderSettings();
    if (S.tab === "study") renderStudy();
    if (S.tab === "admit") renderAdmit();
  }
  function renderAll() {
    renderChrome(); renderOverview(); renderLibrary(); renderReview(); renderAnalytics(); renderSettings();
    if (S.tab === "study") renderStudy();
    if (S.tab === "admit") renderAdmit();
    nextCheer(false);
  }

  /* 事件 */
  function wire() {
    document.addEventListener("click", async (ev) => {
      const t = ev.target;
      if (studyClick(t, ev)) return;
      const ckb = t.closest("[data-checkin]");
      if (ckb) { ev.preventDefault(); openCheckin(); return; }
      const nav = t.closest("[data-go]");
      if (nav) {
        ev.preventDefault();
        const top = overlays[overlays.length - 1]; if (top) closeOverlay(top);
        const go = nav.dataset.go;
        whenSettled(() => setTab(go, { scrollTo: nav.dataset.scroll }));
        return;
      }
      const zoom = t.closest("[data-zoom]");
      if (zoom) { openLightbox(zoom.currentSrc || zoom.src, false); return; }
      const act = t.closest("[data-action]");
      if (act) {
        if (act.tagName === "ARTICLE" && t.closest("button")) return;
        await handleAction(act); return;
      }
      const rev = t.closest("[data-review]");
      if (rev) { rev.disabled = true; try { await reviewRating(rev.dataset.review, rev); } finally { rev.disabled = false; } return; }
      const fs = t.closest("[data-subject]");
      if (fs) { S.libSubject = fs.dataset.subject; S.pageSize = 24; renderLibrary(); return; }
      const rs = t.closest("[data-rsubject]");
      if (rs) { S.reviewSubject = rs.dataset.rsubject; S.reviewing = null; S.revealed = false; renderReview(); return; }
      const st = t.closest("#statusSeg [data-status]");
      if (st) { S.libStatus = st.dataset.status; S.pageSize = 24; renderLibrary(); if (UI.status) UI.status.sync(); return; }
      const th = t.closest("[data-theme-pick]");
      if (th) { applyTheme(th.dataset.themePick); setCfg("theme", S.theme); return; }
      const step = t.closest("[data-step]");
      if (step) { const inp = $(step.dataset.step); inp.value = Math.max(0, Math.min(9999, (Number(inp.value) || 0) + Number(step.dataset.delta))); scheduleDaily(); FX.haptic(4); return; }
      if (t.closest("[data-close]")) { const o = t.closest(".overlay"); if (o) closeOverlay(o); }
      if (t.id === "loadMoreQuestions") { S.pageSize += 24; renderLibrary(); }
    });
    document.addEventListener("keydown", (e) => {
      if (!$("welcome").hidden) {
        const tag = (e.target && e.target.tagName) || "";
        if (e.key === "Escape") { e.preventDefault(); closeWelcome(false); }
        else if (e.key === "ArrowRight" && tag !== "INPUT") welcomeGo(W.i + 1);
        else if (e.key === "ArrowLeft" && tag !== "INPUT") welcomeGo(W.i - 1);
        return;
      }
      if (e.key === "Escape") { const top = overlays[overlays.length - 1]; if (top) { e.preventDefault(); closeOverlay(top); } return; }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "") || (e.target && e.target.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (overlays.length) {
        if (!$("detailModal").hidden && (e.key === "ArrowLeft" || e.key === "ArrowRight")) stepModal(e.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (e.target && e.target.matches && e.target.matches(".qcard") && e.key === "Enter") { handleAction(e.target); return; }
      const k = e.key.toLowerCase();
      if (S.tab === "review" && S.reviewing) {
        if ((e.key === " " || e.key === "Enter") && !S.revealed && !(e.target && e.target.closest && e.target.closest("button"))) { e.preventDefault(); reviewRating("reveal"); return; }
        if (S.revealed && ["1", "2", "3"].includes(e.key)) { e.preventDefault(); const r = { 1: "again", 2: "hard", 3: "good" }[e.key]; reviewRating(r, document.querySelector('[data-review="' + r + '"]')); return; }
        if (k === "s") { e.preventDefault(); reviewRating("skip"); return; }
      }
      if (k === "c") { e.preventDefault(); openCheckin(); return; }
      if (k === "t") { e.preventDefault(); setTab("study"); return; }
      if (S.tab === "study" && e.key === " " && !(e.target && e.target.closest && e.target.closest("button,a"))) { e.preventDefault(); tmToggle(); return; }
      if (k === "n") { e.preventDefault(); setTab("add"); setTimeout(() => $("photoDrop").focus(), 60); }
      else if (k === "f") { e.preventDefault(); setTab("library"); setTimeout(() => $("searchInput").focus(), 60); }
    });

    $("modalClose").addEventListener("click", () => closeOverlay($("detailModal")));
    $("modalPrev").addEventListener("click", () => stepModal(-1));
    $("modalNext").addEventListener("click", () => stepModal(1));
    $("lightClose").addEventListener("click", () => closeOverlay($("lightbox")));
    $("lensToggle").addEventListener("click", () => { const v = !(UI.lens && UI.lens.on); if (UI.lens) UI.lens.enable(v); $("lensToggle").classList.toggle("on", v); $("lightTip").textContent = v ? "拖曳放大鏡檢查細節" : "點放大鏡檢查小字與公式"; });
    $("celebrateOk").addEventListener("click", () => closeOverlay($("celebrate")));

    $("choosePhoto").addEventListener("click", () => $("galleryInput").click());
    $("takePhoto").addEventListener("click", () => $("cameraInput").click());
    $("galleryInput").addEventListener("change", (e) => loadPhoto(e.target.files[0]));
    $("cameraInput").addEventListener("change", (e) => loadPhoto(e.target.files[0]));
    $("removePhoto").addEventListener("click", () => { if (!S.image) return; clearTimeout(OCR.autoTimer); if (OCR.running) stopOcr(true); OCR.lastAutoText = ""; releaseOcrSource(); S.image = ""; S.visuals = S.visuals.filter(v => !String(v.title || "").startsWith("自動擷取：")); previewImage(); previewVisuals(); scheduleDraft(); status("ocrStatus", "已移除圖片"); });
    $("runOcr").addEventListener("click", () => { if (!S.image || OCR.running) return; OCR.lang = langForSubject(radioVal("subject", "")); runOcr(true, true); });
    wireOcr(); wireVisuals();
    $("rotatePhoto").addEventListener("click", rotatePhoto);
    $("zoomPhoto").addEventListener("click", () => { if (!S.image) { toast("請先加入圖片", { tone: "warn" }); return; } openLightbox(S.image, true); });
    const drop = $("photoDrop");
    drop.addEventListener("click", () => { if (S.image) openLightbox(S.image, false); else $("galleryInput").click(); });
    drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); drop.click(); } });
    ["dragenter", "dragover"].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
    ["dragleave", "dragend"].forEach((n) => drop.addEventListener(n, () => drop.classList.remove("dragging")));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("dragging"); const f = Array.from(e.dataTransfer.files || []).find((x) => /^image\//.test(x.type)); if (f) loadPhoto(f); });
    document.addEventListener("paste", (e) => {
      const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
      const it = items.find((x) => x.kind === "file" && /^image\//.test(x.type));
      if (!it) return;
      e.preventDefault();
      if (S.tab !== "add") setTab("add");
      loadPhoto(it.getAsFile()); toast("已貼上截圖", { icon: "i-image" });
    });
    $("requestPersist").addEventListener("click", requestPersist);
    ["questionText", "answerText", "solutionText", "reflectionText", "topicField", "sourceField"].forEach((n) => $(n).addEventListener("input", scheduleDraft));
    $("subjectChips").addEventListener("change", () => { updateTopics(); scheduleDraft(); });
    $("reasonChips").addEventListener("change", scheduleDraft);
    $("levelSeg").addEventListener("change", () => { updateLevel(); if (UI.level) UI.level.sync(); scheduleDraft(); });
    $("questionForm").addEventListener("submit", (e) => e.preventDefault());
    $("saveBtn").addEventListener("click", saveQuestion);
    $("questionForm").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target && e.target.tagName === "INPUT") { e.preventDefault(); scheduleDraft(); } });
    $("cancelEdit").addEventListener("click", async () => {
      clearTimeout(saveTimer);
      if (saving) await saving;
      const q = S.questions.find((x) => x.id === S.editing);
      if (q && S.autoNew === q.id) {
        if (!(await ask({ title: "捨棄這一題", body: "這題已經自動存進錯題本 捨棄後會從資料庫刪除", ok: "捨棄", cancel: "繼續編輯", danger: true }))) return;
        resetEditor(); deleteQuestion(q); return;
      }
      if (q && S.editOriginal) {
        if (!(await ask({ title: "復原這次修改", body: "會回到開始編輯前的內容 這次的修改都會取消", ok: "復原", cancel: "繼續編輯", danger: true }))) return;
        const orig = Object.assign({}, S.editOriginal, { updatedAt: stamp() });
        try { await dbRequest("questions", "put", orig); S.questions = S.questions.map((x) => (x.id === orig.id ? orig : x)); dropImg(orig.id); } catch (e) { toast("復原失敗 請再試一次", { tone: "warn" }); return; }
        resetEditor(); setTab("library"); toast("已復原成編輯前的內容"); return;
      }
      const dirty = $("questionText").value.trim() || S.image || $("solutionText").value.trim() || $("answerText").value.trim();
      if (dirty && !(await ask({ title: "清空目前內容", body: "還沒有存成錯題的內容會消失", ok: "清空", cancel: "繼續編輯", danger: true }))) return;
      resetEditor();
    });

    let searchTimer;
    $("searchInput").addEventListener("input", () => { $("searchClear").hidden = !$("searchInput").value; clearTimeout(searchTimer); searchTimer = setTimeout(() => { S.pageSize = 24; renderLibrary(); }, 140); });
    $("searchClear").addEventListener("click", () => { $("searchInput").value = ""; $("searchClear").hidden = true; renderLibrary(); $("searchInput").focus(); });
    $("sortFilter").addEventListener("change", () => { S.pageSize = 24; renderLibrary(); });
    $("searchQuick").addEventListener("click", () => { setTab("library"); setTimeout(() => $("searchInput").focus(), 80); });
    $("themeQuick").addEventListener("click", () => { const dark = document.documentElement.dataset.theme === "dark"; applyTheme(dark ? "light" : "dark"); setCfg("theme", S.theme); });

    $("dailyForm").addEventListener("submit", saveDaily);
    ["dailyTotal", "dailyCorrect"].forEach((n) => $(n).addEventListener("input", scheduleDaily));
    $("cheerNext").addEventListener("click", () => { nextCheer(true); FX.haptic(5); });
    $("goalAdjust").addEventListener("click", () => { setTab("settings", { scrollTo: "goalField" }); setTimeout(() => $("goalField").focus({ preventScroll: true }), 500); });

    let nickTimer;
    $("nicknameField").addEventListener("input", () => { clearTimeout(nickTimer); nickTimer = setTimeout(() => { S.nickname = clean($("nicknameField").value).slice(0, 20); setCfg("nickname", S.nickname); renderChrome(); renderOverview(); }, 400); });
    mountExamPicker($("setExamPick"), settingsExamState, applyExamChoice);
    $("chimeToggle").addEventListener("change", (e) => { setCfg("chime", e.target.checked); if (e.target.checked) chime(); });
    $("wakeToggle").addEventListener("change", (e) => { setCfg("wake", e.target.checked); });
    const setGoal = (v) => { S.goal = Math.max(1, Math.min(60, Math.round(Number(v) || 8))); $("goalField").value = S.goal; setCfg("dailyGoal", S.goal); renderOverview(); };
    $("goalMinus").addEventListener("click", () => { setGoal(S.goal - 1); FX.haptic(4); });
    $("goalPlus").addEventListener("click", () => { setGoal(S.goal + 1); FX.haptic(4); });
    $("goalField").addEventListener("change", () => setGoal($("goalField").value));
    $("effectsToggle").addEventListener("change", (e) => { S.effects = e.target.checked; FX.enabled = S.effects; setCfg("effects", S.effects); if (S.effects) { FX.fromEl(e.target, { count: 26, power: 7 }); toast("鼓勵特效已開啟", { icon: "i-star" }); } });
    $("hapticsToggle").addEventListener("change", (e) => { S.haptics = e.target.checked; FX.haptics = S.haptics; setCfg("haptics", S.haptics); FX.haptic(15); });
    $("ocrModelBtn").addEventListener("click", () => { OCR.ready = false; preloadOCR(true); });
    $("ocrPrefetchToggle").addEventListener("change", (e) => { setCfg("ocrPrefetch", e.target.checked); if (e.target.checked && !OCR.ready) preloadOCR(false); });
    window.addEventListener("online", () => { if (cfg("ocrPrefetch", true) && !OCR.ready) preloadOCR(false); });
    $("liteToggle").addEventListener("change", (e) => { applyLite(e.target.checked); setCfg("lite", S.lite); toast(S.lite ? "省電模式已開啟 畫面更輕盈" : "已恢復完整視覺效果", { icon: S.lite ? "i-leaf" : "i-star" }); });
    $("exportBackup").addEventListener("click", exportBackup);
    $("importBackup").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", (e) => importBackup(e.target.files[0]));

    /* 長按清除 */
    const hold = $("eraseAll"); let holdTimer = null;
    const cancelHold = () => { clearTimeout(holdTimer); hold.classList.remove("holding"); };
    hold.addEventListener("pointerdown", (e) => { e.preventDefault(); hold.classList.add("holding"); FX.haptic(6); holdTimer = setTimeout(() => { hold.classList.remove("holding"); FX.haptic([30, 40, 30]); eraseAll(); }, 2000); });
    ["pointerup", "pointerleave", "pointercancel"].forEach((n) => hold.addEventListener(n, cancelHold));
    hold.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); eraseAll(); } });

    /* 每日打卡 */
    $("ckClose").addEventListener("click", () => closeOverlay($("checkinSheet")));
    const stampBtn = $("ckStamp"); let stampHold = null;
    stampBtn.addEventListener("pointerdown", (e) => {
      if (ckOn(today())) return;
      e.preventDefault();
      stampBtn.classList.add("pressing"); FX.haptic(6);
      stampHold = setTimeout(() => { stampHold = null; stampBtn.classList.remove("pressing"); doCheckIn(); }, 520);
    });
    const stampCancel = () => { if (stampHold) { clearTimeout(stampHold); stampHold = null; stampBtn.classList.remove("pressing"); $("ckHint").innerHTML = "再按久一點 <b>印章才會蓋下去</b>"; } };
    ["pointerup", "pointerleave", "pointercancel"].forEach((n) => stampBtn.addEventListener(n, stampCancel));
    stampBtn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doCheckIn(); } });
    $("ckMood").addEventListener("change", saveCheckinFields);
    $("ckNote").addEventListener("input", saveCheckinFields);
    const stepMin = (d) => { S.ckMinutes = Math.max(0, Math.min(960, (S.ckMinutes || 0) + d)); $("ckMinutesLabel").textContent = minutesLabel(S.ckMinutes); FX.haptic(4); saveCheckinFields(); };
    $("ckMinus").addEventListener("click", () => stepMin(-30));
    $("ckPlus").addEventListener("click", () => stepMin(30));
    $("ckPrev").addEventListener("click", () => { S.ckMonth = shiftMonth(S.ckMonth, -1); fillCheckin(false); });
    $("ckNext").addEventListener("click", () => { S.ckMonth = shiftMonth(S.ckMonth, 1); fillCheckin(false); });
    $("anaCkPrev").addEventListener("click", () => { S.anaCkMonth = shiftMonth(S.anaCkMonth, -1); renderCheckinPanel(); });
    $("anaCkNext").addEventListener("click", () => { S.anaCkMonth = shiftMonth(S.anaCkMonth, 1); renderCheckinPanel(); });

    window.addEventListener("focus", () => { renderChrome(); if (S.tab === "overview") renderOverview(); });
  }

  /* 歡迎導覽 第一次使用 */
  const W = { i: 0, n: 5, goal: 8, resolve: null, replay: false, exam: null };
  function welcomeBoard() {
    const ex = examFromState(W.exam);
    $("wBoardTitle").textContent = "距離" + ex.name + "還有";
    $("wDays").textContent = Math.max(0, dayDiff(ex.start, today()));
  }
  function openWelcome(replay) {
    const el = $("welcome");
    W.replay = !!replay; W.i = 0; W.goal = S.goal;
    W.exam = settingsExamState();
    welcomeBoard();
    $("wName").value = S.nickname;
    renderExamPicker($("wExamPick"), W.exam);
    $("wGoal").textContent = W.goal + " 個學習動作";
    el.hidden = false; el.classList.remove("closing");
    document.body.style.overflow = "hidden";
    if (UI.cube) UI.cube.pause(true);
    requestAnimationFrame(() => { el.classList.add("on"); welcomeGo(0); });
    setTimeout(() => $("welcomeNext").focus({ preventScroll: true }), 300);
    return new Promise((r) => { W.resolve = r; });
  }
  function welcomeGo(i, user) {
    W.i = Math.max(0, Math.min(W.n - 1, i));
    $("welcomeTrack").style.transform = "translateX(" + (-W.i * 100) + "%)";
    all("#welcomeTrack .wslide").forEach((sl, k) => { sl.classList.toggle("cur", k === W.i); sl.setAttribute("aria-hidden", k === W.i ? "false" : "true"); sl.inert = k !== W.i; });
    all("#welcomeDots i").forEach((d, k) => d.classList.toggle("on", k === W.i));
    $("welcomePrev").disabled = W.i === 0;
    $("welcomeNextText").textContent = W.i === W.n - 1 ? "開始使用" : W.i === 0 ? "開始認識" : "下一步";
    if (user) FX.haptic(4);
  }
  async function closeWelcome(save) {
    const el = $("welcome");
    if (save) {
      const name = clean($("wName").value).slice(0, 20);
      S.nickname = name; setCfg("nickname", name);
      applyExamChoice(W.exam, true);
      S.goal = W.goal; setCfg("dailyGoal", W.goal);
    }
    setCfg("onboarded", today());
    el.classList.add("closing");
    setTimeout(() => { el.hidden = true; el.classList.remove("closing", "on"); document.body.style.overflow = ""; if (UI.cube && !overlays.length) UI.cube.pause(false); }, 430);
    renderChrome(); renderOverview(); renderSettings(); nextCheer(false);
    if (save) {
      setTimeout(() => { FX.rain(); FX.haptic([16, 50, 20]); }, 200);
      toast(S.nickname ? "歡迎 " + S.nickname + " 我們一起走完這一段" : "歡迎 我們一起走完這一段", { icon: "i-star", duration: 4200 });
    }
    const r = W.resolve; W.resolve = null; if (r) setTimeout(r, 460);
  }
  function wireWelcome() {
    $("welcomeNext").addEventListener("click", () => { if (W.i < W.n - 1) welcomeGo(W.i + 1, true); else closeWelcome(true); });
    $("welcomePrev").addEventListener("click", () => welcomeGo(W.i - 1, true));
    $("welcomeSkip").addEventListener("click", () => closeWelcome(false));
    $("wGoalMinus").addEventListener("click", () => { W.goal = Math.max(1, W.goal - 1); $("wGoal").textContent = W.goal + " 個學習動作"; FX.haptic(4); });
    $("wGoalPlus").addEventListener("click", () => { W.goal = Math.min(60, W.goal + 1); $("wGoal").textContent = W.goal + " 個學習動作"; FX.haptic(4); });
    mountExamPicker($("wExamPick"), () => W.exam, (st) => { W.exam = st; welcomeBoard(); });
    $("replayWelcome").addEventListener("click", () => openWelcome(true));
    /* 左右滑動切換 */
    const view = $("welcomeView"), track = $("welcomeTrack");
    let st = null;
    view.addEventListener("pointerdown", (e) => {
      if (e.target.closest("input,button,label,output,.exam-pick")) return;
      st = { x: e.clientX, y: e.clientY, t: performance.now(), w: view.clientWidth, drag: false };
    });
    view.addEventListener("pointermove", (e) => {
      if (!st) return;
      const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.drag && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { st.drag = true; track.classList.add("dragging"); try { view.setPointerCapture(e.pointerId); } catch (err) {} }
      if (st.drag) {
        let off = dx; if ((W.i === 0 && dx > 0) || (W.i === W.n - 1 && dx < 0)) off = dx / 3;
        track.style.transform = "translateX(calc(" + (-W.i * 100) + "% + " + off + "px))";
      }
    });
    const end = (e) => {
      if (!st) return;
      const dx = e.clientX - st.x, v = dx / Math.max(1, performance.now() - st.t), was = st.drag;
      st = null; track.classList.remove("dragging");
      if (!was) return;
      if ((dx < -st_threshold() || v < -0.5) && W.i < W.n - 1) welcomeGo(W.i + 1, true);
      else if ((dx > st_threshold() || v > 0.5) && W.i > 0) welcomeGo(W.i - 1, true);
      else welcomeGo(W.i);
    };
    const st_threshold = () => Math.min(90, view.clientWidth * 0.18);
    view.addEventListener("pointerup", end);
    view.addEventListener("pointercancel", end);
  }

  /* 玻璃控制項 */
  function initGlass() {
    if (!window.Glass) return;
    UI.side = Glass.sidebar($("sideNav"));
    UI.tabs = Glass.tabbar($("tabBar"), (go) => setTab(go));
    UI.status = Glass.segmented($("statusSeg"), (i, el) => { S.libStatus = el.dataset.status; S.pageSize = 24; renderLibrary(); });
    UI.level = Glass.segmented($("levelSeg"), (i, el) => { const inp = el.querySelector("input"); if (inp) { inp.checked = true; inp.dispatchEvent(new Event("change", { bubbles: true })); } });
    UI.theme = Glass.segmented($("themeSeg"), (i, el) => { applyTheme(el.dataset.themePick); setCfg("theme", S.theme); });
    UI.ocrLang = Glass.segmented($("ocrLang"), (i, el) => { if (OCR.running) return; OCR.lang = el.dataset.lang; all("#ocrLang .seg-item").forEach((x) => x.classList.toggle("active", x === el)); });
    UI.mode = Glass.segmented($("timerMode"), (i, el) => setMode(el.dataset.mode));
    UI.chance = Glass.segmented($("chanceSeg"), (i, el) => setChance(el.dataset.chance));
    UI.listen = Glass.segmented($("listenSeg"), (i, el) => setListen(el.dataset.listen));
    UI.lens = Glass.magnifier($("lightStage"), $("lightImg"), $("lightLens"), $("lensView"), 2.4);
  }

  async function main() {
    try {
      if (!window.indexedDB) throw new Error("no indexeddb");
      buildGridAll();
      S.db = await openDB();
      await loadAll();
      applyTheme(S.theme);
      initEditor(); initCheckin(); setRadio("subject", firstSubject()); updateLevel(); updateTopics(); updateComplete();
      wire(); wireWelcome(); wireStudy(); initGlass();
      if (window.GoalCube) UI.cube = GoalCube.mount($("cubeStage"), $("cubeCanvas"), { onTap: () => { nextCheer(true); FX.haptic(8); } });
      UI.cube && UI.cube.setDark(document.documentElement.dataset.theme === "dark");
      applyLite(S.lite);
      renderAll();
      const params = new URLSearchParams(location.search);
      const start = params.get("go") || (location.hash || "").slice(1);
      const wantCheckin = start === "checkin";
      const tab = start === "timer" ? "study" : TABS.includes(start) ? start : "overview";
      try { history.replaceState({ tab }, "", location.pathname + "#" + tab); } catch (e) {}
      setTab(tab, { push: false });
      checkAchievements(true);
      const remaining = dayDiff(S.exam.start, today());
      if (!cfg("onboarded", "")) {
        if (!S.questions.length || window.__forceWelcome) await openWelcome(false);
        else setCfg("onboarded", "existing");
      }
      noteExamChange();
      setInterval(() => { if (S.tab === "overview" && !document.hidden) { renderBoardLive(); renderExamRows(); } }, 30000);
      if (tmActive()) { startTicker(); if (tm().run && tmTarget() && tmElapsed() >= tmTarget()) setTimeout(() => tmFinish(true), 900); }
      setTimeout(() => fetchExams(false), 2500);
      scheduleOcrPrefetch();
      await offerDraft();
      if (wantCheckin) whenSettled(openCheckin);
      if (remaining === 100 && cfg("hundredShown", "") !== S.exam.start) {
        setCfg("hundredShown", S.exam.start);
        celebrate({ title: "百日衝刺開始", body: "從今天起 每一天都算數 我們一起走完這一百天", icon: "i-flame", colors: ACH_COLORS[3] });
      }
      if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("sw", e));
    } catch (e) {
      console.error("Learn Angle startup error", e);
      const box = document.createElement("div");
      box.className = "panel"; box.style.cssText = "margin-bottom:16px;border-color:var(--red-line);background:var(--red-soft);color:var(--red-ink)";
      box.textContent = "無法啟動本機錯題資料庫 請確認不是無痕模式並允許網站儲存資料 然後重新整理";
      document.querySelector(".content").prepend(box);
    }
  }
  function buildGridAll() { all("[data-grid]").forEach((el) => buildGrid(el, el.dataset.grid)); }

  main();
})();