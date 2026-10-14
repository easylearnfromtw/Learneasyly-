# 稜角 iOS 鎖定畫面計時 — ActivityKit 原生伴隨 App

## 功能範圍

這個資料夾是可建立 iOS 原生容器與 Widget Extension 的原始碼，不是已經可安裝的 IPA，也不是 Safari 網頁功能。

在使用 Xcode 建置並安裝原生版本、且裝置允許 Live Activities 後，網站計時器透過 `window.webkit.messageHandlers.learnAngleLiveActivity` 將開始、暫停、繼續、完成與歸零狀態交給 ActivityKit。WidgetKit 在鎖定畫面和支援的動態島顯示正計時或 25／50 分鐘倒數。即使網頁進入背景，系統時間元件仍能自行更新顯示。

Safari 或「加入主畫面」的 PWA 沒有 ActivityKit JS 權限；網頁版只有「常亮專注畫面」，**鎖定 iPhone 後不會出現原生計時卡片**。請勿把 PWA 推播通知誤認成 Live Activities。

## 建置方式（需要 Mac + Xcode + 有權限簽署的 Apple ID）

1. 在 Mac 安裝 Xcode 及 XcodeGen。進入此資料夾，執行 `xcodegen generate` 建立 `LearnAngle.xcodeproj`。
2. 開啟產生的 Xcode 專案，選擇 `LearnAngle` scheme。設定 Signing & Capabilities 的 Team，將兩個 target 的 bundle identifier 修改成你有權使用的識別碼。
3. 確認主 App 的 Info.plist 包含 `NSSupportsLiveActivities = YES`，Widget Extension Info.plist 的 `NSExtensionPointIdentifier` 為 `com.apple.widgetkit-extension`。
4. 使用 iOS 17 以上的實機建置與安裝（不能用純 GitHub Pages 完成）。
5. 在 iPhone 設定中允許稜角的即時動態，開啟原生 App 的讀書計時，按「開始」。鎖屏後觀察倒數或正計時；暫停、繼續、捨棄、完成則由網站事件同步。
6. 若換裝置、清空網站資料或從 Safari PWA 轉到此原生容器，請先在原 PWA 使用「匯出完整備份」，再在原生版「合併匯入備份」。**WKWebView 與 Safari PWA 的 IndexedDB 不自動共享**。

## 與目前計時器的連接

`app.js` 在真正發生狀態轉換時，才發送以下資料：

```json
{
  "version": 1,
  "event": "start",
  "mode": "25",
  "subject": "數學A",
  "kind": "寫題目",
  "note": "三角函數",
  "running": true,
  "active": true,
  "elapsedMs": 45000,
  "remainingMs": 1455000,
  "issuedAt": 1791974400000
}
```

`event` 支援 `start`、`pause`、`sync`、`finish`、`reset`。
「正計時」用 `countUpAnchor` 系統時間；倒數用 `countDownEnd` 系統時間。頁面或原生容器回到前景時會重新同步狀態。筆記、學習紀錄等仍沿用原本網站的 IndexedDB。

## 已知限制

- **未在 Xcode／iPhone 上實測編譯與 Live Activities 權限**；此目錄提供整合起點，可能需要依 Xcode/SDK 版本調整。
- 原生版本以 WebView 載入 GitHub Pages，並非完整重新撰寫的 iOS App；無法透過純網頁 URL 對現有 PWA 安裝此功能。
- iOS 可能禁止即時動態，或由使用者在系統設定關閉。
- 原生鎖屏倒數會到 00:00，但網站若在背景暫停，完成紀錄與移除即時動態可能要等 App 返回前景同步；如需準時跳通知，需要額外建置原生本地通知功能。
- 目前不支援直接在鎖屏卡片操作暫停／完成，請打開 App 進行。
- 不會透過虛假靜音音訊佔用「正在播放」播放器，也不會假裝 PWA 已擁有動態島權限。

## 主要原始碼

- `LearnAngleApp.swift` — 主 App、WKWebView 與網頁事件同步。
- `LiveActivityBridge.swift` — JS 事件到 ActivityKit 的請求／更新／終止。
- `StudyActivityAttributes.swift` — 跨主 App 與 Widget Extension 的共用資料。
- `StudyActivityWidget.swift` — 鎖定畫面、Dynamic Island 版面。
- `project.yml` — XcodeGen 的雙 target 設定。
