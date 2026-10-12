# LearnEasyly — 學測百日智慧錯題本

哲愷的私有學習資料、公開原始碼。純 HTML / CSS / JavaScript，部署於 GitHub Pages，不需要付費 AI API。適合 2027 學測長期追蹤，也可繼續保存到學測後。

## 使用流程

1. 用手機拍照或從相簿選擇題目，可以旋轉圖片。
2. 按「自動轉文字」在本機瀏覽器 OCR 辨識中英文；請人工校對數學公式。
3. 按「複製提問模板」到 ChatGPT 請求詳解、難度與常見錯誤原因。
4. 回網站貼上答案、詳解，設定科目、單元、難度 Lv.1–5 與錯因。
5. 儲存後隔天開始複習；每次重做選「不會／模糊／答對」以安排下一次複習。
6. 在「學習分析」看週趨勢、各科掌握、難題掌握與待加強單元。

## v1.2 優化重點

- **介面**：手機操作按鈕更大，學習卡片、詳解排版、提醒區更易讀。
- **載入**：Tesseract OCR 改成使用時才下載，不會拖慢首頁；LaTeX 公式用需要時才載入的 KaTeX 顯示。
- **照片**：圖片在瀏覽器中縮放與壓縮，新增旋轉功能。
- **草稿保護**：尚未儲存的文字、圖片、分類資訊會暫存到本機，重新開啟時可選擇繼續編輯。
- **大量錯題**：資料庫改為每次先顯示 24 題，按「顯示更多」展開，降低長清單的 DOM 負擔。
- **匯入安全**：備份以「合併」方式匯入，透過單一 IndexedDB 交易執行，不會先刪除既有資料。相同 ID 以備份內容覆蓋。
- **百日保存**：可檢查估計儲存空間，嘗試申請瀏覽器持久化儲存；超過一週沒備份會提醒。
- **PWA**：更新 Service Worker，離線時不再錯把 HTML 當成 JavaScript 或 CSS 傳回。
- **品質檢查**：每次部署前檢查 JavaScript 語法、主要介面元素和 PWA 設定。

## 如何啟用 GitHub Pages

1. 開啟 [Settings → Pages](https://github.com/easylearnfromtw/Learneasyly-/settings/pages)。
2. **Build and deployment → Source** 選擇 **GitHub Actions**。
3. 到 [Actions](https://github.com/easylearnfromtw/Learneasyly-/actions) 確認「Deploy LearnEasyly to GitHub Pages」是否成功。
4. 網站預期網址：https://easylearnfromtw.github.io/Learneasyly-/

如果 GitHub Pages 尚未啟用，程式碼已上傳也不代表網站已公開部署。

## 資料保存與隱私

- 所有錯題、照片、詳解、草稿與複習記錄儲存在**目前裝置／瀏覽器**的 IndexedDB，不會自動同步到其他裝置，也不會寫入 GitHub。
- 本次更新維持既有 IndexedDB 資料庫名稱與 schema，不需要手動清空或遷移舊錯題。
- **不能保證資料保存 100 天不遺失**：清除網站資料、移除應用、手機空間不足或瀏覽器驅逐資料，都可能造成遺失。請每週到「設定與備份」下載含照片的 JSON 檔，另存於可靠的雲端或硬碟。
- 備份匯入目前採合併模式，**同 ID 的資料可能被備份版本覆蓋**；匯入前請先下載目前資料。
- 持久化儲存是否可用、是否授權，取決於瀏覽器；授權仍不能取代備份。
- 初次使用 OCR 需要網路下載 Tesseract 程式與中英文模型。LaTeX 公式排版需要從 CDN 下載 KaTeX；如果網路中斷則仍可閱讀原始文字。
- 請依照片檢查根號、分數、上標、下標、幾何圖、手寫內容；OCR 結果不一定正確。
- 本專案不傳送照片給 ChatGPT。到 ChatGPT 解題時須由你自行貼入文字／上傳照片。

## 進步指標定義

- **重做答對率**：當週評為「答對」的次數 ÷ 當週全部重做次數；不等於學測正式分數。
- **暫時掌握**：同一題連續至少 2 次重做評為「答對」。
- **高難度掌握率**：難度 Lv.4–5 題目當中符合上述暫時掌握條件的比例。
- **每日練習答對率**：必須另外填寫「今天總共做幾題／答對幾題」，避免把錯題本數量誤當作整體練習量。

## 本機開發與檢查

~~~bash
python -m http.server 8000
# 開啟 http://localhost:8000
node --check app.js
node --check sw.js
node scripts/validate.cjs
~~~

技術：HTML、CSS、原生 JavaScript、IndexedDB、Tesseract.js、KaTeX、Service Worker / PWA。

Copyright © 2026 LearnEasyly.
