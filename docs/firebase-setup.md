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
         allow read, delete: if request.auth != null && request.auth.uid == uid;
         allow create, update: if request.auth != null && request.auth.uid == uid
           && request.resource.data.keys().hasOnly(['state', 'mt', 'v', 'updated'])
           && request.resource.data.state is string
           && request.resource.data.state.size() < 900000;
       }
     }
   }
   ```

   這份規則限制：只能讀寫自己的文件、只能寫入約定的欄位、內容不超過約 900KB，避免有人拿你的專案當免費空間。**舊版規則（`allow read, write`）也能用，但建議更新。**

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

- 進度以「合併」同步，不是覆蓋：經驗值、星星、收集的單字取較大值或聯集；兩台裝置都學過的單字，以複習次數較多的那份為準。上傳時也會先讀取雲端進度、合併後再寫回（使用 transaction），兩台裝置同時使用不會互相蓋掉。
- 進度檔記錄所屬帳號；同一台裝置換另一個 Google 帳號登入時，不會把上一個人的進度併進去。登出時會問你要不要順便清掉這台裝置上的進度（共用電腦建議清除）。
- 變更後約 2.5 秒會自動上傳；回到分頁時（超過 1 分鐘）會自動下載合併。
- 外觀、語音等設定以最近修改的那台為準；日語語音選擇是裝置專屬，不會被同步。
- 「清除所有進度」在登入狀態下會同時把雲端備份重置為空白（記下重置時間）；其他裝置下次同步時會採用這個重置，不會把舊進度推回來。無法連上雲端時會提示「目前無法清除雲端備份」而不會清除。
- 只有登入過的瀏覽器，開頁時才會載入 Firebase 的程式（約數百 KB）；沒登入過的人按「登入」時才載入。
- 離線時照常學習，恢復連線後會自動補上傳。

## 疑難排解

| 現象 | 原因 |
| --- | --- |
| 登入時顯示「授權網域」 | 步驟 5 沒有加入網站網域 |
| 顯示「Firestore 規則尚未設定好」 | 步驟 6、7 沒做完，或規則沒有發布 |
| 登入視窗沒跳出來 | 瀏覽器擋彈出視窗，請允許後再試 |
| 「我的」頁面顯示尚未啟用 | `js/sync-config.js` 裡的值是空的，或部署後還沒更新（強制重新整理） |

## 加強 API key 的保護（建議）

`js/sync-config.js` 裡的 API key 公開是正常的，但可以限制它只能被你的網站使用：

1. 打開 [Google Cloud Console → API 和服務 → 憑證](https://console.cloud.google.com/apis/credentials)，選你的專案，點 **Browser key**（Firebase 自動建立的那把）。
2. **應用程式限制** 選「網站」，新增下面三個（**少了第 2 個，登入會失敗**）：
   - `https://hhggffddssqjp-coder.github.io/*`（你的網站）
   - `https://<你的專案ID>.firebaseapp.com/*`（Firebase 登入視窗的網域，也就是 `js/sync-config.js` 裡的 `authDomain`；登入時是這個網域在呼叫 API，不是你的網站）
   - `http://localhost/*`（自己測試用，可省略）
   - 如果專案還有 `https://<你的專案ID>.web.app/*`，也一併加入。
   已登入的人用舊的登入狀態同步時不會發現問題，所以改完限制後，請**登出再重新登入一次**確認。
3. **API 限制** 選「限制金鑰」，只勾選 Identity Toolkit API、Token Service API、Cloud Firestore API。
4. 進一步可以到 Firebase 控制台啟用 **App Check**（reCAPTCHA v3），擋掉不是從你的網站發出的請求。
