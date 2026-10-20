# 給協作的 AI／開發者：專案說明（日本語冒險 にほんご冒險）

純前端的日語學習網站（HTML／CSS／JS，沒有建置步驟），部署在 GitHub Pages（`main` 分支）。使用者是台灣學習者，介面與說明一律用**繁體中文**。
網址：https://hhggffddssqjp-coder.github.io/japanese-learn/

## 協作方式（請先讀）
- 這個 repo 同時有 Claude 和 Codex 在協作，使用者在中間協調。**各自開自己的分支**（Codex 用 `codex/<主題>`），不要直接推 `main`，開 PR 並在說明裡寫清楚改了什麼、怎麼驗證。**不要自己合併**，由 Claude 審查、使用者決定。
- 分工建議：Codex 負責**語音（`tools/gen-audio*`、`tools/gen-samples.mjs`、語音相關 workflow、播放端 `js/core.js` 的 tts 區塊）**；Claude 負責題庫內容、介面、學習流程。要動到對方負責的檔案時，先在 PR 或 issue 說明。
- **不要手動修改 `audio/`**：音檔只能由「產生語音檔」workflow 產生並提交（檔名是 `語音|語速|文字` 的雜湊，手改會對不上）。
- **金鑰**：Google／OpenAI 等 API key 只放在 GitHub Actions secrets（目前有 `GOOGLE_TTS_KEY`），**不要寫進程式碼、文件、PR 或 log**；也不要要求使用者貼金鑰。
- 不要改單字的第 1 欄（`jp`）：項目 id 是 `'w:' + jp`，改了會讓使用者已學的進度遺失。
- 進度存在 localStorage `jpl.v2` 與 Firebase（`js/sync.js`），欄位只能新增、不能改名或刪除。

## 每次修改後要跑
```sh
for f in js/*.js sw.js tools/*.mjs; do node --check "$f"; done
node tools/validate-data.mjs
node tools/build-bank.mjs n3 check
node tools/smoke-test.mjs        # 約 1.5 分鐘
node tools/check-audio.mjs       # 只警告：列出預錄語音缺的句子
```
同樣的檢查會在每個 PR 由 `.github/workflows/check.yml` 自動執行。新增 js 檔要同步加進 `index.html` 與 `sw.js` 的 `SHELL`。

## 結構速覽
| 路徑 | 用途 |
| --- | --- |
| `js/data-*.js` | 單字、文法、情境會話資料（格式 `漢字{よみ}`，`\|` 分詞） |
| `js/core.js` | 進度、SRS、**語音播放（`tts`）**、音效 |
| `js/questions.js`、`player.js`、`views.js`、`practice.js` | 出題、答題畫面、各頁面 |
| `js/bank.js`、`js/bank-n3.js` | N3 單字庫（延遲載入） |
| `sw.js` | 離線快取（音檔另有 `nihongo-audio` 快取） |
| `tools/gen-audio.mjs` + `.github/workflows/generate-audio.yml` | 預錄語音產生 |
| `tools/gen-samples.mjs` + `.github/workflows/voice-samples.yml` | 語音試聽樣本（產生 `voice-samples.html`） |
| `docs/voice-brief.md` | **語音任務說明（Codex 的主要工作）** |

README 有更完整的檔案表與資料來源／授權說明。
