/* LearnEasyly — privacy-first browser-based GSAT mistake notebook. No external user-data API. */
(function () {
  "use strict";
  const DB_NAME = "learneasyly-local-v1";
  const DB_VERSION = 1;
  const DEFAULT_DATE = "2027-01-22";
  const S = { db: null, questions: [], reviews: [], daily: [], examDate: DEFAULT_DATE, image: "", editing: null, reviewing: null, revealed: false, tab: "overview", pageSize: 24 };
  const $ = (id) => document.getElementById(id);
  const all = (selector) => Array.from(document.querySelectorAll(selector));
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (x) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
  const safeImage = (s) => typeof s === "string" && /^data:image\/(png|jpeg|webp);base64,/i.test(s) ? s : "";
  const pad = (n) => String(n).padStart(2, "0");
  const localDate = (d) => { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()); };
  const parseDate = (s) => { const n = String(s || "").split("-").map(Number); return new Date(n[0], (n[1] || 1) - 1, n[2] || 1); };
  const plusDays = (iso, n) => { const d = parseDate(iso); d.setDate(d.getDate()+n); return localDate(d); };
  const dayDiff = (a,b) => Math.round((parseDate(a)-parseDate(b))/86400000);
  const dateLabel = (s) => s ? String(s).replaceAll("-", "/") : "—";
  const inPastDays = (s, n) => Boolean(s) && dayDiff(localDate(),String(s).slice(0,10)) >= 0 && dayDiff(localDate(),String(s).slice(0,10)) < n;
  const stamp = () => new Date().toISOString();
  const truncate = (s,n) => { s = String(s || "").replace(/\s+/g," ").trim(); return s.length>n ? s.slice(0,n)+"…" : s; };
  let toastTimer;
  let draftTimer = null;
  let ocrLoading = null;
  function toast(message) { const node = $("toast"); node.textContent=message; node.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>node.classList.remove("show"),3200); }
  function status(id,message,isError) { $(id).textContent=message; $(id).classList.toggle("error",!!isError); }
  function openDB() {
    return new Promise((resolve,reject)=>{
      const request = indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded = () => { const db=request.result; ["questions","reviews","daily","config"].forEach((name)=>{ if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:name==="config"?"key":"id"}); }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function dbRequest(store,method,value) { return new Promise((resolve,reject)=>{ const tx=S.db.transaction(store,"readwrite"); const req=tx.objectStore(store)[method](value); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); tx.onerror=()=>reject(tx.error); }); }
  function dbAll(store) { return new Promise((resolve,reject)=>{ const req=S.db.transaction(store,"readonly").objectStore(store).getAll(); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); }
  async function refresh() {
    [S.questions,S.reviews,S.daily]=await Promise.all([dbAll("questions"),dbAll("reviews"),dbAll("daily")]);
    const settings=await dbAll("config");
    S.examDate=(settings.find(x=>x.key==="examDate")||{value:DEFAULT_DATE}).value;
    renderAll();
  }
  function dueItems() {return S.questions.filter(x=>(x.dueDate||x.createdDate||localDate())<=localDate()).sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)) || (b.difficulty||3)-(a.difficulty||3));}
  function isMastered(x){return (x.streak||0)>=2;}
  function setTab(tab){
    if (!["overview","add","library","review","analytics","settings"].includes(tab))return;
    S.tab=tab;
    all(".page").forEach(x=>x.classList.toggle("active",x.id==="page-"+tab));
    all("[data-go]").forEach(x=>{x.classList.toggle("active",x.dataset.go===tab);if(x.classList.contains("active")&&x.classList.contains("nav-item"))x.setAttribute("aria-current","page");else x.removeAttribute("aria-current");});
    const labels={overview:"總覽",add:"新增錯題",library:"錯題資料庫",review:"今日複習",analytics:"學習分析",settings:"設定與備份"};
    $("pageCrumb").textContent=labels[tab]; window.scrollTo({top:0,behavior:"instant"});
    if(tab==="review"){S.reviewing=null;S.revealed=false;renderReview();}
    if(tab==="library")renderLibrary();
    if(tab==="analytics")renderAnalytics();
    if(tab==="settings")storageStatus();
  }
  function renderOverview() {
    const remaining=Math.max(0,dayDiff(S.examDate,localDate()));
    $("countDays").textContent=remaining;
    $("examDisplay").textContent=dateLabel(S.examDate);
    $("statTotal").textContent=S.questions.length;
    const due=dueItems().length; $("statDue").textContent=due; $("navDue").textContent=due;
    $("statMastery").textContent=S.questions.length ? Math.round(S.questions.filter(isMastered).length/S.questions.length*100)+"%" : "—";
    $("statReviews").textContent=S.reviews.length;
    $("focusText").textContent=due ? "還有 "+due+" 題已到複習時間。先獨立思考，再核對詳解。" : "今天沒有到期題目。收錄新錯題或回顧自己的弱點單元。";
    $("todayText").textContent=new Intl.DateTimeFormat("zh-TW",{month:"long",day:"numeric",weekday:"short"}).format(new Date());
    let max=1, counts=[];
    for(let i=6;i>=0;i--){const d=plusDays(localDate(),-i),a=S.questions.filter(q=>q.createdDate===d).length,b=S.reviews.filter(r=>r.date===d).length;counts.push({d,a,b});max=Math.max(max,a,b);}
    $("overviewChart").innerHTML=counts.map(c=>'<div class="activity-day"><div class="bar-pair"><div class="activity-bar dark" style="height:'+Math.max(3,c.a/max*100)+'%" title="新增 '+c.a+' 題"></div><div class="activity-bar green" style="height:'+Math.max(3,c.b/max*100)+'%" title="複習 '+c.b+' 次"></div></div><label>'+pad(parseDate(c.d).getMonth()+1)+'/'+pad(parseDate(c.d).getDate())+'</label></div>').join("");
    const recent=S.questions.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,4);
    $("recentList").innerHTML=recent.length ? recent.map(q=>'<button class="recent-item" data-action="view" data-id="'+esc(q.id)+'"><span class="recent-bubble">'+esc((q.subject||"題").slice(0,2))+'</span><span class="recent-content"><strong>'+esc(truncate(q.question||q.topic||"圖片題",42))+'</strong><small>'+esc(q.subject)+' · '+esc(q.topic||"未分類")+' · '+esc(dateLabel(q.createdDate))+'</small></span><span class="recent-arrow">↗</span></button>').join("") : '<div class="empty"><strong>尚未收錄錯題</strong><span>點右上角「新增錯題」，從第一題開始。</span></div>';
    const row=S.daily.find(d=>d.id===localDate());
    $("dailyTotal").value=row?row.total:0; $("dailyCorrect").value=row?row.correct:0;
    const lastBackup=localStorage.getItem("learneasyly-last-backup"); const days=lastBackup?dayDiff(localDate(),lastBackup):999;
    $("backupState").textContent=days>6?"目前沒有最近 7 天的備份紀錄。建議立即匯出一份完整備份並存到安全的位置。":"最近備份："+dateLabel(lastBackup)+"。建議每週備份一次，避免本機資料意外遺失。";
  }
  function renderLibrary() {
    const query=$("searchInput").value.toLowerCase().trim(),subject=$("subjectFilter").value,sort=$("sortFilter").value;
    const options=[...new Set(S.questions.map(q=>q.subject))].sort();
    $("subjectFilter").innerHTML='<option value="">全部科目</option>'+options.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join("");
    $("subjectFilter").value=options.includes(subject)?subject:"";
    let list=S.questions.filter(q=>(!subject||q.subject===subject)&&(!query||[q.question,q.topic,q.solution,q.source,q.answer].some(x=>String(x||"").toLowerCase().includes(query))));
    if(sort==="hard")list.sort((a,b)=>(b.difficulty||0)-(a.difficulty||0));
    else if(sort==="due")list.sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));
    else list.sort((a,b)=>sort==="old"?String(a.createdAt).localeCompare(String(b.createdAt)):String(b.createdAt).localeCompare(String(a.createdAt)));
    const visible=list.slice(0,S.pageSize);
    $("libraryList").innerHTML=visible.length?visible.map(q=>'<div class="question-row">'+(safeImage(q.image)?'<img class="question-image" loading="lazy" src="'+safeImage(q.image)+'" alt="錯題照片">':'<div class="question-fallback">'+esc((q.subject||"題").slice(0,2))+'</div>')+'<div class="question-center"><div class="question-pills"><span class="chip">'+esc(q.subject)+'</span><span class="chip light">Lv.'+esc(q.difficulty||3)+'</span>'+(isMastered(q)?'<span class="chip">已掌握</span>':(q.dueDate<=localDate()?'<span class="chip warn">待複習</span>':""))+'</div><h3>'+esc(truncate(q.question||q.topic||"圖片題",105))+'</h3><p>'+esc(q.topic||"未分類")+' · '+esc(dateLabel(q.createdDate))+' · 下次複習 '+esc(dateLabel(q.dueDate))+'</p></div><div class="question-actions"><button class="mini-btn" data-action="view" data-id="'+esc(q.id)+'">查看</button><button class="mini-btn" data-action="edit" data-id="'+esc(q.id)+'">編輯</button><button class="mini-btn danger" data-action="delete" data-id="'+esc(q.id)+'">刪除</button></div></div>').join("")+(list.length>visible.length?'<div class="load-more-wrap"><button class="btn btn-outline" id="loadMoreQuestions">顯示更多 · 還有 '+(list.length-visible.length)+' 題 ↓</button></div>':''):'<div class="empty"><strong>沒有找到符合條件的錯題</strong><span>調整搜尋條件，或先新增一題。</span></div>';
    const more=$("loadMoreQuestions");if(more)more.addEventListener("click",()=>{S.pageSize+=24;renderLibrary();});
  }
    function renderReview(){
    const due=dueItems();
    $("reviewRemaining").textContent=due.length;
    $("reviewCompleted").textContent=S.reviews.filter(r=>r.date===localDate()).length;
    if(!due.length){$("reviewArea").innerHTML='<div class="panel empty"><strong>今天的複習已完成 ✳</strong><span>暫時沒有到期題目。新錯題預設隔天開始重做。</span></div>';return;}
    let q=due.find(x=>x.id===S.reviewing)||due[0];S.reviewing=q.id;
    $("reviewArea").innerHTML='<article class="review-card"><div class="review-stage"><div class="question-pills"><span class="chip">'+esc(q.subject)+'</span><span class="chip light">'+esc(q.topic||"未分類")+'</span><span class="chip warn">Lv.'+esc(q.difficulty||3)+'</span></div><span class="muted">第 '+((q.reviewCount||0)+1)+' 次重做</span></div>'+(safeImage(q.image)?'<img class="review-image" src="'+safeImage(q.image)+'" alt="題目照片">':"")+'<div class="review-question">'+esc(q.question||"請依照上方照片自行作答。")+'</div>'+(S.revealed?'<div class="review-answer"><strong>答案</strong><p>'+esc(q.answer||"未填寫答案")+'</p><strong style="margin-top:15px">完整詳解</strong><p>'+esc(q.solution||"尚未提供詳解")+'</p>'+(q.reflection?'<strong style="margin-top:15px">當時的提醒</strong><p>'+esc(q.reflection)+'</p>':"")+'</div><div class="review-controls"><button class="btn btn-danger" data-review="again">不會｜明天再做</button><button class="btn btn-outline" data-review="hard">模糊｜2 天後</button><button class="btn btn-dark" data-review="good">答對｜間隔延長</button></div>':'<div class="review-controls"><button class="btn btn-dark" data-review="reveal">我已經試著作答，查看詳解 ↗</button></div>')+'<p class="review-hint">重做結果會用於評估掌握度與每週進步；請不要先看答案。</p></article>';
  }
  function monday(iso){const d=parseDate(iso),k=(d.getDay()+6)%7;d.setDate(d.getDate()-k);return localDate(d);}
  function renderAnalytics(){
    const last7=S.reviews.filter(r=>inPastDays(r.date,7)),good7=last7.filter(r=>r.rating==="good").length;
    $("anaAdded").textContent=S.questions.filter(q=>inPastDays(q.createdDate,7)).length;
    $("anaReviewed").textContent=last7.length;
    $("anaAccuracy").textContent=last7.length?Math.round(good7/last7.length*100)+"%":"—";
    $("anaAccuracySample").textContent=last7.length?"共 "+last7.length+" 次複習":"尚無樣本";
    const hard=S.questions.filter(q=>(q.difficulty||3)>=4);
    $("anaHard").textContent=hard.length?Math.round(hard.filter(isMastered).length/hard.length*100)+"%":"—";
    let weeks=[];
    for(let i=7;i>=0;i--){const start=plusDays(monday(localDate()),-7*i),log=S.reviews.filter(r=>monday(r.date)===start),correct=log.filter(r=>r.rating==="good").length;weeks.push({start,n:log.length,rate:log.length?Math.round(correct/log.length*100):0});}
    $("weekAccuracy").innerHTML=weeks.map((w,i)=>'<div class="week-column"><b>'+(w.n?w.rate+"%":"—")+'</b><div title="'+w.n+' 次複習" style="height:'+(w.n?Math.max(4,w.rate):0)+'%"></div><span>W'+(i+1)+'</span></div>').join("");
    const names=[...new Set(S.questions.map(q=>q.subject))];
    $("subjectProgress").innerHTML=names.length?names.map(n=>{const arr=S.questions.filter(q=>q.subject===n), mastered=arr.filter(isMastered).length,p=Math.round(mastered/arr.length*100);return '<div class="analysis-row"><div class="analysis-row-head"><span>'+esc(n)+' · '+arr.length+' 題</span><strong>掌握 '+p+'%</strong></div><div class="progress-track"><div class="progress-fill" style="width:'+p+'%"></div></div></div>';}).join(""):'<div class="empty">新增錯題後，這裡會出現科目分析。</div>';
    const reasons={};S.questions.forEach(q=>{const k=q.reason||"其他";reasons[k]=(reasons[k]||0)+1;});
    $("errorReasons").innerHTML=Object.entries(reasons).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<div class="analysis-list-item"><span>'+esc(k)+'</span><b>'+v+' 題</b></div>').join("")||'<div class="empty">目前沒有錯誤原因紀錄。</div>';
    const groups={};S.questions.filter(q=>!isMastered(q)).forEach(q=>{const k=(q.subject||"其他")+" · "+(q.topic||"未分類");groups[k]=(groups[k]||0)+1;});
    $("weakTopics").innerHTML=Object.entries(groups).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([k,v])=>'<div class="analysis-list-item"><span>'+esc(k)+'</span><b>'+v+' 題未掌握</b></div>').join("")||'<div class="empty">尚無待加強單元，或已完成全部錯題。</div>';
    $("dailyAnalysis").innerHTML=S.daily.length?S.daily.slice().sort((a,b)=>String(b.id).localeCompare(String(a.id))).slice(0,14).map(d=>'<div class="analysis-list-item"><span>'+esc(dateLabel(d.id))+'</span><span>'+d.correct+'/'+d.total+' 題 <b>· '+(d.total?Math.round(d.correct/d.total*100)+"%":"無樣本")+'</b></span></div>').join(""):'<div class="empty">在首頁填寫每天的總做題數與答對題數。</div>';
  }
  function renderAll(){renderOverview();renderLibrary();renderReview();renderAnalytics();$("examDate").value=S.examDate;}
  function editorSnapshot(){
    return {editing:S.editing,image:safeImage(S.image),question:$("questionText").value,answer:$("answerText").value,solution:$("solutionText").value,
      reflection:$("reflectionText").value,subject:$("subjectField").value,topic:$("topicField").value,source:$("sourceField").value,
      difficulty:Number(document.querySelector('input[name="difficulty"]:checked').value),reason:$("reasonField").value};
  }
  function scheduleDraft(){
    clearTimeout(draftTimer);
    draftTimer=setTimeout(()=>{dbRequest("config","put",{key:"editorDraft",value:editorSnapshot(),updatedAt:stamp()}).catch(e=>console.warn("draft not saved",e));},750);
  }
  async function offerDraft(){
    const config=await dbAll("config"),saved=config.find(x=>x.key==="editorDraft");
    if(!saved||!saved.value)return;
    const d=saved.value;
    if(!d.question&&!d.solution&&!d.image&&!d.answer&&!d.topic)return;
    if(!confirm("找到上次未儲存的錯題草稿，要繼續編輯嗎？")){await dbRequest("config","delete","editorDraft");return;}
    S.editing=d.editing||null;S.image=safeImage(d.image);previewImage();
    $("questionText").value=d.question||"";$("answerText").value=d.answer||"";$("solutionText").value=d.solution||"";
    $("reflectionText").value=d.reflection||"";$("subjectField").value=d.subject||"數學 A";$("topicField").value=d.topic||"";
    $("sourceField").value=d.source||"";$("reasonField").value=d.reason||"觀念不清";
    const radio=document.querySelector('input[name="difficulty"][value="'+(Number(d.difficulty)||3)+'"]');if(radio)radio.checked=true;
    if(S.editing){$("editorHeading").textContent="繼續編輯錯題.";$("saveBtn").textContent="儲存修改 ↗";}
    setTab("add");toast("已還原未儲存的草稿");
  }
  function resetEditor(){
    clearTimeout(draftTimer);
    if(S.db)dbRequest("config","delete","editorDraft").catch(()=>{});
    $("questionForm").reset();S.image="";S.editing=null;$("photoPreview").hidden=true;$("photoPreview").removeAttribute("src");$("photoEmpty").hidden=false;$("editorHeading").textContent="新增一筆錯題.";$("saveBtn").textContent="儲存這道錯題 ↗";status("ocrStatus","OCR 需要網路載入辨識模型；數學公式與圖表請自行校對。");status("saveStatus","");
    $("galleryInput").value="";$("cameraInput").value="";
  }
  function previewImage(){const im=$("photoPreview");im.hidden=!S.image;$("photoEmpty").hidden=!!S.image;if(S.image)im.src=S.image;else im.removeAttribute("src");}
  function processedImage(img,rotation=0) {
    const edge=1450,scale=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight));
    const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
    const canvas=document.createElement("canvas");
    canvas.width=rotation%180?h:w;canvas.height=rotation%180?w:h;
    const ctx=canvas.getContext("2d");ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(img,-w/2,-h/2,w,h);
    let image=canvas.toDataURL("image/jpeg",.78);
    for(const quality of [.68,.58,.48]){if(image.length<=650000)break;image=canvas.toDataURL("image/jpeg",quality);}
    return image;
  }
  async function loadPhoto(file){
    if(!file)return;
    if(!file.type.startsWith("image/")){toast("請選擇圖片檔");return;}
    if(file.size>25*1024*1024){toast("圖片太大，請選擇小於 25 MB 的圖片");return;}
    status("ocrStatus","正在處理圖片……");
    let url;
    try {
      url=URL.createObjectURL(file);const img=new Image();
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error("無法解碼圖片，請改用 JPG 或 PNG"));img.src=url;});
      S.image=processedImage(img);previewImage();scheduleDraft();
      status("ocrStatus","圖片已壓縮並加入錯題。可點「自動轉文字」辨識。");
    }catch(e){status("ocrStatus",e.message||"照片讀取失敗",true);}
    finally{if(url)URL.revokeObjectURL(url);}
  }
  async function rotatePhoto(){
    if(!S.image){toast("請先上傳圖片");return;}
    const img=new Image();
    try {await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error("無法旋轉照片"));img.src=S.image;});S.image=processedImage(img,90);previewImage();scheduleDraft();toast("照片已順時針旋轉 90°");}
    catch(e){toast(e.message);}
  }
  async function ensureOCR(){
    if(window.Tesseract)return;
    if(!ocrLoading)ocrLoading=new Promise((resolve,reject)=>{
      const tag=document.createElement("script");tag.src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      tag.onload=()=>window.Tesseract?resolve():reject(Error("OCR 函式庫載入失敗"));
      tag.onerror=()=>reject(Error("無法下載 OCR 程式，請檢查網路"));
      document.head.appendChild(tag);
    }).catch(e=>{ocrLoading=null;throw e;});
    return ocrLoading;
  }
  async function ocrPhoto(){
    if(!S.image){toast("請先上傳圖片");return;}
    const btn=$("runOcr");btn.disabled=true;let worker;
    try {
      status("ocrStatus","正在準備文字辨識模型（初次使用需網路）……");
      await ensureOCR();
      worker=await Tesseract.createWorker("eng+chi_tra",1,{logger:m=>{if(m.status==="recognizing text")status("ocrStatus","正在辨識文字："+Math.round((m.progress||0)*100)+"%");}});
      const result=await worker.recognize(S.image),recognized=(result.data.text||"").trim();
      if(!recognized){status("ocrStatus","沒有辨識到文字。請用更清晰的照片，或手動輸入。",true);return;}
      const current=$("questionText").value.trim();
      if(current&&!confirm("目前已填寫題目文字，確定要以 OCR 結果覆蓋嗎？"))return;
      $("questionText").value=recognized;scheduleDraft();
      status("ocrStatus","辨識完成。請校對分數、上下標與幾何圖形。");
    }catch(e){console.error(e);status("ocrStatus","OCR 失敗："+(e.message||"請確認網路、記憶體後重試"),true);}
    finally{if(worker)try{await worker.terminate();}catch(e){}btn.disabled=false;}
  }
  async function copyGPTPrompt(){
    const q=$("questionText").value.trim();
    const prompt="請依照台灣高中學測程度分析這道題目。如果資訊不足請提醒我補上照片，不要自行補猜。請提供：①正確答案 ②逐步詳解 ③核心觀念與常見錯因 ④難度等級 Lv.1–5 與理由 ⑤一個下次遇到類似題目可套用的解題提示。請用清晰的繁體中文回覆。\n\n題目：\n"+(q||"（我會另外附上原始題目照片）");
    try{await navigator.clipboard.writeText(prompt);toast("提問模板已複製，可到 ChatGPT 貼上並附題目照片");}
    catch(e){toast("複製失敗，請檢查剪貼簿權限");}
  }
  async function storageStatus(){
    const node=$("storageState");if(!node)return;
    if(!navigator.storage||!navigator.storage.estimate){node.textContent="目前瀏覽器無法回報可用容量，請持續每週備份。";return;}
    try{const [estimate,persisted]=await Promise.all([navigator.storage.estimate(),typeof navigator.storage.persisted==="function"?navigator.storage.persisted():Promise.resolve(false)]);
      const mb=n=>(Number(n||0)/1048576).toFixed(1);
      node.textContent="本網站估計佔用 "+mb(estimate.usage)+" MB／瀏覽器配額 "+mb(estimate.quota)+" MB。持久化儲存："+(persisted?"已授予":"尚未授予或不支援")+"。仍需定期備份。";
    }catch(e){node.textContent="無法取得儲存空間狀態；資料仍建議每週備份。";}
  }
  async function requestPersist(){
    if(!navigator.storage||!navigator.storage.persist){toast("此瀏覽器不支援持久化儲存申請");return;}
    try{const ok=await navigator.storage.persist();toast(ok?"已獲得持久化儲存權限":"瀏覽器未授予持久化權限，請持續備份");await storageStatus();}
    catch(e){toast("目前無法申請持久化儲存");}
  }
    async function saveQuestion(ev){
    ev.preventDefault();
    const question=$("questionText").value.trim(),topic=$("topicField").value.trim();
    if(!question&&!S.image){toast("至少需有題目文字或圖片");return;}
    const previous=S.questions.find(q=>q.id===S.editing);
    const q=Object.assign({},previous||{},{
      id:previous?previous.id:uid(),createdAt:previous?previous.createdAt:stamp(),createdDate:previous?previous.createdDate:localDate(),
      updatedAt:stamp(),image:safeImage(S.image),question,answer:$("answerText").value.trim(),solution:$("solutionText").value.trim(),reflection:$("reflectionText").value.trim(),
      subject:$("subjectField").value,topic,source:$("sourceField").value.trim(),
      difficulty:Number(document.querySelector('input[name="difficulty"]:checked').value),
      reason:$("reasonField").value,
      dueDate:previous?previous.dueDate:plusDays(localDate(),1),streak:previous?(previous.streak||0):0,reviewCount:previous?(previous.reviewCount||0):0
    });
    const btn=$("saveBtn");btn.disabled=true;
    try{await dbRequest("questions","put",q);await refresh();resetEditor();toast(previous?"錯題已更新":"錯題已收錄，明天開始複習");setTab("library");}
    catch(e){console.error(e);status("saveStatus","儲存失敗：可能是瀏覽器空間不足。請先備份並釋出空間。",true);}
    finally{btn.disabled=false;}
  }
  function editQuestion(q){
    resetEditor();S.editing=q.id;S.image=safeImage(q.image);previewImage();
    $("questionText").value=q.question||"";$("answerText").value=q.answer||"";$("solutionText").value=q.solution||"";$("reflectionText").value=q.reflection||"";
    $("subjectField").value=q.subject||"數學 A";$("topicField").value=q.topic||"";$("sourceField").value=q.source||"";$("reasonField").value=q.reason||"觀念不清";
    const rad=document.querySelector('input[name="difficulty"][value="'+(q.difficulty||3)+'"]');if(rad)rad.checked=true;
    $("editorHeading").textContent="編輯這道錯題.";$("saveBtn").textContent="儲存修改 ↗";setTab("add");
  }
  function viewQuestion(q){
    $("modalBody").innerHTML='<div class="question-pills"><span class="chip">'+esc(q.subject)+'</span><span class="chip light">'+esc(q.topic||"未分類")+'</span><span class="chip warn">Lv.'+esc(q.difficulty||3)+'</span></div>'+
      (safeImage(q.image)?'<img class="modal-image" alt="原始錯題照片" src="'+safeImage(q.image)+'">':"")+
      [['題目',q.question||"以原照片為準"],['答案',q.answer||"尚未填寫"],['GPT 詳解',q.solution||"尚未填寫"],['自己的補充',q.reflection],['題目來源',q.source],['錯誤原因',q.reason],['下次複習',dateLabel(q.dueDate)]].filter(x=>x[1]).map(x=>'<div class="modal-body-section"><h3>'+esc(x[0])+'</h3><p>'+esc(x[1])+'</p></div>').join("")+
      '<button class="btn btn-dark" data-action="edit" data-id="'+esc(q.id)+'">編輯這道題 ↗</button>';
    $("detailModal").hidden=false;document.body.style.overflow="hidden";
  }
  function closeModal(){$("detailModal").hidden=true;document.body.style.overflow="";}
  async function handleAction(button){
    const q=S.questions.find(x=>x.id===button.dataset.id);if(!q)return;
    if(button.dataset.action==="view")viewQuestion(q);
    else if(button.dataset.action==="edit"){closeModal();editQuestion(q);}
    else if(button.dataset.action==="delete"){
      if(!confirm("確定刪除此題與其複習紀錄嗎？此操作不可復原。"))return;
      await dbRequest("questions","delete",q.id);
      for(const r of S.reviews.filter(x=>x.questionId===q.id))await dbRequest("reviews","delete",r.id);
      await refresh();toast("錯題已刪除");
    }
  }
  async function reviewRating(rating){
    if(rating==="reveal"){S.revealed=true;renderReview();return;}
    const q=S.questions.find(x=>x.id===S.reviewing);if(!q||!S.revealed)return;
    const good=rating==="good",streak=good?(q.streak||0)+1:0;
    const intervals=[3,7,14,30,60,90];
    const interval=rating==="again"?1:rating==="hard"?2:intervals[Math.min(Math.max(0,streak-1),intervals.length-1)];
    const next=Object.assign({},q,{dueDate:plusDays(localDate(),interval),streak,reviewCount:(q.reviewCount||0)+1,updatedAt:stamp()});
    const log={id:uid(),questionId:q.id,subject:q.subject,topic:q.topic,date:localDate(),createdAt:stamp(),rating,difficulty:q.difficulty||3};
    try{await dbRequest("questions","put",next);await dbRequest("reviews","put",log);S.reviewing=null;S.revealed=false;await refresh();toast("已記錄，"+interval+" 天後再次複習");}
    catch(e){console.error(e);toast("無法記錄複習，請檢查儲存空間");}
  }
  async function saveDaily(ev){
    ev.preventDefault();const total=Number($("dailyTotal").value),correct=Number($("dailyCorrect").value);
    if(!Number.isInteger(total)||!Number.isInteger(correct)||total<0||correct<0||correct>total){toast("請確認答對數不大於總做題數");return;}
    await dbRequest("daily","put",{id:localDate(),total,correct,updatedAt:stamp()});await refresh();toast("今日練習已記錄");
  }
  function exportBackup(){
    const data={format:"learneasyly-backup",version:1,exportedAt:stamp(),examDate:S.examDate,questions:S.questions,reviews:S.reviews,daily:S.daily};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="learneasyly-backup-"+localDate()+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
    localStorage.setItem("learneasyly-last-backup",localDate());renderOverview();toast("備份檔已開始下載，請另存到安全的位置");
  }
  async function importBackup(file){
    if(!file)return;
    try{
      if(file.size>200*1024*1024)throw Error("備份檔超過 200 MB，請先確認內容。");
      const data=JSON.parse(await file.text());
      if(!data||data.format!=="learneasyly-backup"||!Array.isArray(data.questions)||!Array.isArray(data.reviews)||!Array.isArray(data.daily))throw Error("不是有效的 LearnEasyly 備份檔。");
      const ids=[["questions",data.questions],["reviews",data.reviews],["daily",data.daily]];
      for(const [name,items] of ids){if(items.length>50000)throw Error(name+" 筆數超過合理上限。");
        for(const item of items){if(!item||typeof item!=="object"||typeof item.id!=="string"||item.id.length>150)throw Error(name+" 資料格式有誤。");}
      }
      if(!confirm("將把備份合併到目前錯題本；若相同題目 ID 已存在，會以備份版本覆蓋。建議先匯出目前備份。繼續嗎？"))return;
      const tx=S.db.transaction(["questions","reviews","daily","config"],"readwrite");
      const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error("還原交易已取消"));tx.onerror=()=>reject(tx.error||Error("還原失敗"));});
      for(const q of data.questions)tx.objectStore("questions").put({...q,image:safeImage(q.image)});
      for(const r of data.reviews)tx.objectStore("reviews").put(r);
      for(const d of data.daily)tx.objectStore("daily").put(d);
      if(/^\d{4}-\d{2}-\d{2}$/.test(data.examDate||""))tx.objectStore("config").put({key:"examDate",value:data.examDate});
      await done;
      await refresh();toast("備份已安全合併，原有其他資料保留");await storageStatus();
    }catch(e){console.error(e);toast(e.message||"備份匯入失敗，原資料未被預先清除");}
    finally{$("importFile").value="";}
  }
    function wire(){
    document.addEventListener("click",async (ev)=>{
      const nav=ev.target.closest("[data-go]");if(nav){ev.preventDefault();setTab(nav.dataset.go);return;}
      const action=ev.target.closest("[data-action]");if(action){await handleAction(action);return;}
      const review=ev.target.closest("[data-review]");if(review){review.disabled=true;try{await reviewRating(review.dataset.review);}finally{review.disabled=false;}return;}
      if(ev.target.closest("[data-close]"))closeModal();
    });
    $("modalClose").addEventListener("click",closeModal);
    document.addEventListener("keydown",(e)=>{if(e.key==="Escape")closeModal();});
    $("choosePhoto").addEventListener("click",()=>$("galleryInput").click());
    $("takePhoto").addEventListener("click",()=>$("cameraInput").click());
    $("galleryInput").addEventListener("change",e=>loadPhoto(e.target.files[0]));
    $("cameraInput").addEventListener("change",e=>loadPhoto(e.target.files[0]));
    $("removePhoto").addEventListener("click",()=>{S.image="";previewImage();scheduleDraft();status("ocrStatus","已移除圖片。");});
    $("runOcr").addEventListener("click",ocrPhoto);
    $("rotatePhoto").addEventListener("click",rotatePhoto);
    $("copyGPT").addEventListener("click",copyGPTPrompt);
    $("requestPersist").addEventListener("click",requestPersist);
    ["questionText","answerText","solutionText","reflectionText","subjectField","topicField","sourceField","reasonField"].forEach(name=>$(name).addEventListener("input",scheduleDraft));
    all('input[name="difficulty"]').forEach(node=>node.addEventListener("change",scheduleDraft));
    $("questionForm").addEventListener("submit",saveQuestion);
    $("cancelEdit").addEventListener("click",resetEditor);
    ["searchInput","subjectFilter","sortFilter"].forEach(id=>$(id).addEventListener(id==="searchInput"?"input":"change",()=>{S.pageSize=24;renderLibrary();}));
    $("dailyForm").addEventListener("submit",saveDaily);
    $("settingsForm").addEventListener("submit",async e=>{e.preventDefault();const value=$("examDate").value;if(!/^\d{4}-\d{2}-\d{2}$/.test(value)){toast("請選擇有效日期");return;}await dbRequest("config","put",{key:"examDate",value});await refresh();toast("目標日期已更新");});
    $("exportBackup").addEventListener("click",exportBackup);
    $("importBackup").addEventListener("click",()=>$("importFile").click());
    $("importFile").addEventListener("change",e=>importBackup(e.target.files[0]));
    $("eraseAll").addEventListener("click",async ()=>{
      if(!confirm("即將永久清除本裝置所有錯題、照片、複習紀錄與設定。確定嗎？"))return;
      if(!confirm("第二次確認：資料無法復原。你已經下載備份了嗎？"))return;
      for(const k of ["questions","reviews","daily","config"])await dbRequest(k,"clear");
      localStorage.removeItem("learneasyly-last-backup");resetEditor();await refresh();setTab("overview");toast("本機資料已清除");
    });
  }
  async function main(){
    try{
      if(!window.indexedDB)throw Error("此瀏覽器不支援 IndexedDB。");
      S.db=await openDB();wire();await refresh();await offerDraft();
      if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(e=>console.warn("SW not available",e));
    }catch(e){
      console.error("LearnEasyly startup error",e);
      const error=document.createElement("div");error.style.cssText="padding:24px;margin:20px;border-radius:12px;background:#ffefe8;color:#8b4333;";
      error.textContent="無法啟動本機錯題資料庫。請確認不是無痕模式、允許網站儲存資料，並重新整理。錯誤："+(e.message||"未知錯誤");
      document.querySelector(".content").prepend(error);
    }
  }
  main();
})();