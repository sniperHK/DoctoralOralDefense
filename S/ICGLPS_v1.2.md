# ICGLPS Project System（ICGLPS 專案系統）
## A Human–AI Co-working Project Architecture (Folder-as-Cognition)

> Purpose  
> 用一套固定且可機器讀的資料夾語意（I/C/G/L/P）＋一個系統層（S）＋一份 `ICGLPS.md` 控制檔，  
> 讓人與 LLM 能快速「進入狀態、判讀現況、維持一致、落地行動」。

ICGLPS 不是「文件模板」而已；它是一個 **project state management system**：

- Folders (I/C/G/L/P) = cognitive roles（資料夾＝認知角色）
- `S` = system layer（技能／規範／評分尺／整合設定）
- Files = state snapshots / evidence（檔案＝狀態快照與證據）
- `ICGLPS.md` = control panel / handover sheet（專案控制台／交班單）
- LLM = reads structure before acting（先讀結構再動作）

---

## 0. TL;DR（回專案與更新的最短路徑）

- **回到專案（Re-entry）**：先看 `P/` → 再看 `G/` → 需要理由再看 `C/` → 只有迷路/稽核才挖 `L/` → 需要「加能力」或「看/改助理行為」→ 看 `S/`
- **更新規則（One change, one place）**
  - 任務/待辦 → `P/`
  - 原型/可驗收產物/Acceptance Criteria → `G/`
  - 新的規格、會議結論、當前限制（只留「仍有效」的）→ `C/`
  - 歷史、版本、決策留痕、過期材料（可追溯但低注意力）→ `L/`
  - 技能／規範／評分尺／整合設定 → `S/`（例如：`agent.md`、`scale.md`、`prompts/`）
  - Claude Code 設定與技能 → `.claude/`（放根目錄以相容原生掃描）
- **`ICGLPS.md` 的定位**：保持短（像交班單），只寫「判斷＋指路」，細節放資料夾並以連結指向

---

## 1. Core Design Philosophy（核心設計理念）

ICGLPS 的目標是把專案從「人的腦袋」外掛成「可被讀取的外部認知系統」：

- Reduce cognitive load（降低認知負荷）
- Separate state from action（狀態 vs. 動作分離）
- Fast re-entry after long inactivity（久未碰也能快速回神）
- Machine-readable, human-intuitive（機器可讀、人類好懂）

---

## 2. Canonical Folder Structure（標準資料夾架構）

每個專案遵循同一個頂層結構：

```text
ProjectRoot/
│
├── ICGLPS.md       ← master handover & agent instructions
├── .gitignore      ← Git 版本控制忽略清單（若專案與 GitHub 同步）
│
├── I/              ← Identifiers（專案身分與跨系統入口）
├── C/              ← Context (prospective)（當前脈絡）
├── G/              ← Goal & prototypes（目標與可驗收產物）
├── L/              ← Logs & legacy（歷史與留痕）
├── P/              ← Plans / tasks（待辦與行動）
│
├── S/              ← System / Skills（系統層：技能、規範、整合設定）
│   ├── agent.md    ← behavioral rules for assistants（助理行為規範）
│   ├── scale.md    ← rubric / evaluation logic（評分尺/驗收標準）
│   ├── prompts/    ← reusable prompt templates（可重用 prompt 模板）
│   ├── integrations/ ← MCP/API 整合設定說明（不含密碼）
│   └── skills/     ← 技能實際存放處（透過 symlink 讓 .claude/ 索引）
│       └── <skill-name>/
│           └── SKILL.md
│
└── .claude/        ← Claude Code settings / skills（放根目錄以相容原生掃描）
    └── skills/
        └── <skill-name> → ../../S/skills/<skill-name>  (symlink)
```

