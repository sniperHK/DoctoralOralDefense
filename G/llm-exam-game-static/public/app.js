
import { gradeAnswer } from "./grader.js";

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
    timerReset: document.getElementById("timerReset"),
    randomBtn: document.getElementById("randomBtn"),
    exportHistoryBtn: document.getElementById("exportHistoryBtn")
};

const STORAGE_KEYS = {
    provider: "llm-exam-game:provider",
    rememberKey: "llm-exam-game:rememberKey",
    setId: "llm-exam-game:setId",
    questionId: "llm-exam-game:questionId",
    draftPrefix: "llm-exam-game:draft:",
    history: "llm-exam-game:history"
};

const PROVIDERS = {
    openai: {
        id: "openai",
        label: "OpenAI",
        keyPlaceholder: "sk-...",
        defaultModel: "gpt-4o-mini",
        models: [
            { value: "gpt-4o-mini", label: "gpt-4o-mini" },
            { value: "gpt-4o", label: "gpt-4o" }
        ]
    },
    google: {
        id: "google",
        label: "Google (Gemini)",
        keyPlaceholder: "AIza...",
        defaultModel: "gemini-1.5-flash",
        models: [
            { value: "gemini-1.5-flash", label: "gemini-1.5-flash" },
            { value: "gemini-1.5-pro", label: "gemini-1.5-pro" }
        ]
    },
    claude: {
        id: "claude",
        label: "Claude",
        keyPlaceholder: "sk-ant-...",
        defaultModel: "claude-3-5-sonnet-20241022",
        models: [
            { value: "claude-3-5-sonnet-20241022", label: "claude-3.5-sonnet" },
            { value: "claude-3-5-haiku-20241022", label: "claude-3.5-haiku" }
        ]
    }
};

let state = {
    sets: [],
    questions: [],
    selectedSetId: null,
    selectedQuestionId: null,
    provider: "openai",
    timer: { running: false, startedAtMs: null, elapsedMs: 0, tick: null }
};

// --- Utilities ---

function formatMs(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return `${m}:${s}`;
}

function setStatus(lines, tone = "info") {
    const header = tone === "ok" ? "✓" : tone === "warn" ? "!" : tone === "bad" ? "×" : "i";
    els.status.textContent = `${header} ${lines.join("\n")}`;
}

function normalizeProvider(value) {
    const v = String(value || "").toLowerCase().trim();
    if (v === "anthropic") return "claude";
    if (v in PROVIDERS) return v;
    return "openai";
}

function apiKeyStorageKey(provider) {
    return `llm-exam-game:apiKey:${provider}`;
}

// --- Logic ---

function updateProviderUi() {
    const provider = normalizeProvider(state.provider);
    const cfg = PROVIDERS[provider] || PROVIDERS.openai;

    els.apiKeyLabel.textContent = `${cfg.label} Key (Stored locally)`;
    els.apiKeyInput.placeholder = cfg.keyPlaceholder;

    // Restore key if remembered
    const savedKey = localStorage.getItem(apiKeyStorageKey(provider)) || "";
    els.apiKeyInput.value = savedKey;

    // Models
    els.modelInput.innerHTML = cfg.models
        .map(m => `<option value="${m.value}">${m.label}</option>`)
        .join("") + `<option value="__custom__">Custom...</option>`;

    els.modelInput.value = cfg.defaultModel;
}

async function loadData() {
    setStatus(["載入題庫中..."]);
    try {
        const res = await fetch("./data/sets.json");
        if (!res.ok) throw new Error("Failed to load sets.json");
        const json = await res.json();
        state.sets = json.sets || [];

        // Render sets
        els.setSelect.innerHTML = state.sets
            .map(s => `<option value="${s.id}">${s.title}</option>`)
            .join("");

        // Restore selection
        const savedSetId = localStorage.getItem(STORAGE_KEYS.setId);
        state.selectedSetId = state.sets.some(s => s.id === savedSetId) ? savedSetId : state.sets[0]?.id;
        els.setSelect.value = state.selectedSetId;

        await refreshQuestions();

        setStatus(["就緒 (Static Mode)"], "ok");
    } catch (e) {
        setStatus([`Error: ${e.message}`], "bad");
    }
}

async function refreshQuestions() {
    if (!state.selectedSetId) return;
    els.questionSelect.innerHTML = `<option>Loading...</option>`;

    try {
        const res = await fetch(`./data/${state.selectedSetId}.questions.json`);
        if (!res.ok) throw new Error("Questions file not found");
        const json = await res.json();
        state.questions = json.questions || [];

        els.questionSelect.innerHTML = state.questions
            .map(q => `<option value="${q.id}">${q.section} | ${q.points}pts | ${q.title}</option>`)
            .join("");

        const savedQ = localStorage.getItem(STORAGE_KEYS.questionId);
        state.selectedQuestionId = state.questions.some(q => q.id === savedQ) ? savedQ : state.questions[0]?.id;
        els.questionSelect.value = state.selectedQuestionId;

        renderQuestion();
    } catch (e) {
        els.questionSelect.innerHTML = `<option>Error loading questions</option>`;
    }
}


function randomQuestion() {
    if (!state.questions.length) return;
    const idx = Math.floor(Math.random() * state.questions.length);
    state.selectedQuestionId = state.questions[idx].id;
    els.questionSelect.value = state.selectedQuestionId;

    // Reset timer
    state.timer.running = false;
    state.timer.elapsedMs = 0;
    if (state.timer.tick) clearInterval(state.timer.tick);
    els.timerValue.textContent = "00:00";

    renderQuestion();
    loadDraft();
    saveLocalDefaults();
    setStatus(["已隨機選題！"], "ok");
}

