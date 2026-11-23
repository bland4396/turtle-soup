import type { FeedItem, Puzzle, VerdictType } from './types.js';

export interface QuestionJudgeResult {
  verdict: VerdictType;
  verdictLabel: string;
  aiReply: string;
}

export interface GuessJudgeResult {
  score: number;
  solved: boolean;
  aiReply: string;
  matchedClues: string[];
  missedHint: string;
}

const VERDICT_LABELS: Record<VerdictType, string> = {
  yes: '是',
  no: '不是',
  irrelevant: '无关',
  close: '关键线索！',
  partial: '是也不是',
};

export function getGeminiConfig() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const model = (process.env.GEMINI_MODEL || 'gemini-3-flash-preview').trim();
  return {
    apiKey,
    model,
    enabled: apiKey.length > 0,
  };
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
}

const FALLBACK_MODELS = [
  'gemini-3-flash-preview',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

async function callGeminiJson(
  systemInstruction: string,
  userPrompt: string,
  temperature = 0.35
): Promise<Record<string, unknown>> {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
  }

  const candidates = Array.from(new Set([model, ...FALLBACK_MODELS]));
  let lastError: Error | null = null;

  for (const currentModel of candidates) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      currentModel
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const retriable = res.status === 503 || res.status === 429 || res.status === 404 || res.status >= 500;
        lastError = new Error(`Gemini (${currentModel}) HTTP ${res.status}: ${errText.slice(0, 200)}`);
        if (retriable) {
          console.warn(`[Gemini] ${currentModel} unavailable (${res.status}), trying next fallback...`);
          continue;
        }
        throw lastError;
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = new Error(`Gemini (${currentModel}) returned empty content`);
        continue;
      }

      return extractJsonObject(text);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Gemini] ${currentModel} error: ${lastError.message}`);
    }
  }

  throw lastError || new Error('所有 Gemini 备用模型暂时均不可用，请稍后重试');
}

function normalizeVerdict(raw: unknown): VerdictType {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'yes' || v === 'no' || v === 'irrelevant' || v === 'close' || v === 'partial') {
    return v;
  }
  return 'irrelevant';
}

function demoJudgeQuestion(puzzle: Puzzle, question: string): QuestionJudgeResult {
  const q = question.toLowerCase();
  const truth = puzzle.truth.toLowerCase();
  const tokens = q
    .replace(/[？?！!。，,、\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  let hits = 0;
  for (const clue of puzzle.keyClues) {
    const c = clue.toLowerCase();
    for (let i = 0; i < q.length - 1; i++) {
      const bi = q.slice(i, i + 2);
      if (/^[\u4e00-\u9fa5a-z0-9]{2}$/.test(bi) && c.includes(bi)) {
        hits++;
      }
    }
  }
  if (hits >= 3) {
    return {
      verdict: 'close',
      verdictLabel: VERDICT_LABELS.close,
      aiReply: '（本地演示模式）你已经摸到关键方向了！配置 GEMINI_API_KEY 后将由 Gemini 精准裁判。',
    };
  }
  const hasMatch = tokens.some((t) => truth.includes(t)) || hits >= 1;
  if (hasMatch) {
    return {
      verdict: 'yes',
      verdictLabel: VERDICT_LABELS.yes,
      aiReply: '（本地演示模式）方向没错，顺着这个线索继续追问！',
    };
  }
  return {
    verdict: 'no',
    verdictLabel: VERDICT_LABELS.no,
    aiReply: '（本地演示模式）不对哦，换个角度想想看。',
  };
}

export async function judgeQuestion(
  puzzle: Puzzle,
  question: string,
  recentFeed: FeedItem[]
): Promise<QuestionJudgeResult> {
  const { enabled } = getGeminiConfig();
  if (!enabled) {
    return demoJudgeQuestion(puzzle, question);
  }

  const historyText = recentFeed
    .filter((f) => f.type === 'question')
    .slice(-10)
    .map((f) => `- 玩家问：${f.content} -> 判定：${f.verdictLabel || ''}`)
    .join('\n');

  const systemInstruction = `你是“午夜海龟汤”游戏的主持人，风格神秘、幽默、简练。
你的任务是根据【汤面】和【汤底】，严格判断玩家提出的是非题。

