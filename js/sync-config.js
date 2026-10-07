/* 雲端同步設定（選用）
   留空 = 不啟用雲端同步，進度只存在這個瀏覽器。
   啟用方式：照 docs/firebase-setup.md 建立 Firebase 專案，把「網頁應用程式」給你的設定貼在下面。
   這些值不是密碼，可以公開（真正的保護是 Firestore 安全性規則）。 */
window.JP_SYNC_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
};
