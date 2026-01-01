
/* grader.js - Client-side AI Logic */

// Default models
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GOOGLE_MODEL = "gemini-1.5-flash";
const DEFAULT_CLAUDE_MODEL = "claude-3-5-sonnet-20241022";

function clampNumber(n, min, max, fallback) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.min(max, Math.max(min, x));
}

function safeJsonParse(text) {
    if (typeof text !== "string") return null;
    const trimmed = text.trim();
    if (!trimmed) return null;
    try { return JSON.parse(trimmed); } catch { }
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch?.[1]) {
        try { return JSON.parse(fenceMatch[1].trim()); } catch { }
    }
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
        try { return JSON.parse(trimmed.slice(first, last + 1)); } catch { }
    }
    return null;
}

// ----------------------------------------------------------------------
// 1. Prompt Builder
// ----------------------------------------------------------------------

function buildGradingMessages({ question, answer, maxScore, elapsedSeconds }) {
    // Static version implies we don't have dynamic notes snippet access easily
    // unless we fetch them or embed them. For V1 static, we omit notesSnippet.

    const system = [
        "你是博士班資格考『研究法』閱卷老師，目標是幫考生用考試取向提升得分。",
        "請使用繁體中文回覆。",
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

    const outputContract = {
        score: "number (0..maxScore, preferably integer)",
        maxScore: "number",
        rationale: "string (總評，100~200字)",
        strengths: "string[]",
        missingPoints: "string[]",
        improvements: "string[]",
        suggestedOutline: "string[] (用可直接抄寫的答題段落骨架)",
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

// ----------------------------------------------------------------------
// 2. API Callers (Client-Side)
// ----------------------------------------------------------------------

async function callOpenAI({ apiKey, model, messages }) {
    if (!apiKey) throw new Error("Missing OpenAI API key");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: model || DEFAULT_OPENAI_MODEL,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages
        })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error?.message || `OpenAI API error (${res.status})`);
    }
    return data?.choices?.[0]?.message?.content || "";
}

async function callGoogle({ apiKey, model, system, user }) {
    if (!apiKey) throw new Error("Missing Google API key");

    const m = model || DEFAULT_GOOGLE_MODEL;
    // clean model name
    const safeModel = m.startsWith("models/") ? m.slice("models/".length) : m;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(safeModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
        throw new Error(data?.error?.message || `Google API error (${res.status})`);
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    return Array.isArray(parts) ? parts.map(p => p?.text).join("") : "";
}

async function callClaude({ apiKey, model, system, user }) {
    // Claude heavily restricts CORS calls from browser directly unless using a proxy.
    // BUT: Anthropic enabled CORS support recently for browser-based tools? 
    // Wait, Anthropic API does NOT support CORS for direct browser calls by default 
    // for security (to prevent leaking keys). However, users are pasting keys.
    // Actually, standard Anthropic API servers usually block browser requests due to CORS.
    // If this fails, we might warn user. 
    // UPDATE: Anthropic *does* support CORS if 'anthropic-dangerous-direct-browser-access': 'true' header is sent.

    if (!apiKey) throw new Error("Missing Anthropic API key");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true" // CRITICAL for static apps
        },
        body: JSON.stringify({
            model: model || DEFAULT_CLAUDE_MODEL,
            temperature: 0.2,
            max_tokens: 1400,
            system,
            messages: [{ role: "user", content: [{ type: "text", text: user }] }]
        })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error?.message || `Anthropic API error (${res.status})`);
    }

    const parts = data?.content;
    return Array.isArray(parts) ? parts.map(p => p?.text).join("") : "";
}

// ----------------------------------------------------------------------
// 3. Main Grade Function
// ----------------------------------------------------------------------

export async function gradeAnswer({ question, answer, provider, model, apiKey, elapsedSeconds }) {
    const maxScore = Number(question.points) || 0;

    const messages = buildGradingMessages({ question, answer, maxScore, elapsedSeconds });
    const system = messages[0].content;
    const user = messages[1].content;

    let raw = "";
    if (provider === "google") {
        raw = await callGoogle({ apiKey, model, system, user });
    } else if (provider === "claude") {
        raw = await callClaude({ apiKey, model, system, user });
    } else {
        raw = await callOpenAI({ apiKey, model, messages }); // Default to OpenAI
    }

    const parsed = safeJsonParse(raw);
    if (!parsed) {
        return {
            result: {
                score: 0,
                maxScore,
                rationale: "AI 回傳格式無法解析，請重試。",
                raw
            }
        };
    }

    // Normalize result
    parsed.maxScore = maxScore;
    parsed.score = Math.max(0, Math.min(maxScore, Number(parsed.score) || 0));

    // Fill arrays if missing
    ["strengths", "missingPoints", "improvements", "suggestedOutline"].forEach(k => {
        if (!Array.isArray(parsed[k])) parsed[k] = [];
    });

    return { result: parsed, raw };
}
