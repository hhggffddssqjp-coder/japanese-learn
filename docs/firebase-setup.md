# 啟用雲端同步（Firebase，免費、約 10 分鐘）

啟用後，可以用 Google 帳號登入，進度會自動在手機、電腦之間同步。不啟用也能正常使用（進度只存在該瀏覽器）。

Firebase 的免費方案（Spark）足夠個人使用，不需要綁信用卡。

## 步驟

1. 開啟 <https://console.firebase.google.com>，用 Google 帳號登入，按 **建立專案**（名稱隨意，例如 `nihongo`）。Google Analytics 可以關閉。
2. 進入專案後，點首頁的 **網頁圖示 `</>`**（新增網頁應用程式），取個暱稱（例如 `web`），**不要**勾選 Firebase Hosting，按 **註冊應用程式**。
3. 畫面上會出現一段 `firebaseConfig`，裡面有 `apiKey`、`authDomain`、`projectId`、`appId`。先留著這個畫面（之後也可以在 專案設定 → 一般 → 你的應用程式 找到）。
4. 左側 **建置 → Authentication → 開始使用 → 登入方式**，選 **Google** → 啟用 → 填「專案公開名稱」與「支援電子郵件」→ 儲存。
5. 同一頁切到 **設定 → 授權網域 → 新增網域**，加入你的網站網域，例如 `hhggffddssqjp-coder.github.io`（`localhost` 預設已有）。**沒做這步，登入會顯示「授權網域」錯誤。**
6. 左側 **建置 → Firestore Database → 建立資料庫**：位置可選 `asia-east1`（台灣），模式選 **正式版模式**，按 **啟用**。
7. 進入 Firestore 的 **規則** 分頁，把內容換成專案裡的 [`firestore.rules`](../firestore.rules)，按 **發布**：

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

8. 打開 `js/sync-config.js`，把步驟 3 的四個值貼進去並存檔：

   ```js
   window.JP_SYNC_CONFIG = {
     apiKey: 'AIza...',
     authDomain: 'xxx.firebaseapp.com',
     projectId: 'xxx',
     appId: '1:123:web:abc',
   };
   ```

   這些值**不是密碼**，放在公開的網頁程式裡是正常的；真正保護資料的是上面的規則（每個人只能讀寫自己的文件）。

9. 重新部署（commit 並推送）後，打開網站 → 我的 → **使用 Google 登入並同步**。在另一台裝置第一次進站時，歡迎頁也有「登入 Google 還原進度」。

## 同步方式

- 進度以「合併」同步，不是覆蓋：經驗值、星星、收集的單字取較大值或聯集；兩台裝置都學過的單字，以複習次數較多的那份為準。
- 變更後約 2.5 秒會自動上傳；回到分頁時（超過 1 分鐘）會自動下載合併。
- 外觀、語音等設定以最近修改的那台為準；日語語音選擇是裝置專屬，不會被同步。
- 「清除所有進度」在登入狀態下會同時清掉雲端的備份。
- 離線時照常學習，恢復連線後會自動補上傳。

## 疑難排解

| 現象 | 原因 |
| --- | --- |
| 登入時顯示「授權網域」 | 步驟 5 沒有加入網站網域 |
| 顯示「Firestore 規則尚未設定好」 | 步驟 6、7 沒做完，或規則沒有發布 |
| 登入視窗沒跳出來 | 瀏覽器擋彈出視窗，請允許後再試 |
| 「我的」頁面顯示尚未啟用 | `js/sync-config.js` 裡的值是空的，或部署後還沒更新（強制重新整理） |
