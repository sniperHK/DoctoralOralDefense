/* eslint-disable no-console */
const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const REPO_ROOT = path.resolve(ROOT_DIR, "..", "..");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DEFAULT_GOOGLE_MODEL = process.env.GOOGLE_MODEL || "gemini-1.5-flash";
const DEFAULT_CLAUDE_MODEL = process.env.CLAUDE_MODEL || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".txt":
    case ".md":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store"
  });
  res.end(text);
}

async function readRequestBody(req, maxBytes) {
  return await new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJson(req, maxBytes = 1_000_000) {
  const text = await readRequestBody(req, maxBytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON");
  }
}

function loadDotEnv() {
  const envPath = path.join(ROOT_DIR, ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    if (process.env[key] != null) continue;
    process.env[key] = value;
  }
}

loadDotEnv();

async function readSets() {
  const filePath = path.join(DATA_DIR, "sets.json");
  const json = JSON.parse(await fsp.readFile(filePath, "utf8"));
  return json.sets || [];
}

async function readQuestions(setId) {
  const filePath = path.join(DATA_DIR, `${setId}.questions.json`);
  const json = JSON.parse(await fsp.readFile(filePath, "utf8"));
  return json.questions || [];
}

function resolvePathFromRepo(relativePath) {
  if (!relativePath) return null;
  const resolved = path.resolve(REPO_ROOT, relativePath);
  if (!resolved.startsWith(REPO_ROOT)) return null;
  return resolved;
}

function extractBooklistSection(md) {
  const marker = "## 參考書目校正（官方書單對照）";
  const idx = md.indexOf(marker);
  if (idx === -1) return null;
  return md.slice(idx).trim();
}

function extractNoteSection(md, noteHeading) {
  if (!noteHeading) return null;
  const start = md.indexOf(noteHeading);
  if (start === -1) return null;

  const searchFrom = start + noteHeading.length;
  const nextH2 = md.indexOf("\n## ", searchFrom);
  const nextH3 = md.indexOf("\n### ", searchFrom);

  let end = md.length;
  if (nextH2 !== -1) end = Math.min(end, nextH2);
  if (nextH3 !== -1) end = Math.min(end, nextH3);

  return md.slice(start, end).trim();
}

function normalizeProvider(value) {
  const v = String(value || "").toLowerCase().trim();
  if (v === "anthropic") return "claude";
  if (v === "gemini") return "google";
  if (v === "google") return "google";
  if (v === "openai") return "openai";
  if (v === "claude") return "claude";
  return "openai";
}

function defaultModelForProvider(provider) {
  switch (provider) {
    case "google":
      return DEFAULT_GOOGLE_MODEL;
    case "claude":
      return DEFAULT_CLAUDE_MODEL;
    case "openai":
    default:
      return DEFAULT_OPENAI_MODEL;
  }
}

function normalizeModel(provider, model) {
  const trimmed = String(model || "").trim();
  const fallback = defaultModelForProvider(provider);
  if (!trimmed) return fallback;
  if (trimmed.length > 120) return fallback;
  if (trimmed.includes("\n") || trimmed.includes("\r")) return fallback;
  return trimmed;
}

function clampNumber(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

async function callOpenAI({ apiKey, model, messages }) {
  const resolvedKey = String(apiKey || "").trim() || process.env.OPENAI_API_KEY;
  if (!resolvedKey) {
    throw new Error("Missing OpenAI API key (set env OPENAI_API_KEY or input it in the UI)");
  }
  if (!resolvedKey.startsWith("sk-") || resolvedKey.length < 20) {
    throw new Error("OpenAI API key format looks invalid");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolvedKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `OpenAI API error (${res.status})`;
    throw new Error(msg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI API returned empty content");
  }
  return content;
}

function sanitizeGoogleModel(model) {
  const trimmed = String(model || "").trim();
  const withoutPrefix = trimmed.startsWith("models/") ? trimmed.slice("models/".length) : trimmed;
  if (!withoutPrefix) throw new Error("Missing Google model");
  if (withoutPrefix.includes("/") || withoutPrefix.includes("?") || withoutPrefix.includes("#")) {
    throw new Error("Google model name contains invalid characters");
  }
  return withoutPrefix;
}

async function callGoogle({ apiKey, model, system, user }) {
  const resolvedKey =
    String(apiKey || "").trim() || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!resolvedKey) {
    throw new Error("Missing Google API key (set env GOOGLE_API_KEY/GEMINI_API_KEY or input it in the UI)");
  }

  const safeModel = sanitizeGoogleModel(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    safeModel
  )}:generateContent?key=${encodeURIComponent(resolvedKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Google API error (${res.status})`;
    throw new Error(msg);
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p) => p?.text).filter(Boolean).join("") : null;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Google API returned empty content");
  }
  return text;
}

async function callClaude({ apiKey, model, system, user }) {
  const resolvedKey = String(apiKey || "").trim() || process.env.ANTHROPIC_API_KEY;
  if (!resolvedKey) {
    throw new Error("Missing Anthropic API key (set env ANTHROPIC_API_KEY or input it in the UI)");
  }
  if (resolvedKey.length < 20) {
    throw new Error("Anthropic API key format looks invalid");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": resolvedKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1400,
      system,
      messages: [{ role: "user", content: [{ type: "text", text: user }] }]
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Anthropic API error (${res.status})`;
    throw new Error(msg);
  }

  const parts = data?.content;
  const text = Array.isArray(parts) ? parts.map((p) => p?.text).filter(Boolean).join("") : null;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Anthropic API returned empty content");
  }
  return text;
}

function safeJsonParse(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // keep going
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // keep going
    }
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      // ignore
    }
  }

  return null;
}

