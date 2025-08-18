// llm.bot.js（差し替え版・安全ガード＋DEBUGログ）
const logger = require('./mafia.logger.js');
const loglevel = logger.getLogLevels(); // { ERROR, IMPORTANT, NORMAL, VERBOSE, DEBUG }

// Node18+ の fetch を使用（Node18未満なら node-fetch@2 を導入し、下行を有効化）
// const fetch = require('node-fetch');

function asInt(s) {
  const n = parseInt(String(s).trim(), 10);
  return Number.isFinite(n) ? n : NaN;
}
function clipIndex(i, len) {
  if (!Number.isFinite(i) || len <= 0) return 0;
  if (i < 0) return 0;
  if (i >= len) return len - 1;
  return i;
}

async function queryLLM(payload) {
  const endpoint = process.env.LLM_BOT_ENDPOINT;
  if (!endpoint) {
    logger.log("[LLM] endpoint not set", loglevel.VERBOSE);
    return {};
  }
  try {
    logger.log("[LLM] request payload:", JSON.stringify(payload), loglevel.VERBOSE);

    const res = await fetch(endpoint, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.LLM_BOT_API_KEY}`
    },
    body: JSON.stringify({
        model: process.env.LLM_MODEL || "gpt-4o-mini",
        messages: [
        { role: "system", content: "You are a helpful assistant for Mafia game." },
        { role: "user", content: JSON.stringify(payload) }
        ]
    })
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { text }; }

    logger.log("[LLM] raw response:", JSON.stringify(data), loglevel.VERBOSE);
    return data || {};
  } catch (e) {
    logger.log("[LLM] error: " + e.toString(), loglevel.VERBOSE);
    return {};
  }
}

// ── 夜の行動 ───────────────────────────────────────────────
// 期待: ゲーム側は戻り値に対して .action を読む可能性があるため null は絶対返さない。
async function decideNightAction(gameState, actions) {
  // actions は配列（オブジェクト or 文字列）想定
  logger.log("[LLM] decideNightAction ctx.actions=", JSON.stringify(actions), loglevel.VERBOSE);

  const payload = {
    task: "night",
    context: { gameState, actions }
  };
  const llm = await queryLLM(payload);

  // LLMがJSONで {action: <index or id>, target1, target2} を返してくる場合を優先
  if (llm && typeof llm === "object" && (llm.action !== undefined || llm.index !== undefined)) {
    // index 指定ならインデックスで、id指定なら一致検索
    if (llm.index !== undefined) {
      const idx = clipIndex(asInt(llm.index), actions.length);
      const picked = normalizeAction(actions[idx]);
      logger.log("[LLM] night (json.index) -> " + JSON.stringify(picked), loglevel.VERBOSE);
      return picked;
    }
    if (llm.action !== undefined) {
      // id/名前指定の可能性
      const picked = pickByIdOrName(actions, llm.action, llm.target1, llm.target2);
      logger.log("[LLM] night (json.action) -> " + JSON.stringify(picked), loglevel.VERBOSE);
      return picked;
    }
  }

  // 単なるテキスト（インデックス）で返ってくる場合
  const idx = clipIndex(asInt(llm.reply ?? llm.text), actions.length);
  const picked = normalizeAction(actions[idx]);
  logger.log("[LLM] night (text/index) -> " + JSON.stringify(picked), loglevel.VERBOSE);
  return picked;
}

// ── 昼の発言 ───────────────────────────────────────────────
async function generateChat(gameState, history) {
  const payload = { task: "chat", context: { gameState, history } };
  const llm = await queryLLM(payload);

  const text = String(llm.reply ?? llm.text ?? "").trim();
  logger.log("[LLM] generateChat -> " + text, loglevel.VERBOSE);
  return text || ""; // 空文字でもオブジェクト期待ではないのでOK
}

// ── 投票 ───────────────────────────────────────────────
// 期待: ゲーム側は .uniqueid を読む想定が多いので、必ず { uniqueid } 形で返す。
//      null は返さない。
async function decideVote(gameState, candidates) {
  logger.log("[LLM] decideVote candidates=", JSON.stringify(candidates), loglevel.VERBOSE);

  const payload = { task: "vote", context: { gameState, candidates } };
  const llm = await queryLLM(payload);

  // JSONで {index} or {uniqueid/name} が来るケース
  if (llm && typeof llm === "object" && (llm.index !== undefined || llm.uniqueid !== undefined || llm.name !== undefined)) {
    if (llm.index !== undefined) {
      const idx = clipIndex(asInt(llm.index), candidates.length);
      const out = normalizeVote(candidates[idx]);
      logger.log("[LLM] vote (json.index) -> " + JSON.stringify(out), loglevel.VERBOSE);
      return out;
    }
    if (llm.uniqueid !== undefined || llm.name !== undefined) {
      const out = pickVoteByIdOrName(candidates, llm.uniqueid, llm.name);
      logger.log("[LLM] vote (json.id/name) -> " + JSON.stringify(out), loglevel.VERBOSE);
      return out;
    }
  }

  // テキスト（インデックス）
  const idx = clipIndex(asInt(llm.reply ?? llm.text), candidates.length);
  const out = normalizeVote(candidates[idx]);
  logger.log("[LLM] vote (text/index) -> " + JSON.stringify(out), loglevel.VERBOSE);
  return out;
}

// ── ヘルパ ───────────────────────────────────────────────
function normalizeAction(x) {
  // ゲーム側が .action を読むので、必ず {action, target1?, target2?} を返す
  if (!x) return {}; // ← null を返さないのが重要。{} なら .action は undefined で落ちない。
  if (typeof x === "string") return { action: x };
  if (typeof x === "object") {
    // すでに {action, target1, target2} 形式ならそれを返す。念のため action を保証。
    if (x.action !== undefined) return x;
    // 別名キーを推定（id/name/type など）
    const cand = x.id ?? x.name ?? x.type ?? x.actionType;
    return { action: cand, target1: x.target1, target2: x.target2 };
  }
  return {};
}

function pickByIdOrName(list, key, t1, t2) {
  const s = String(key).trim().toLowerCase();
  const found = list.find(a => {
    if (!a) return false;
    const id = (a.id ?? a.action ?? a.name ?? a.type ?? "").toString().toLowerCase();
    return id === s;
  });
  const picked = normalizeAction(found || list[0]);
  if (t1 !== undefined) picked.target1 = t1;
  if (t2 !== undefined) picked.target2 = t2;
  return picked;
}

function normalizeVote(c) {
  // 候補オブジェクトから uniqueid を引く。なければ name などから生成しないで undefined 許容。
  if (!c) return { uniqueid: undefined };
  if (typeof c === "object") return { uniqueid: c.uniqueid ?? c.id ?? c.uid };
  // 文字列しかない場合は undefined（ゲーム側で無視される想定）
  return { uniqueid: undefined };
}

function pickVoteByIdOrName(candidates, uid, name) {
  if (uid !== undefined) {
    const m = candidates.find(c => (c?.uniqueid ?? c?.id ?? c?.uid) == uid);
    return normalizeVote(m || candidates[0]);
  }
  if (name !== undefined) {
    const s = String(name).trim().toLowerCase();
    const m = candidates.find(c => (c?.name ?? "").toLowerCase() === s);
    return normalizeVote(m || candidates[0]);
  }
  return normalizeVote(candidates[0]);
}

module.exports = {
  decideNightAction,
  generateChat,
  decideVote
};