> **注意**：
> - `.claude/` 放在根目錄以相容 Claude Code 原生掃描機制。
> - **Symlink 技巧**：將 skill 實際檔案放在 `S/skills/`，再從 `.claude/skills/` 建立符號連結指向它。這樣既符合 ICGLPS 的 S 層語意，又能讓 Claude Code 正確索引。
> - `.gitignore` 放在根目錄（Git 標準位置）。
> - `S/` 資料夾為選用；若專案不需要助理規範或評分尺，可省略。

### 2.1 ICGLPS 是「控制面」（Control Plane），可與既有目錄共存

ICGLPS 的 I/C/G/L/P/S 管的是「狀態／決策／下一步」，不是要把專案所有檔案都塞進這 5+1 個資料夾。

- 你可以保留慣用目錄（例如：`src/`、`data/`、`docs/`、`notebooks/`、`assets/`、`outputs/`）
- 但要遵守一條一致性規則：**任何會影響決策的內容，都要在 ICGLPS 控制面留下「摘要＋連結」**
  - 仍有效的規格/限制/假設 → `C/`
  - 可驗收產物/AC/可重現 artifact → `G/`
  - 完成項、決策留痕、被取代的版本 → `L/`
  - 下一步與待辦 → `P/`
- `ICGLPS.md` 永遠是入口；新增任何「重要檔案」時，至少在 `ICGLPS.md` 或對應資料夾的標準檔（例如 `C/ACTIVE.md`、`G/ACCEPTANCE.md`）補一條指路

---

## 3. Folder Semantics（資料夾語意：這裡放什麼、不放什麼）

### 建議的最小內部結構（可選，但能顯著降低發散）

以下不是硬性規定；目標是讓專案在「久未更新」或「交接給 AI/他人」時仍能快速定位。

- `I/README.md`：Owner/DRI、入口連結、權限與命名規則
- `C/ACTIVE.md`：仍有效的限制/假設/需求（被取代就移到 `L/`）
- `G/ACCEPTANCE.md`：Definition of Done / Acceptance Criteria（連到實際 artifact）
- `P/TODO.md`：下一步 1–20 條（完成/取消即移出 `P/`）
- `L/CHANGELOG.md`（或 `L/YYYY-MM.md`）：進度留痕、完成項摘要、決策摘要
- `S/agent.md`、`S/scale.md`：協作規範與驗收尺（需要才加）

### I/ — Identifiers（專案身分與跨系統入口）

**這個專案「是什麼」以及「誰負責」**，跨時間、跨系統都不會變的識別資訊。