function buildGradingMessages({ question, answer, maxScore, elapsedSeconds, notesSnippet, booklistSnippet }) {
  const system = [
    "你是博士班資格考『研究法』閱卷老師，目標是幫考生用考試取向提升得分。",
    "請使用繁體中文回覆。",
    "你只能引用/建議回頭閱讀『官方書單對照』中出現的參考來源；不要自行杜撰書目或章節。",
    "評分重點：概念正確、對齊配分、結構清楚、能舉例或情境化。",
    "輸出必須是 JSON（不要 Markdown、不要多餘文字）。"
  ].join("\n");

  const userParts = [];
  userParts.push(`【題目｜${question.section}｜${maxScore} 分】\n${question.text}`);
  if (question.booklistTopics?.length) {
    userParts.push(`\n【題目對應書單主題】\n- ${question.booklistTopics.join("\n- ")}`);
  }
  if (typeof elapsedSeconds === "number") {
    userParts.push(`\n【作答時間】\n${elapsedSeconds} 秒（僅供參考）`);
  }
  userParts.push(`\n【考生答案】\n${answer}`);
  if (notesSnippet) {
    userParts.push(`\n【本專案重點筆記（校正用；不要逐字引用）】\n${notesSnippet}`);
  }
  if (booklistSnippet) {
    userParts.push(`\n【官方書單對照（可引用；不可杜撰）】\n${booklistSnippet}`);
  }

  const outputContract = {
    score: "number (0..maxScore, preferably integer)",
    maxScore: "number",
    rationale: "string (總評，100~200字)",
    strengths: "string[]",
    missingPoints: "string[]",
    improvements: "string[]",
    suggestedOutline: "string[] (用可直接抄寫的答題段落骨架)",
    booklistAlignment: {
      topics: "string[] (從題目對應主題挑)",
      refsToReview: "string[] (只能從官方書單對照出現過的條目挑)"
    },
    nextDrill: {
      prompt: "string (下一題練習題，請你出一題同題型但換情境的題目)",
      timeboxMinutes: "number (建議練習時間)"
    }
  };

  userParts.push(`\n【輸出格式（必須符合）】\n${JSON.stringify(outputContract, null, 2)}`);
  userParts.push("\n【要求】score 不得超過 maxScore；若答案明顯離題/錯誤，請直接點出並給最短可補救版本。");

  return [
    { role: "system", content: system },
    { role: "user", content: userParts.join("\n\n") }
  ];
}

