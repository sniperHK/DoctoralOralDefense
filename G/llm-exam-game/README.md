# LLM 互動考試小工具（本機）

這是一個用瀏覽器介面練習「研究法」考古題的互動工具：

- 前端：出題／計時／輸入答案
- 後端：支援 OpenAI／Google（Gemini）／Claude（Anthropic）做「評分＋回饋＋下一題練習建議」

## 重要安全提醒（請先做）

你在聊天內容貼出的 `sk-...` 屬於機密金鑰；不要再貼、不要寫進檔案、不要 commit。

- 建議你立刻到 OpenAI 後台 **撤銷並重新產生** API key
- 建議你也不要把任何 API key 存進 repo；本工具不會把 key 寫進檔案（可選擇只存在瀏覽器）

## 啟動方式

1. 進到資料夾

```bash
cd "G/llm-exam-game"
```

2. 啟動伺服器

```bash
node server.js
```

3. 用瀏覽器打開

- `http://127.0.0.1:3000`

4. 在左側「設定」先選供應商（OpenAI / Google / Claude），再輸入對應的 API key

- 若勾選「記住在此瀏覽器」，會存到你的瀏覽器 `localStorage`（不會寫入 repo 檔案）
- 模型可用下拉選單切換（或選「自訂…」自行輸入模型名）

## 另一種方式：用環境變數（可選）

你也可以不在頁面輸入 key，改用環境變數（擇一）：

- `OPENAI_API_KEY=... node server.js`
- `GOOGLE_API_KEY=... node server.js`（Gemini API key）
- `ANTHROPIC_API_KEY=... node server.js`
- 或建立 `.env`（參考 `.env.example`）

## 目前內建題庫

- `112-2 行社組｜研究法`（來自 `C/博班資格考考古題/資格考考古題-研究法(行社組)/112-2 健管所博士班資格考_研究法(行社組).pdf`）

## 題目校正來源

評分提示會額外帶入：

- `G/模擬考/112-2_研究法_重點筆記.md`（含「官方書單對照」段落）