- Typical contents：Owner/DRI、專案代號、IRB/Grant 編號、Repo/Drive/Notion 入口、權責表
- Do not：密碼/憑證（只允許「放在哪裡」的指引）
- Mental model：**忘記這專案是什麼、誰扛、入口在哪 → 來 I/**。

### C/ — Context (Prospective Only)（當前脈絡：只保留「仍有效」的）

**正在塑形專案的背景**，只往「未來」生長，不往「過去」堆疊。

- Typical contents：最新會議紀錄、現行規格/需求、限制與假設、Prompt/設計 rationale
- Explicit rule：❌ 不放過期史料／舊版本（放到 `L/`）
- Hygiene：任何「已被取代/不再有效」的內容，移到 `L/`，並在 `C/` 保留一條指向最新版本的連結（避免 context 堆積）
- Mental model：**為什麼現在要這樣做 → 來 C/**。

### G/ — Goal & Prototypes（目標與可驗收產物）

**什麼叫 done，以及目前最接近 done 的東西是什麼。**

- Typical contents：目標定義、Acceptance Criteria、Demo/Prototype、可測的 artifact、關鍵結果
- Key idea：原型放這裡，因為它是「面向目標」，不是「待辦」
- Hygiene：每個 artifact 至少附一段「如何驗收/如何重現」的最短步驟（或連結到對應說明）
- Mental model：**done 長什麼樣、現在差多遠 → 來 G/**。

### L/ — Logs & Legacy（歷史、留痕、低注意力材料）

**你不想天天看，但需要時必須可追溯的一切。**

- Typical contents：Change log、版本史、決策留痕、audit trail、deprecated docs、舊 meeting notes
- Suggested pattern：使用日期前綴（例如 `YYYY-MM-DD_...`）；決策可用 ADR 形式（例如 `L/decisions/ADR_YYYY-MM-DD_title.md`）
- Mental model：**迷路、查核、追溯 → 來 L/**。

### P/ — Plans / Tasks（只放「要做的事」）

**接下來要做什麼。**

- Typical contents：TODO/Backlog、Action items、工作佇列、Deferred tasks
- Explicit rule：❌ 不放規格、不放原型（規格→`C/`；原型→`G/`）
- Hygiene：完成/取消的任務不要留在 `P/`；移到 `L/`（留痕）或在 `L/CHANGELOG.md` 記一行摘要＋連結
- Mental model：**下一步怎麼走 → 來 P/**。

### S/ — System / Skills（專案的「操作系統層」）

**讓人與 AI 具備一致行為與可控能力的地方**：規範、技能、評分尺、整合設定、權限策略。

- Typical contents：
  - `S/agent.md` — 助理行為規範（風格、語言、邊界）
  - `S/scale.md` — 評分尺/驗收標準（Rubric）
  - `S/prompts/` — 可重用的 prompt 模板
  - `S/integrations/` — MCP/API 整合設定說明（例如 `~/.claude.json` 位置、OAuth 流程）
- Do not：任何密碼/Token（只記錄「安全存放位置」與取用流程）
- Mental model：**要「加能力」或「修助理行為」→ 看 S/**。

> **註**：Claude Code 的 `.claude/` 放在專案根目錄（而非 `S/` 內）以相容原生掃描。

---

## 4. `ICGLPS.md` — The Control File（控制檔：一頁式交班＋指路）

`ICGLPS.md` 應該像「交班單」：短、可掃描、可接手。它不取代資料夾；它**指向**資料夾。

> 推薦檔名：`ICGLPS.md`（若沿用 `ICGLP.md` 也可，但請在內容中明確標註為同義控制檔）。

### `ICGLPS.md` should do

- Summarize current state（用最少文字描述現況）
- Link to evidence（把讀者帶到正確的資料夾/檔案）
- Tell LLM where to look / what to update（告訴助理該動哪裡）
- Define update policy（什麼內容放哪裡，避免發散）

### Optional: machine-readable header（可選，但對自動化/LLM 很友善）

在 `ICGLPS.md` 最上方加一小段 YAML frontmatter，讓狀態可被快速解析：

```yaml
---
owner: <name>
status: Green|Yellow|Red
updated: YYYY-MM-DD
---
```

> 若不使用 YAML，也建議固定欄位名稱並維持短行，避免長段落。

### Minimal `ICGLPS.md` template（可直接複製到任一專案 root）

```markdown
# ICGLPS — [Project Name]

## I — ID
- Owner/DRI:
- Status: Green / Yellow / Red
- Entrypoints: [repo] [docs] [board]
- Next milestone (date):

## C — Context (active)
- Current constraints / assumptions:
- Stakeholders / dependencies:

## G — Goal
- Definition of done / acceptance criteria:
- Current prototype(s) / artifact(s): (link into `G/`)

## L — LOG (since YYYY-MM-DD)
- 📈 Progress / trend:
- ⚠️ Risks / blockers:
- 🔗 Evidence / links: (PR / issue / doc / dataset)

## P — Plan (next actions)
1. [Who] [Due] [Action] (DoD)
2. ...

## S — System (skills / rules / scale / integrations)
- Agent rules: `S/agent.md` (if any)
- Scale/rubric: `S/scale.md` (if any)
- Prompts: `S/prompts/` (if any)
- Claude Code: `.claude/` (at root, for native scan)
- MCP config: `~/.claude.json` (link/instructions only; do not paste secrets)

## Agent Instructions (for LLM)
- Read this file first; folder semantics are authoritative.
- Tasks → update `P/`; prototypes/artifacts → update `G/`; active specs → update `C/`; legacy/history → update `L/`.
- Skills/config/rubrics → update `S/` artifacts (`S/agent.md`, `S/scale.md`) or `.claude/` (skills); ask before changing them.
- If unsure where something belongs, ask before creating new structure.
```

---

## 5. LLM Synchronization Strategy（人–AI 協作操作規約）

- **Read order**：先讀 `ICGLPS.md` → 依指示進 `I/ C/ G/ L/ P/`（需要工具/規範再看 `S/`）
- **Write discipline**：更新只落在「對應資料夾」；`ICGLPS.md` 只保留「摘要＋連結」
- **Hygiene cadence**：每週一次把 `C/` 的過期內容搬到 `L/`、把 `P/` 的完成項搬到 `L/`，確保 `ICGLPS.md` 仍可 30 秒掃完
- **No secrets**：不在 repo 內寫入密碼/Token；只記錄「安全存放位置」與取用流程
- **Clarify before inventing**：缺資訊就問；不要憑空新增規格、改資料夾語意
- **Prefer small diffs**：一次改一件事，避免把「狀態」與「動作」混在同一段

---

## 6. Typical Workflow（常見工作流）

**會後（After a meeting）**

1. 會議紀錄 → `C/`
2. 行動項目 → `P/`
3. 重要決策與留痕（可稽核）→ `L/`
4. 若產出可驗收 artifact（demo、prototype、AC）→ `G/`
5. 若新增/調整技能、整合、評分尺、權限策略 → `S/`（並在 `ICGLPS.md` 補一行摘要與連結）

**久未回來（Re-entry after weeks/months）**

1. `P/` 看還沒做完的事
2. `G/` 看距離 done 的 gap
3. `C/` 只補「仍有效」的限制/理由
4. 真的迷路才挖 `L/`

---

## 7. What This System Solves（這套系統解的痛點）

- Readme / TODO sprawl（資訊散落、交接靠問）
- Forgotten prototypes（原型與可驗收產物常被埋掉）
- Lost context（理由與限制不見，決策無法追溯）
- LLM hallucination due to unclear structure（結構不清時，助理容易「自動補齊」）
- Cognitive overload in long-running projects（長跑專案回來很痛）

---

## 8. Final 一句話總結

> **ICGLPS is not file management. It is cognition management — for humans first, and AI second.**

---

## Appendix A: ICGLPS 交班單（I/C/G/LOG/P + S）— 快速用法與模板

> 註：ICGLPS 的 **L** 常寫成 **Lines** 或 **LOG**。本文用 **LOG**。  
> 在「資料夾層」`L/` 是 legacy/logs 的存放處；在「交班單」`L` 是**濃縮的趨勢判斷**（並以連結指向 `L/` 或其他證據）。

### 快速用法（30 秒讀 / 60 秒寫）

- **30 秒讀**：先看 `I → G → LOG → P`，需要理由再補 `C`
- **60 秒寫**：日常主要更新 `LOG` 與 `Plan`；`I/C/G` 有變更才動
- **建議長度**：每欄 1–3 行；`Plan` 1–3 條；`LOG` 只放「趨勢／阻塞／證據連結」

### 寫作規範（讓交班可接手）

- **I（ID）**：Owner/DRI、狀態（綠/黃/紅）、入口連結、下個里程碑/截止日
- **G（Goal）**：可驗收描述（交付物/指標 + 截止日）；必要時補「不做什麼」防止範圍漂移
- **LOG（L）**：標註 `since`；只寫三件事（📈進度、⚠️風險、🔗連結）；流水帳丟連結（通常在 `C/` 或 `L/`）
- **P（Plan）**：1–3 條；每條含 Who + Due + Action；需要他人決策就加 `Ask`

### 快速複製模板（純文字版）

```text
【ICGLPS 交班】[專案名稱]
I: [專案 ID/名稱 | Owner/DRI | 狀態(綠黃紅) | 入口連結 | 下個里程碑/截止日]
C: [當前仍有效的背景/限制/利害關係人]
G: [階段性目標/驗收標準/截止日]
L (LOG, since YYYY-MM-DD):
- 📈 Progress/Trend:
- ⚠️ Risks/Blockers:
- 🔗 Evidence/Links:
P:
1. [負責人] [期限] [動作] (DoD)
2. [負責人] [期限] [動作] (DoD)
S (System, optional):
- Skills/Tools:
- Rules/Scale/Configs:
Ask (可選): [需要誰在何時前決策/協助什麼]
```

---

### 表格版（適合 Notion / Excel）

| ID (專案) | Context (背景) | Goal (目標) | LOG / Lines (動態/證據) | Plan (下一步) |
| :--- | :--- | :--- | :--- | :--- |
| **[專案 A]** | [背景描述] | [預期結果] | 📈 進度：<br>⚠️ 風險：<br>🔗 連結： | 1. [人] [事]<br>2. [人] [事] |
| **[專案 B]** | [背景描述] | [預期結果] | ✅ 成果：<br>⚠️ 阻塞：<br>🔗 連結： | 1. [人] [事] |

---

## Appendix B: Example（示例：國科會計畫）

以「醫學教育中的 AI 素養與跨領域人才培育」研究為例。

```text
【ICGLPS 專案交班單】

I (ID):
114 年度國科會計畫：醫學教育中的 AI 素養 (Project ID: 114-XXXX) | Owner: 楊醫師 | Status: 黃 | Docs: <link> | Next: 2026/01/15 初步統計彙整

C (Context):
計畫進入第二階段（介入研究期）。第一階段現況調查已結案，目前正進行「生成式 AI 介入教學方案」的實驗組數據收集。

G (Goal):
2026/03 前完成 120 位受試者介入測驗，並完成第一篇 SCI/SSCI 論文初稿。

L (LOG, since 2025/12/01):
- 📈 Progress：目前收案進度 65% (N=78)，期末考週使速度略降。
- ⚠️ Risks：AI 模組多人在線時偶有延遲 (Latency > 5s)，影響教學體驗與完成率。
- 🔗 Evidence：初步數據顯示「AI 偏誤辨識能力」顯著提升 (p < .05)（統計表/圖：<link>）。

P (Plan):
1. [楊醫師] 2025/12/30 前：完成與工程團隊的 UI/UX 優化會議（聚焦延遲問題與改善方案）。
2. [助理]   2026/01/05 前：發送第二梯次醫學生受試者招募通知（含提醒節奏）。
3. [分析組] 2026/01/15 前：彙整初步統計結果，產出 AMEE 2026 摘要草稿。

S (System, optional):
- Skills/Tools：Claude Code MCP (Notion, Gmail, iCal)；Python + R 統計環境
- Rules/Scale/Configs：見 S/agent.md（助理回覆：繁體中文、簡潔、APA 格式引用）
- Prompts：S/prompts/interview-guide.md（質性訪談引導模板）
```

---

## Appendix C: ICGLPS 的來源直覺（可選）

ICGLPS 源自醫學交班（Sign-out / Handover）的思維：先辨識、再判讀現況、最後下指令；並額外把「可重用的技能/規範/評分尺/整合設定」獨立成 S（System layer）。

```text
不熟這個專案 → 名稱/脈絡 → 目標是什麼 → 現在進度/風險/證據 → 下一步做什麼
```

---

## Appendix D: Claude Code — 如何新增 Skills（SKILL.md）

> 目標：把可重用的 SOP/工作流封裝成 Skill，讓 Claude Code 能在需要時自動載入。

### 安裝方式（三種常用路徑）

1. **專案技能（Project Skills）**：放在專案根目錄的 `.claude/skills/`
2. **個人技能（Personal Skills）**：放在使用者家目錄的 `~/.claude/skills/`
3. **ICGLPS 推薦方式（Symlink）**：實際檔案放 `S/skills/`，透過符號連結讓 `.claude/skills/` 索引

> 另一條路徑是「安裝 Plugin（可能內含 skills/）」：在 Claude Code 內用 `/plugin install ...`（見下）。

### 命名規則（避免 Claude 掃不到）

- `skills/<skill-name>/SKILL.md`
- 資料夾名稱 `<skill-name>` 必須與 `SKILL.md` frontmatter 的 `name` 完全一致
- 建議用 kebab-case（小寫 + 連字號）

### 最小步驟（手動安裝 — 直接放 .claude/）

1. 建立目錄：`.claude/skills/<skill-name>/`（放在專案根目錄）
2. 在該目錄新增 `SKILL.md`
3. 確保 `SKILL.md` 的 YAML frontmatter 至少包含：`name`、`description`
4. 需要工具權限時，在 `allowed-tools` 設定白名單（最小權限）
5. 重新啟動 Claude Code（或重新載入專案）讓技能被掃描

### ICGLPS 推薦步驟（Symlink 方式）

將 skill 實際檔案放在 `S/skills/`，符合 ICGLPS 的 System 層語意：

```bash
# 1. 建立 S/skills/ 目錄
mkdir -p S/skills/<skill-name>

# 2. 在 S/skills/<skill-name>/ 新增 SKILL.md
# （編寫你的 skill 內容）

# 3. 確保 .claude/skills/ 存在
mkdir -p .claude/skills

# 4. 建立符號連結
ln -s ../../S/skills/<skill-name> .claude/skills/<skill-name>
```

結果結構：
```text
ProjectRoot/
├── S/skills/<skill-name>/SKILL.md      ← 實際檔案
└── .claude/skills/<skill-name>         ← symlink → ../../S/skills/<skill-name>
```

### 透過 Plugin 市集安裝（常見於共享/團隊）

- 在 Claude Code 輸入：`/plugin install {plugin-name}@claude-plugin-directory`
- 或：`/plugin > Discover`

### `SKILL.md` 最小骨架（示意）

```markdown
---
name: my-skill-name
description: Describe what this Skill does and when to use it.
allowed-tools: [Read, Write, Bash(git status:*), Bash(python {baseDir}/scripts/run.py:*)]
---

## Workflow
1. ...
```

---

## Appendix E: Git 版本控制與 `.gitignore`

> 若專案需要與 GitHub 同步，以下是建議的設定。

### `.gitignore` 放置位置

- **位置**：專案根目錄（`ProjectRoot/.gitignore`）
- **原因**：這是 Git 的標準位置，Git 會自動讀取

### ICGLPS 專案建議的 `.gitignore` 範本

```gitignore
# === OS generated files ===
.DS_Store
Thumbs.db

# === Claude Code local settings ===
.claude/settings.local.json

# === Secrets / credentials (never commit) ===
.env
.env.local
*.pem
*credentials*.json
*secrets*.json

# === Editor/IDE ===
.vscode/
.idea/
*.swp

# === Build artifacts / caches ===
__pycache__/
*.pyc
node_modules/
.cache/

# === Optional: Large data files ===
# *.csv
# *.xlsx
# data/raw/
```

### 注意事項

1. **不要忽略 `.claude/skills/`**：symlink 本身需要被追蹤，才能讓其他協作者知道 skill 的索引位置
2. **忽略 `.claude/settings.local.json`**：這是個人本地設定，不應共享
3. **絕對不要提交密碼/Token**：放在 `.env` 或環境變數，並確保 `.env` 在 `.gitignore` 中
