const els = {
  status: document.getElementById("status"),
  setSelect: document.getElementById("setSelect"),
  providerSelect: document.getElementById("providerSelect"),
  modelInput: document.getElementById("modelInput"),
  modelCustomInput: document.getElementById("modelCustomInput"),
  apiKeyLabel: document.getElementById("apiKeyLabel"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  rememberKey: document.getElementById("rememberKey"),
  showKey: document.getElementById("showKey"),
  clearKeyBtn: document.getElementById("clearKeyBtn"),
  questionSelect: document.getElementById("questionSelect"),
  questionMeta: document.getElementById("questionMeta"),
  questionText: document.getElementById("questionText"),
  answerInput: document.getElementById("answerInput"),
  submitBtn: document.getElementById("submitBtn"),
  saveDraftBtn: document.getElementById("saveDraftBtn"),
  clearBtn: document.getElementById("clearBtn"),
  result: document.getElementById("result"),
  history: document.getElementById("history"),
  draftStatus: document.getElementById("draftStatus"),
  timerValue: document.getElementById("timerValue"),
  timerStart: document.getElementById("timerStart"),
  timerPause: document.getElementById("timerPause"),
  timerReset: document.getElementById("timerReset")
};

const STORAGE_KEYS = {
  provider: "llm-exam-game:provider",
  rememberKey: "llm-exam-game:rememberKey",
  setId: "llm-exam-game:setId",
  questionId: "llm-exam-game:questionId",
  draftPrefix: "llm-exam-game:draft:",
  history: "llm-exam-game:history",
  legacyModel: "llm-exam-game:model",
  legacyApiKey: "llm-exam-game:apiKey"
};

let state = {
  sets: [],
  questions: [],
  selectedSetId: null,
  selectedQuestionId: null,
  provider: "openai",
  health: null,
  timer: { running: false, startedAtMs: null, elapsedMs: 0, tick: null }
};

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function formatMs(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function setStatus(lines, tone = "info") {
  const header =
    tone === "ok" ? "✓" : tone === "warn" ? "!" : tone === "bad" ? "×" : "i";
  els.status.textContent = `${header} ${lines.join("\n")}`;
}

const PROVIDERS = {
  openai: {
    id: "openai",
    label: "OpenAI",
    envVar: "OPENAI_API_KEY",
    keyPlaceholder: "sk-...",
    defaultModel: "gpt-4o-mini",
    models: [
      { value: "gpt-4o-mini", label: "gpt-4o-mini（建議：快／便宜）" },
      { value: "gpt-4o", label: "gpt-4o（較強：較慢／較貴）" }
    ]
  },
  google: {
    id: "google",
    label: "Google（Gemini）",
    envVar: "GOOGLE_API_KEY（或 GEMINI_API_KEY）",
    keyPlaceholder: "AIza...",
    defaultModel: "gemini-1.5-flash",
    models: [
      { value: "gemini-1.5-flash", label: "gemini-1.5-flash（建議）" },
      { value: "gemini-1.5-pro", label: "gemini-1.5-pro" },
      { value: "gemini-2.0-flash", label: "gemini-2.0-flash（若可用）" }
    ]
  },
  claude: {
    id: "claude",
    label: "Claude（Anthropic）",
    envVar: "ANTHROPIC_API_KEY",
    keyPlaceholder: "sk-ant-...",
    defaultModel: "claude-3-5-sonnet-20241022",
    models: [
      { value: "claude-3-5-haiku-20241022", label: "claude-3-5-haiku-20241022" },
      { value: "claude-3-5-sonnet-20241022", label: "claude-3-5-sonnet-20241022（建議）" },
      { value: "claude-3-opus-20240229", label: "claude-3-opus-20240229" }
    ]
  }
};

function normalizeProvider(value) {
  const v = String(value || "").toLowerCase().trim();
  if (v === "anthropic") return "claude";
  if (v in PROVIDERS) return v;
  return "openai";
}

function apiKeyStorageKey(provider) {
  return `llm-exam-game:apiKey:${provider}`;
}

function modelStorageKey(provider) {
  return `llm-exam-game:model:${provider}`;
}

function renderModelOptions(provider) {
  const cfg = PROVIDERS[provider] || PROVIDERS.openai;
  const options = cfg.models
    .map((m) => `<option value="${m.value}">${m.label}</option>`)
    .join("");
  els.modelInput.innerHTML = `${options}<option value="__custom__">自訂…</option>`;
}

function setModelValue(model) {
  const trimmed = String(model || "").trim();
  const hasOption = Array.from(els.modelInput.options).some((o) => o.value === trimmed);
  if (hasOption) {
    els.modelInput.value = trimmed;
    els.modelCustomInput.classList.add("hidden");
    els.modelCustomInput.value = "";
    return;
  }
  els.modelInput.value = "__custom__";
  els.modelCustomInput.classList.remove("hidden");
  els.modelCustomInput.value = trimmed;
}

function getSelectedModel() {
  if (els.modelInput.value === "__custom__") return (els.modelCustomInput.value || "").trim();
  return (els.modelInput.value || "").trim();
}

function getStoredModel(provider) {
  const key = modelStorageKey(provider);
  return (
    localStorage.getItem(key) ||
    (provider === "openai" ? localStorage.getItem(STORAGE_KEYS.legacyModel) : null) ||
    ""
  );
}

function setStoredModel(provider, model) {
  localStorage.setItem(modelStorageKey(provider), String(model || "").trim());
}

function getStoredApiKey(provider) {
  const key = apiKeyStorageKey(provider);
  return (
    localStorage.getItem(key) ||
    (provider === "openai" ? localStorage.getItem(STORAGE_KEYS.legacyApiKey) : null) ||
    ""
  );
}

function setStoredApiKey(provider, apiKey) {
  localStorage.setItem(apiKeyStorageKey(provider), String(apiKey || ""));
}

function updateProviderUi() {
  const provider = normalizeProvider(state.provider);
  const cfg = PROVIDERS[provider] || PROVIDERS.openai;

  if (els.apiKeyLabel) {
    els.apiKeyLabel.textContent = `${cfg.label} API key（不會寫入檔案；可選擇只存在此瀏覽器）`;
  }
  if (els.apiKeyInput) {
    els.apiKeyInput.placeholder = cfg.keyPlaceholder;
    els.apiKeyInput.value = "";
  }

  renderModelOptions(provider);
  const storedModel = getStoredModel(provider) || cfg.defaultModel;
  setModelValue(storedModel);

  if (els.rememberKey.checked) {
    const savedKey = getStoredApiKey(provider);
    if (savedKey) els.apiKeyInput.value = savedKey;
  }

  updateStatus();
}

function getUiApiKey() {
  return (els.apiKeyInput?.value || "").trim();
}

function updateStatus() {
  const health = state.health;
  const uiKey = getUiApiKey();

  if (!health) {
    setStatus(["連線中..."]);
    return;
  }

  const provider = normalizeProvider(state.provider);
  const cfg = PROVIDERS[provider] || PROVIDERS.openai;
  const envHasKey = Boolean(health?.env?.[provider] ?? health.hasEnvApiKey ?? health.hasApiKey);

  const lines = [`伺服器：OK（${health.version}）`, `供應商：${cfg.label}`];
  const keyLine = uiKey
    ? `${cfg.label} API key：已輸入（瀏覽器）`
    : envHasKey
      ? `${cfg.label} API key：已設定（伺服器環境變數）`
      : `${cfg.label} API key：未設定（需在此頁輸入或用環境變數 ${cfg.envVar}）`;
  lines.push(keyLine);

  const tone = uiKey || envHasKey ? "ok" : "warn";
  setStatus(lines, tone);
}

async function apiGet(path) {
  const res = await fetch(path, { method: "GET" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

function getSelectedQuestion() {
  return state.questions.find((q) => q.id === state.selectedQuestionId) || null;
}

function loadLocalDefaults() {
  const savedProvider = normalizeProvider(localStorage.getItem(STORAGE_KEYS.provider));
  state.provider = savedProvider;
  const rememberKey = localStorage.getItem(STORAGE_KEYS.rememberKey);
  els.rememberKey.checked = rememberKey == null ? false : rememberKey === "1";
  const savedSetId = localStorage.getItem(STORAGE_KEYS.setId);
  const savedQuestionId = localStorage.getItem(STORAGE_KEYS.questionId);
  return { savedSetId, savedQuestionId, savedProvider };
}

function saveLocalDefaults() {
  localStorage.setItem(STORAGE_KEYS.provider, state.provider || "openai");
  localStorage.setItem(STORAGE_KEYS.setId, state.selectedSetId || "");
  localStorage.setItem(STORAGE_KEYS.questionId, state.selectedQuestionId || "");
}

function getDraftKey(setId, questionId) {
  return `${STORAGE_KEYS.draftPrefix}${setId}:${questionId}`;
}

function loadDraft() {
  if (!state.selectedSetId || !state.selectedQuestionId) return;
  const key = getDraftKey(state.selectedSetId, state.selectedQuestionId);
  const draft = localStorage.getItem(key);
  els.answerInput.value = draft || "";
  els.draftStatus.textContent = draft ? "已載入草稿。" : "";
}

function saveDraft() {
  const q = getSelectedQuestion();
  if (!q || !state.selectedSetId) return;
  const key = getDraftKey(state.selectedSetId, q.id);
  localStorage.setItem(key, els.answerInput.value);
  els.draftStatus.textContent = `已存草稿（${new Date().toLocaleString()}）`;
}

function loadHistory() {
  return safeJsonParse(localStorage.getItem(STORAGE_KEYS.history) || "[]", []);
}

function pushHistory(item) {
  const history = loadHistory();
  history.unshift(item);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history.slice(0, 50)));
  renderHistory();
}

function renderHistory() {
  const history = loadHistory();
  if (!history.length) {
    els.history.innerHTML = `<div class="subtle">尚無紀錄。</div>`;
    return;
  }
  els.history.innerHTML = history
    .map((h) => {
      const pillClass = h.scoreRatio >= 0.7 ? "ok" : h.scoreRatio <= 0.4 ? "bad" : "";
      return `
        <div class="history-item">
          <div>
            <span class="pill ${pillClass}">${h.score}/${h.maxScore}</span>
            <span class="pill">${h.setTitle}</span>
            <span class="pill">${h.questionTitle}</span>
          </div>
          <div class="subtle">${new Date(h.at).toLocaleString()}｜供應商：${PROVIDERS[h.provider]?.label || h.provider || "?"}｜模型：${h.model}</div>
          <div class="subtle">${h.summary || ""}</div>
        </div>
      `;
    })
    .join("");
}

function renderQuestion() {
  const q = getSelectedQuestion();
  if (!q) {
    els.questionMeta.textContent = "";
    els.questionText.textContent = "";
    return;
  }
  els.questionMeta.textContent = `${q.section}｜${q.points} 分｜${q.title}`;
  els.questionText.textContent = q.text;
}

function timerStart() {
  if (state.timer.running) return;
  state.timer.running = true;
  state.timer.startedAtMs = Date.now();
  state.timer.tick = window.setInterval(() => {
    const elapsed = state.timer.elapsedMs + (Date.now() - state.timer.startedAtMs);
    els.timerValue.textContent = formatMs(elapsed);
  }, 250);
}

function timerPause() {
  if (!state.timer.running) return;
  state.timer.running = false;
  state.timer.elapsedMs += Date.now() - state.timer.startedAtMs;
  state.timer.startedAtMs = null;
  if (state.timer.tick) window.clearInterval(state.timer.tick);
  state.timer.tick = null;
  els.timerValue.textContent = formatMs(state.timer.elapsedMs);
}

function timerReset() {
  state.timer.running = false;
  state.timer.startedAtMs = null;
  state.timer.elapsedMs = 0;
  if (state.timer.tick) window.clearInterval(state.timer.tick);
  state.timer.tick = null;
  els.timerValue.textContent = "00:00";
}

function renderResult(obj) {
  if (!obj) {
    els.result.textContent = "尚未評分。";
    els.result.classList.add("subtle");
    return;
  }
  const lines = [];
  lines.push(`分數：${obj.score}/${obj.maxScore}`);
  if (obj.rationale) lines.push(`\n總評：\n${obj.rationale}`);
  if (Array.isArray(obj.strengths) && obj.strengths.length) {
    lines.push(`\n亮點：\n- ${obj.strengths.join("\n- ")}`);
  }
  if (Array.isArray(obj.missingPoints) && obj.missingPoints.length) {
    lines.push(`\n漏掉/不足：\n- ${obj.missingPoints.join("\n- ")}`);
  }
  if (Array.isArray(obj.improvements) && obj.improvements.length) {
    lines.push(`\n改善建議：\n- ${obj.improvements.join("\n- ")}`);
  }
  if (Array.isArray(obj.suggestedOutline) && obj.suggestedOutline.length) {
    lines.push(`\n建議答題骨架：\n- ${obj.suggestedOutline.join("\n- ")}`);
  }
  if (obj.booklistAlignment?.refsToReview?.length) {
    lines.push(`\n書單對照（建議回頭看）：\n- ${obj.booklistAlignment.refsToReview.join("\n- ")}`);
  }
  if (obj.nextDrill?.prompt) {
    lines.push(`\n下一題練習（建議）：\n${obj.nextDrill.prompt}`);
  }
  els.result.textContent = lines.join("\n");
  els.result.classList.remove("subtle");
}

async function refreshQuestions() {
  if (!state.selectedSetId) return;
  els.questionSelect.innerHTML = `<option>載入中...</option>`;
  const data = await apiGet(`/api/questions?set=${encodeURIComponent(state.selectedSetId)}`);
  state.questions = data.questions || [];
  els.questionSelect.innerHTML = state.questions
    .map((q) => {
      const label = `${q.section}｜${q.points}分｜${q.title}`;
      return `<option value="${q.id}">${label}</option>`;
    })
    .join("");
  if (state.questions.length) {
    const prefer = localStorage.getItem(STORAGE_KEYS.questionId);
    state.selectedQuestionId = state.questions.some((q) => q.id === prefer) ? prefer : state.questions[0].id;
    els.questionSelect.value = state.selectedQuestionId;
    renderQuestion();
    loadDraft();
  }
  saveLocalDefaults();
}

async function init() {
  setStatus(["連線中..."]);
  const defaults = loadLocalDefaults();
  try {
    state.health = await apiGet("/api/health");
    updateStatus();
  } catch (e) {
    setStatus([`伺服器連線失敗：${e.message}`], "bad");
    return;
  }

  const sets = await apiGet("/api/sets");
  state.sets = sets.sets || [];
  els.setSelect.innerHTML = state.sets
    .map((s) => `<option value="${s.id}">${s.title}</option>`)
    .join("");
  state.selectedSetId = state.sets.some((s) => s.id === defaults.savedSetId) ? defaults.savedSetId : state.sets[0]?.id;
  els.setSelect.value = state.selectedSetId || "";

  els.providerSelect.value = state.provider;
  updateProviderUi();

  els.showKey.addEventListener("change", () => {
    els.apiKeyInput.type = els.showKey.checked ? "text" : "password";
  });

  const clearRememberedKeysAllProviders = () => {
    for (const provider of Object.keys(PROVIDERS)) {
      localStorage.removeItem(apiKeyStorageKey(provider));
    }
    localStorage.removeItem(STORAGE_KEYS.legacyApiKey);
  };

  const persistKeyMaybe = () => {
    localStorage.setItem(STORAGE_KEYS.rememberKey, els.rememberKey.checked ? "1" : "0");
    if (els.rememberKey.checked) {
      const key = getUiApiKey();
      if (key) setStoredApiKey(state.provider, key);
    } else {
      clearRememberedKeysAllProviders();
    }
    updateStatus();
  };

  els.rememberKey.addEventListener("change", persistKeyMaybe);
  els.apiKeyInput.addEventListener("input", () => {
    if (els.rememberKey.checked) {
      const key = getUiApiKey();
      if (key) setStoredApiKey(state.provider, key);
    }
    updateStatus();
  });
  els.clearKeyBtn.addEventListener("click", () => {
    els.apiKeyInput.value = "";
    localStorage.removeItem(apiKeyStorageKey(state.provider));
    if (state.provider === "openai") localStorage.removeItem(STORAGE_KEYS.legacyApiKey);
    els.draftStatus.textContent = "已清除 API key（本機瀏覽器）。";
    updateStatus();
  });

  await refreshQuestions();
  renderHistory();

  els.providerSelect.addEventListener("change", () => {
    state.provider = normalizeProvider(els.providerSelect.value);
    timerReset();
    updateProviderUi();
    saveLocalDefaults();
  });

  els.setSelect.addEventListener("change", async () => {
    state.selectedSetId = els.setSelect.value;
    state.selectedQuestionId = null;
    timerReset();
    await refreshQuestions();
  });

  els.questionSelect.addEventListener("change", () => {
    state.selectedQuestionId = els.questionSelect.value;
    timerReset();
    renderQuestion();
    loadDraft();
    saveLocalDefaults();
  });

  els.modelInput.addEventListener("change", () => {
    if (els.modelInput.value === "__custom__") {
      els.modelCustomInput.classList.remove("hidden");
      els.modelCustomInput.focus();
    } else {
      els.modelCustomInput.classList.add("hidden");
      els.modelCustomInput.value = "";
    }
    const model = getSelectedModel();
    if (model) setStoredModel(state.provider, model);
  });

  els.modelCustomInput.addEventListener("input", () => {
    const model = getSelectedModel();
    if (model) setStoredModel(state.provider, model);
  });

  els.timerStart.addEventListener("click", () => timerStart());
  els.timerPause.addEventListener("click", () => timerPause());
  els.timerReset.addEventListener("click", () => timerReset());

  els.saveDraftBtn.addEventListener("click", () => saveDraft());
  els.clearBtn.addEventListener("click", () => {
    els.answerInput.value = "";
    els.draftStatus.textContent = "";
  });

  els.submitBtn.addEventListener("click", async () => {
    const q = getSelectedQuestion();
    if (!q) return;
    const answer = els.answerInput.value.trim();
    if (!answer) {
      renderResult({ score: 0, maxScore: q.points, rationale: "請先輸入答案。", strengths: [], missingPoints: [], improvements: [], suggestedOutline: [] });
      return;
    }

    const apiKey = getUiApiKey();
    const provider = normalizeProvider(state.provider);
    const cfg = PROVIDERS[provider] || PROVIDERS.openai;
    const envHasKey = Boolean(state.health?.env?.[provider] ?? state.health?.hasEnvApiKey ?? state.health?.hasApiKey);
    if (!apiKey && !envHasKey) {
      renderResult({
        score: 0,
        maxScore: q.points,
        rationale: `尚未設定 ${cfg.label} API key：請在左側輸入（或用環境變數 ${cfg.envVar}）。`,
        strengths: [],
        missingPoints: [],
        improvements: [],
        suggestedOutline: []
      });
      return;
    }

    saveDraft();
    timerPause();

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = "評分中...";
    try {
      const model = getSelectedModel();
      if (!model) throw new Error("請先選擇模型（或輸入自訂模型名稱）");
      const res = await apiPost("/api/grade", {
        setId: state.selectedSetId,
        questionId: q.id,
        provider,
        model,
        apiKey,
        answer,
        elapsedSeconds: Math.floor(state.timer.elapsedMs / 1000)
      });
      renderResult(res.result);
      pushHistory({
        at: Date.now(),
        setId: state.selectedSetId,
        setTitle: state.sets.find((s) => s.id === state.selectedSetId)?.title || state.selectedSetId,
        questionId: q.id,
        questionTitle: q.title,
        model,
        provider,
        score: res.result?.score ?? 0,
        maxScore: res.result?.maxScore ?? q.points,
        scoreRatio: (res.result?.score ?? 0) / (res.result?.maxScore ?? q.points),
        summary: res.result?.rationale?.slice(0, 120) || ""
      });
    } catch (e) {
      const rawMsg = String(e?.message || "未知錯誤");
      let hint = rawMsg;
      if (rawMsg.includes("Missing OPENAI_API_KEY")) {
        hint = "伺服器端仍是舊版，請在終端機按 Ctrl+C 停止後重新執行 `node server.js`，再重新整理此頁。";
      } else if (
        rawMsg.includes("Missing OpenAI API key") ||
        rawMsg.includes("Missing Google API key") ||
        rawMsg.includes("Missing Anthropic API key")
      ) {
        hint = "請在左側輸入對應供應商的 API key（或用對應的環境變數）。";
      }
      renderResult({ score: 0, maxScore: q.points, rationale: `評分失敗：${hint}`, strengths: [], missingPoints: [], improvements: [], suggestedOutline: [] });
    } finally {
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = "送出評分";
    }
  });
}

init();