async function handleGrade(req, res) {
  const body = await readJson(req);
  const setId = String(body.setId || "").trim();
  const questionId = String(body.questionId || "").trim();
  const provider = normalizeProvider(body.provider);
  const model = normalizeModel(provider, body.model);
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const answer = String(body.answer || "").trim();
  const elapsedSeconds = clampNumber(body.elapsedSeconds, 0, 24 * 60 * 60, 0);

  if (!setId) return sendError(res, 400, "Missing setId");
  if (!questionId) return sendError(res, 400, "Missing questionId");
  if (!answer) return sendError(res, 400, "Missing answer");

  const questions = await readQuestions(setId);
  const question = questions.find((q) => q.id === questionId);
  if (!question) return sendError(res, 404, "Question not found");

  const maxScore = Number(question.points) || 0;

  const sets = await readSets();
  const set = sets.find((s) => s.id === setId);
  const notesPath = resolvePathFromRepo(set?.notesMd);
  const notesMd = notesPath ? await fsp.readFile(notesPath, "utf8").catch(() => "") : "";
  const notesSnippet = notesMd ? extractNoteSection(notesMd, question.noteHeading) : null;
  const booklistSnippet = notesMd ? extractBooklistSection(notesMd) : null;

  const messages = buildGradingMessages({
    question,
    answer,
    maxScore,
    elapsedSeconds,
    notesSnippet,
    booklistSnippet
  });

  const system = messages?.[0]?.content || "";
  const user = messages?.[1]?.content || "";

  let raw = "";
  if (provider === "google") {
    raw = await callGoogle({ apiKey, model, system, user });
  } else if (provider === "claude") {
    raw = await callClaude({ apiKey, model, system, user });
  } else {
    raw = await callOpenAI({ apiKey, model, messages });
  }
  const parsed = safeJsonParse(raw);
  if (!parsed) {
    return sendJson(res, 200, {
      result: {
        score: 0,
        maxScore,
        rationale: "模型回傳格式不是 JSON，請重試。",
        strengths: [],
        missingPoints: [],
        improvements: [],
        suggestedOutline: [],
        booklistAlignment: { topics: [], refsToReview: [] },
        nextDrill: { prompt: "", timeboxMinutes: 10 }
      },
      raw
    });
  }

  parsed.maxScore = maxScore;
  if (typeof parsed.score !== "number" || !Number.isFinite(parsed.score)) parsed.score = 0;
  parsed.score = Math.max(0, Math.min(maxScore, parsed.score));

  if (!Array.isArray(parsed.strengths)) parsed.strengths = [];
  if (!Array.isArray(parsed.missingPoints)) parsed.missingPoints = [];
  if (!Array.isArray(parsed.improvements)) parsed.improvements = [];
  if (!Array.isArray(parsed.suggestedOutline)) parsed.suggestedOutline = [];
  if (!parsed.booklistAlignment || typeof parsed.booklistAlignment !== "object") {
    parsed.booklistAlignment = { topics: [], refsToReview: [] };
  }
  if (!Array.isArray(parsed.booklistAlignment.topics)) parsed.booklistAlignment.topics = [];
  if (!Array.isArray(parsed.booklistAlignment.refsToReview)) parsed.booklistAlignment.refsToReview = [];
  if (!parsed.nextDrill || typeof parsed.nextDrill !== "object") {
    parsed.nextDrill = { prompt: "", timeboxMinutes: 10 };
  }
  if (typeof parsed.nextDrill.prompt !== "string") parsed.nextDrill.prompt = "";
  parsed.nextDrill.timeboxMinutes = clampNumber(parsed.nextDrill.timeboxMinutes, 5, 120, 15);

  return sendJson(res, 200, { result: parsed, raw });
}

async function serveStatic(req, res, urlPath) {
  const pathname = urlPath === "/" ? "/index.html" : urlPath;
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) return sendError(res, 403, "Forbidden");

  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return sendError(res, 404, "Not found");
    const data = await fsp.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypeFor(filePath),
      "Content-Length": data.length,
      "Cache-Control": "no-store"
    });
    res.end(data);
  } catch {
    return sendError(res, 404, "Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/health" && req.method === "GET") {
      return sendJson(res, 200, {
        ok: true,
        version: "llm-exam-game/0.2",
        env: {
          openai: Boolean(process.env.OPENAI_API_KEY),
          google: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
          claude: Boolean(process.env.ANTHROPIC_API_KEY)
        },
        hasApiKey: Boolean(process.env.OPENAI_API_KEY),
        hasEnvApiKey: Boolean(process.env.OPENAI_API_KEY)
      });
    }

    if (url.pathname === "/api/sets" && req.method === "GET") {
      const sets = await readSets();
      return sendJson(res, 200, { sets });
    }

    if (url.pathname === "/api/questions" && req.method === "GET") {
      const setId = url.searchParams.get("set");
      if (!setId) return sendError(res, 400, "Missing set");
      const questions = await readQuestions(setId);
      return sendJson(res, 200, { questions });
    }

    if (url.pathname === "/api/grade" && req.method === "POST") {
      return await handleGrade(req, res);
    }

    if (req.method !== "GET") return sendError(res, 405, "Method not allowed");
    return await serveStatic(req, res, url.pathname);
  } catch (e) {
    console.error(e);
    return sendError(res, 500, e?.message || "Internal error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`LLM exam game running at http://${HOST}:${PORT}`);
  console.log("Tip: input API key in the UI, or set env OPENAI_API_KEY / GOOGLE_API_KEY / ANTHROPIC_API_KEY.");
});