function exportHistory() {
    const history = safeJsonParse(localStorage.getItem(STORAGE_KEYS.history) || "[]", []);
    if (!history.length) {
        alert("尚無紀錄可匯出。");
        return;
    }
    const text = JSON.stringify(history, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `llm-exam-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function renderQuestion() {
    const q = state.questions.find(x => x.id === state.selectedQuestionId);
    if (!q) {
        els.questionMeta.textContent = "";
        els.questionText.textContent = "";
        return;
    }
    els.questionMeta.textContent = `${q.section}｜${q.points} 分｜${q.title}`;
    els.questionText.textContent = q.text;

    // Load draft
    const draftKey = `${STORAGE_KEYS.draftPrefix}${state.selectedSetId}:${q.id}`;
    els.answerInput.value = localStorage.getItem(draftKey) || "";
    els.draftStatus.textContent = localStorage.getItem(draftKey) ? "Draft loaded." : "";
}

// --- Event Listeners ---

els.setSelect.addEventListener("change", async () => {
    state.selectedSetId = els.setSelect.value;
    localStorage.setItem(STORAGE_KEYS.setId, state.selectedSetId);
    await refreshQuestions();
    state.timer = { running: false, elapsedMs: 0 }; // Reset timer
    els.timerValue.textContent = "00:00";
});

els.questionSelect.addEventListener("change", () => {
    state.selectedQuestionId = els.questionSelect.value;
    localStorage.setItem(STORAGE_KEYS.questionId, state.selectedQuestionId);
    renderQuestion();
});

els.providerSelect.addEventListener("change", () => {
    state.provider = els.providerSelect.value;
    localStorage.setItem(STORAGE_KEYS.provider, state.provider);
    updateProviderUi();
});

els.apiKeyInput.addEventListener("input", () => {
    if (els.rememberKey.checked) {
        localStorage.setItem(apiKeyStorageKey(state.provider), els.apiKeyInput.value.trim());
    }
});

els.rememberKey.addEventListener("change", () => {
    localStorage.setItem(STORAGE_KEYS.rememberKey, els.rememberKey.checked ? "1" : "0");
    if (els.rememberKey.checked) {
        localStorage.setItem(apiKeyStorageKey(state.provider), els.apiKeyInput.value.trim());
    } else {
        localStorage.removeItem(apiKeyStorageKey(state.provider));
    }
});

els.saveDraftBtn.addEventListener("click", () => {
    if (!state.selectedSetId || !state.selectedQuestionId) return;
    const key = `${STORAGE_KEYS.draftPrefix}${state.selectedSetId}:${state.selectedQuestionId}`;
    localStorage.setItem(key, els.answerInput.value);
    els.draftStatus.textContent = "Saved.";
});

els.submitBtn.addEventListener("click", async () => {
    const q = state.questions.find(x => x.id === state.selectedQuestionId);
    if (!q) return;

    const apiKey = els.apiKeyInput.value.trim();
    if (!apiKey) {
        alert("Please enter an API Key first.");
        return;
    }

    const answer = els.answerInput.value.trim();
    if (!answer) {
        alert("Please write an answer.");
        return;
    }

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = "Grading...";

    try {
        const model = els.modelInput.value === "__custom__"
            ? els.modelCustomInput.value.trim()
            : els.modelInput.value;

        const { result, raw } = await gradeAnswer({
            question: q,
            answer,
            provider: state.provider,
            model,
            apiKey,
            elapsedSeconds: Math.floor(state.timer.elapsedMs / 1000)
        });

        renderResult(result);
        // Add history... (simplified for brevity)

    } catch (e) {
        els.result.textContent = `Error: ${e.message}`;
    } finally {
        els.submitBtn.disabled = false;
        els.submitBtn.textContent = "Submit for Grading";
    }
});

function renderResult(obj) {
    if (!obj) return;
    const lines = [`### Score: ${obj.score}/${obj.maxScore}`];
    lines.push(`\n**Rationale**:\n${obj.rationale}`);
    if (obj.strengths?.length) lines.push(`\n**Strengths**:\n- ${obj.strengths.join("\n- ")}`);
    if (obj.improvements?.length) lines.push(`\n**Improvements**:\n- ${obj.improvements.join("\n- ")}`);

    els.result.textContent = lines.join("\n");
    // Simple markdown-ish rendering could be added here if needed, 
    // but textContent preserves newlines which is okay for now.
}

// Timer Logic
els.timerStart.addEventListener("click", () => {
    if (state.timer.running) return;
    state.timer.running = true;
    state.timer.startedAtMs = Date.now();
    state.timer.tick = setInterval(() => {
        const total = state.timer.elapsedMs + (Date.now() - state.timer.startedAtMs);
        els.timerValue.textContent = formatMs(total);
    }, 250);
});

els.timerPause.addEventListener("click", () => {
    if (!state.timer.running) return;
    state.timer.running = false;
    clearInterval(state.timer.tick);
    state.timer.elapsedMs += (Date.now() - state.timer.startedAtMs);
});

els.timerReset.addEventListener("click", () => {
    state.timer.running = false;
    clearInterval(state.timer.tick);
    state.timer.elapsedMs = 0;
    els.timerValue.textContent = "00:00";
});

els.randomBtn.addEventListener("click", () => randomQuestion());
if (els.exportHistoryBtn) els.exportHistoryBtn.addEventListener("click", () => exportHistory());

// Init
state.provider = localStorage.getItem(STORAGE_KEYS.provider) || "openai";
els.providerSelect.value = state.provider;
els.rememberKey.checked = localStorage.getItem(STORAGE_KEYS.rememberKey) === "1";
loadData();