必须遵守的铁律：
1. 绝对不能直接剧透汤底里的未揭露细节！
2. 只能从以下 5 种 verdict 中选一个：
   - "yes": 符合汤底事实
   - "no": 与汤底事实不符
   - "irrelevant": 与核心推理无关
   - "close": 玩家精准踩中了非常核心的关键线索且方向正确（给玩家惊喜感！）
   - "partial": 问法含糊、包含两半一真一假、或“是也不是”
3. aiReply 用中文写一句简短的氛围点评（12~35字以内），严禁泄露任何玩家还没问出来的汤底关键词。
4. 严格输出 JSON：{"verdict":"yes|no|irrelevant|close|partial","aiReply":"..."}`;

  const userPrompt = `【题目标题】${puzzle.title}
【汤面】${puzzle.surface}
【汤底】${puzzle.truth}
【关键线索点】
${puzzle.keyClues.map((c, i) => `${i + 1}. ${c}`).join('\n')}

【近期问答参考】
${historyText || '（暂无）'}

【玩家本次提问】
${question}`;

  const json = await callGeminiJson(systemInstruction, userPrompt, 0.3);
  const verdict = normalizeVerdict(json.verdict);
  const aiReply =
    typeof json.aiReply === 'string' && json.aiReply.trim()
      ? json.aiReply.trim()
      : '灯影摇曳，主持人微微点了点头。';

  return {
    verdict,
    verdictLabel: VERDICT_LABELS[verdict],
    aiReply,
  };
}

export async function judgeGuess(puzzle: Puzzle, guess: string): Promise<GuessJudgeResult> {
  const { enabled } = getGeminiConfig();
  if (!enabled) {
    let hitCount = 0;
    const matched: string[] = [];
    for (const clue of puzzle.keyClues) {
      let overlap = 0;
      for (let i = 0; i < clue.length - 1; i++) {
        const bi = clue.slice(i, i + 2);
        if (/^[\u4e00-\u9fa5a-z0-9]{2}$/.test(bi) && guess.includes(bi)) {
          overlap++;
        }
      }
      if (overlap >= 2) {
        hitCount++;
        matched.push(clue);
      }
    }
    const score = Math.min(100, Math.round((hitCount / Math.max(1, puzzle.keyClues.length)) * 100));
    const solved = score >= 75;
    return {
      score,
      solved,
      matchedClues: matched,
      missedHint: solved ? '' : '（本地演示模式）还差一点核心反转，再问几个是非题试试！',
      aiReply: solved
        ? '（本地演示模式）恭喜喝汤！你已经还原了核心真相！'
        : `（本地演示模式）当前还原度约 ${score}%，配置 GEMINI_API_KEY 后可获得精准语义评分。`,
    };
  }

  const systemInstruction = `你是“午夜海龟汤”游戏裁判。玩家提交了他们猜测的完整【汤底推理】，你需要对照标准【汤底】和【关键线索点】进行语义评分（不要求字面一致，意思对即可）。

评分标准：
- score: 0 到 100 的整数。
- solved: 布尔值。只要玩家推理出了最核心的因果反转真相（通常 score >= 80），就判定 solved = true。
- matchedClues: 字符串数组，列出玩家已经猜中的关键点（用简短中文概括；注意：只写玩家已经说出来的，绝不剧透没猜到的！）。
- missedHint: 如果 solved 为 false，给一句不剧透的方向性小提醒（如“你猜到了职业，但还没解释为什么会出事”）；如果 solved 为 true，返回空字符串。
- aiReply: 简短点评（20~50字），若 solved 为 true 要热情祝贺“喝汤成功”。

严格输出 JSON：
{"score":85,"solved":true,"matchedClues":["..."],"missedHint":"","aiReply":"..."}`;

  const userPrompt = `【汤面】${puzzle.surface}
【标准汤底】${puzzle.truth}
【关键线索点】
${puzzle.keyClues.map((c, i) => `${i + 1}. ${c}`).join('\n')}

