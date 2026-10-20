# 任務說明：讓日語語音更像真人

> 給 Codex 的工作說明。背景請先讀根目錄的 `AGENTS.md`。

## 問題
使用者覺得目前的預錄語音「還是不太像人類」。目標是**聽起來自然、像真人、發音正確**，同時維持低成本與離線可用。

## 目前的做法
- 語音由 `tools/gen-audio.mjs` 用 **Google Cloud Text-to-Speech**（`ja-JP-Neural2-B`，一般語速 0.95、慢速 0.65）預先錄好，放在 `audio/`，用 `audio/manifest.json`（`{voice, normal:{文字:檔名}, slow:{文字:檔名}}`）對照。檔名＝`sha1(語音|語速|文字)` 前 16 碼（慢速加 `-s`）。
- 要錄的文字由 `collectTexts()` 蒐集：單字讀音（`rd||jp`）、單字例句、N3 單字庫的讀音與例句、情境會話句、文法例句與填空題（填好答案的完整句）。目前 6,083 句 × 2 種語速 ≈ 10.6 萬字元、約 12,000 個檔、230MB。
- 播放端（`js/core.js` 的 `tts`）：有 manifest 且有該文字就用 `fetch` 取得 mp3 播放（`playFile`），否則退回瀏覽器內建語音（Web Speech）。Service Worker 把播過的音檔存進 `nihongo-audio` 快取供離線使用。
- 已經有「語音試聽樣本」工具：`tools/gen-samples.mjs` + `.github/workflows/voice-samples.yml`，會用同一組 8 句錄多種 Google 語音，產生 `voice-samples.html` 供使用者用耳朵比較。**使用者會先挑出喜歡的語音名稱**，再決定正式重錄。

## 你可以做的事（依優先順序）
1. **讓產生流程支援多家語音服務（provider 抽象）**：把 `synth()` 抽成可替換的 provider（例如 `google`、`openai`〔如 `gpt-4o-mini-tts`，可用 instructions 控制語氣〕、`azure`、`elevenlabs`、`gemini`），由環境變數／workflow 輸入選擇。檔名雜湊要包含 provider 與語音，避免不同語音互相覆蓋。金鑰一律從 Actions secrets 讀取。
2. **提升發音正確率**：
   - 句子目前直接把漢字交給 TTS，可能讀錯（同形異讀、數字加量詞、「は／へ／を」助詞）。資料裡有振假名標記，`core.js` 的 `reading()` 可以把句子轉成純假名，評估「送假名讀音給 TTS」或用 SSML `<sub alias>` 只修正有歧義的詞，看哪個更準又不會變得不自然。
   - 單一假名（あ、は、を…）單獨念時是否正確；「は」「を」在句中與單獨出現的差異。
3. **語速與停頓**：慢速 0.65 可能聽起來不自然。比較「降低語速」與「在詞間加停頓（SSML break）」兩種慢速作法；注意 Chirp 3 HD 等新模型對 SSML／語速的支援可能不同，請以官方文件為準。
4. **成本與規模**：重錄約 10.6 萬字元（兩種語速）。請在 PR 說明各 provider 的估算費用（以官方價目為準），並保留 `DRY_RUN` 先試算、`MAX_CHARS` 上限等防呆。
5. **音檔體積**：`audio/` 已 230MB 且每次換語音檔名全換，git 歷史會膨脹。可以提出方案（例如音檔放另一個分支／Release／物件儲存並由網站載入、換語音前先 squash 歷史），**先在 PR 描述討論，不要直接執行破壞性操作**。

## 驗收
- 在 `voice-samples.html`（或你新增的比較頁）能用耳朵比較新舊語音，同一批句子。
- `node tools/gen-audio.mjs`（`DRY_RUN=1`）仍能算出正確的文字數與檔案數；`node tools/check-audio.mjs` 能正確列出缺口。
- 網站播放端不需要因為換語音而改動，除非你在 PR 說明了理由（`manifest.json` 格式盡量向下相容）。
- 前面「每次修改後要跑」的檢查全部通過。

## 不要做的事
- 不要直接推 `main`、不要自己合併 PR、不要手動改 `audio/`。
- 不要把金鑰寫進任何檔案或 log。
- 不要改 `js/data-*.js` 的單字第 1 欄或進度格式。