【玩家提交的推理】
${guess}`;

  const json = await callGeminiJson(systemInstruction, userPrompt, 0.25);
  const score = Math.max(0, Math.min(100, Math.round(Number(json.score) || 0)));
  const solved = Boolean(json.solved) || score >= 85;
  const matchedClues = Array.isArray(json.matchedClues)
    ? json.matchedClues.map((x) => String(x)).slice(0, 6)
    : [];
  const missedHint = typeof json.missedHint === 'string' ? json.missedHint.trim() : '';
  const aiReply =
    typeof json.aiReply === 'string' && json.aiReply.trim()
      ? json.aiReply.trim()
      : solved
        ? '恭喜喝汤！真相已经水落石出！'
        : '距离真相还差临门一脚，再捋一捋细节！';

  return {
    score,
    solved,
    matchedClues,
    missedHint: solved ? '' : missedHint,
    aiReply,
  };
}

export async function generateHint(
  puzzle: Puzzle,
  hintIndex: number,
  recentFeed: FeedItem[]
): Promise<string> {
  const fallbackHint =
    puzzle.hints[Math.min(hintIndex, puzzle.hints.length - 1)] ||
    '试着关注汤面里最反常的那个细节，问问它的原因。';

  const { enabled } = getGeminiConfig();
  if (!enabled) {
    return fallbackHint;
  }

  const historyText = recentFeed
    .filter((f) => f.type === 'question')
    .slice(-12)
    .map((f) => `- ${f.content} (${f.verdictLabel || ''})`)
    .join('\n');

  const systemInstruction = `你是海龟汤主持人。玩家卡关请求第 ${hintIndex + 1} 条提示（共 3 条，越往后越具体，但绝不能直接说出完整汤底）。
结合玩家已经问过的问题，给出一条尚未被发现的思考方向提示（20~45字中文）。
严格输出 JSON：{"hint":"..."}`;

  const userPrompt = `【汤面】${puzzle.surface}
【汤底】${puzzle.truth}
【参考渐进提示】${fallbackHint}
【玩家已问问题】
${historyText || '（暂无）'}`;

  try {
    const json = await callGeminiJson(systemInstruction, userPrompt, 0.45);
    if (typeof json.hint === 'string' && json.hint.trim()) {
      return json.hint.trim();
    }
  } catch {
    // fallback to curated hint
  }
  return fallbackHint;
}

export async function generateNewPuzzle(theme?: string, difficulty: 1 | 2 | 3 = 2): Promise<Puzzle> {
  const { enabled } = getGeminiConfig();
  if (!enabled) {
    throw new Error('请先在 .env 中配置 GEMINI_API_KEY，才能使用「AI 现编新汤」功能');
  }

  const diffLabel = difficulty === 1 ? '简单入门' : difficulty === 3 ? '高难烧脑' : '中等适度';
  const themePrompt = theme?.trim() ? `主题方向：${theme.trim()}` : '主题随机（悬疑反转、生活脑洞或温情奇谭均可，不要血腥猎奇）';

  const systemInstruction = `你是一位顶级的海龟汤（情境推理）出题大师。
请原创一道逻辑极其严密、反转拍案叫绝、适合微信好友群一起玩的中文海龟汤。
要求：
1. 汤面简短吊胃口（40~110字），有明显反常点，但绝不给多余废话。
2. 汤底逻辑自洽、合情合理、不依赖超自然鬼神（除非主题明确要求），反转令人恍然大悟（80~180字）。
3. 提供 3~4 条 keyClues（关键线索点）和 3 条由浅入深的 hints（渐进提示）。
严格输出 JSON：
{
  "title": "4~8字标题",
  "surface": "汤面",
  "truth": "汤底",
  "keyClues": ["线索1","线索2","线索3"],
  "hints": ["提示1","提示2","提示3"]
}`;

  const userPrompt = `难度：${diffLabel}
${themePrompt}
请现在创作一锅全新的海龟汤！`;

  const json = await callGeminiJson(systemInstruction, userPrompt, 0.9);
  const title = String(json.title || '午夜奇案').trim().slice(0, 20);
  const surface = String(json.surface || '').trim();
  const truth = String(json.truth || '').trim();
  const keyClues = Array.isArray(json.keyClues)
    ? json.keyClues.map((x) => String(x).trim()).filter(Boolean).slice(0, 5)
    : ['核心反转真相'];
  const hints = Array.isArray(json.hints)
    ? json.hints.map((x) => String(x).trim()).filter(Boolean).slice(0, 3)
    : ['仔细读一读汤面中最反常的那个细节。'];

  if (!surface || !truth) {
    throw new Error('AI 生成的题目不完整，请再试一次');
  }

  return {
    id: `ai-${Date.now().toString(36)}`,
    title,
    category: 'AI现编',
    difficulty,
    surface,
    truth,
    keyClues,
    hints,
    tags: ['AI原创', theme?.trim() || '随机脑洞'],
  };
}
