import React, { useEffect, useRef, useState } from 'react';
import {
  Share2,
  Check,
  Users,
  Lightbulb,
  BookOpen,
  Send,
  ChevronDown,
  ChevronUp,
  LogOut,
  Sparkles,
  MessageCircle,
  Target,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import type { FeedItem, PuzzleSummary, RoomSnapshot, VerdictType } from '../types';
import type { NextRoundPayload } from '../hooks/useRoomSocket';
import { PuzzleModal } from './PuzzleModal';

interface GameRoomProps {
  snapshot: RoomSnapshot;
  connected: boolean;
  playerId: string | null;
  puzzles: PuzzleSummary[];
  onAsk: (content: string) => void;
  onGuess: (content: string) => void;
  onChat: (content: string) => void;
  onHint: () => void;
  onReveal: () => void;
  onNextRound: (payload: NextRoundPayload) => void;
  onLeave: () => void;
}

const VERDICT_STYLE: Record<VerdictType, { badge: string; icon: string }> = {
  yes: {
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: '✅',
  },
  no: {
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    icon: '❌',
  },
  irrelevant: {
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/35',
    icon: '🟡',
  },
  close: {
    badge: 'bg-amber-500/25 text-amber-200 border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.28)]',
    icon: '🔥',
  },
  partial: {
    badge: 'bg-purple-500/20 text-purple-200 border-purple-400/40',
    icon: '🤔',
  },
};

function copyTextFallback(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export const GameRoom: React.FC<GameRoomProps> = ({
  snapshot,
  connected,
  playerId,
  puzzles,
  onAsk,
  onGuess,
  onChat,
  onHint,
  onReveal,
  onNextRound,
  onLeave,
}) => {
  const [inputMode, setInputMode] = useState<'ask' | 'guess' | 'chat'>('ask');
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [soupCollapsed, setSoupCollapsed] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const [showPuzzleModal, setShowPuzzleModal] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [snapshot.feed.length, snapshot.aiBusy, snapshot.status]);

  useEffect(() => {
    if (!confirmReveal) return;
    const t = window.setTimeout(() => setConfirmReveal(false), 3500);
    return () => window.clearTimeout(t);
  }, [confirmReveal]);

  const handleCopyInvite = async () => {
    const url = `${window.location.origin}/?room=${snapshot.roomCode}`;
    const invite = `🐢【AI 海龟汤开局】正在盘《${snapshot.puzzle.title}》\n房间号：${snapshot.roomCode}\n点击直接进房一起破案 👉 ${url}`;
    let ok = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(invite);
        ok = true;
      } catch {
        ok = copyTextFallback(invite);
      }
    } else {
      ok = copyTextFallback(invite);
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    if (inputMode === 'ask') {
      if (snapshot.status !== 'playing' || snapshot.aiBusy) return;
      onAsk(clean);
    } else if (inputMode === 'guess') {
      if (snapshot.status !== 'playing' || snapshot.aiBusy) return;
      onGuess(clean);
    } else {
      onChat(clean);
    }
    setText('');
  };

  const isPlaying = snapshot.status === 'playing';
  const hintsLeft = Math.max(0, snapshot.maxHints - snapshot.hintsUsed);

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto">
      {/* Top Header */}
      <header className="shrink-0 sticky top-0 z-20 px-3 py-2.5 bg-ink-950/90 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onLeave}
              title="返回大厅"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-bold text-amber-300">
                  #{snapshot.roomCode}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    connected ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'
                  }`}
                />
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                  第 {snapshot.round} 锅
                </span>
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {snapshot.aiMode === 'gemini' ? `Gemini · ${snapshot.modelName}` : '本地演示模式'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowPlayers((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 transition"
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>{snapshot.players.length}</span>
            </button>
            <button
              onClick={handleCopyInvite}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/15 text-amber-200 border-amber-500/35 hover:bg-amber-500/25'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制群邀请' : '邀群友'}</span>
            </button>
            <button
              onClick={() => setShowPuzzleModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">换汤</span>
            </button>
          </div>
        </div>

        {/* Online players dropdown */}
        {showPlayers && (
          <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
            {snapshot.players.map((p) => (
              <span
                key={p.id}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${
                  p.id === playerId
                    ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
                    : 'bg-ink-900 text-slate-300 border-white/10'
                }`}
              >
                <span>{p.avatar}</span>
                <span>{p.name}</span>
                {p.isHost && <span className="text-[10px] text-amber-400">房主</span>}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Pinned Soup Surface Card */}
      <section className="shrink-0 px-3 pt-3">
        <div className="rounded-2xl bg-gradient-to-b from-ink-900/95 to-ink-900/80 border border-amber-500/25 shadow-lantern overflow-hidden">
          <button
            type="button"
            onClick={() => setSoupCollapsed((v) => !v)}
            className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-white/[0.02] transition"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">🍲</span>
              <span className="font-semibold text-sm sm:text-base text-amber-100 truncate">
                《{snapshot.puzzle.title}》
              </span>
              <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                {snapshot.puzzle.category}
              </span>
              <span className="shrink-0 text-[11px] text-amber-400 hidden sm:inline">
                {'★'.repeat(snapshot.puzzle.difficulty)}
                {'☆'.repeat(3 - snapshot.puzzle.difficulty)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
              <span>已问 {snapshot.questionCount} 题</span>
              {soupCollapsed ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </div>
          </button>

          {!soupCollapsed && (
            <div className="px-4 pb-3.5 pt-0.5">
              <p className="text-sm sm:text-[15px] text-slate-100 leading-relaxed tracking-wide">
                {snapshot.puzzle.surface}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Live Q&A Feed */}
      <main className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {snapshot.feed.map((item) => (
          <FeedCard key={item.id} item={item} isMe={item.playerId === playerId} />
        ))}

        {/* AI thinking indicator */}
        {snapshot.aiBusy && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 animate-pulse">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{snapshot.aiBusyText || 'AI 主持人正在思考...'}</span>
          </div>
        )}

        {/* Truth Revealed Banner */}
        {!isPlaying && snapshot.puzzle.truth && (
          <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 via-ink-900 to-emerald-500/10 border border-amber-400/50 p-4 space-y-3 shadow-lantern">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{snapshot.status === 'solved' ? '🎉' : '📖'}</span>
                <div>
                  <h3 className="font-bold text-base text-amber-200">
                    {snapshot.status === 'solved' ? '喝汤成功！真相大白' : '汤底已揭晓'}
                  </h3>
                  {snapshot.winnerName && (
                    <p className="text-xs text-emerald-300">破案功臣：{snapshot.winnerName}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowPuzzleModal(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 text-ink-950 font-semibold text-xs hover:bg-amber-400 transition"
              >
                再来一锅 🍲
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-ink-950/75 border border-white/10 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                完整汤底
              </div>
              <p className="text-sm text-slate-100 leading-relaxed">{snapshot.puzzle.truth}</p>
            </div>

            {snapshot.puzzle.keyClues && snapshot.puzzle.keyClues.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400">核心线索复盘：</div>
                <div className="flex flex-wrap gap-1.5">
                  {snapshot.puzzle.keyClues.map((clue, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200"
                    >
                      {idx + 1}. {clue}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={feedEndRef} />
      </main>

      {/* Bottom Sticky Controls */}
      <footer className="shrink-0 bg-ink-950/95 backdrop-blur-md border-t border-white/10 px-3 pt-2.5 safe-bottom space-y-2">
        {/* Mode Switcher & Quick Actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex p-0.5 rounded-xl bg-ink-900 border border-white/10">
            <button
              type="button"
              onClick={() => setInputMode('ask')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                inputMode === 'ask'
                  ? 'bg-amber-500 text-ink-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              问是非题
            </button>
            <button
              type="button"
              onClick={() => setInputMode('guess')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                inputMode === 'guess'
                  ? 'bg-emerald-500 text-ink-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              猜汤底
            </button>
            <button
              type="button"
              onClick={() => setInputMode('chat')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                inputMode === 'chat'
                  ? 'bg-sky-500 text-ink-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              讨论
            </button>
          </div>

          {isPlaying ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={snapshot.aiBusy || hintsLeft <= 0}
                onClick={onHint}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs text-amber-200 disabled:opacity-40 transition"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>提示({hintsLeft})</span>
              </button>
              <button
                type="button"
                disabled={snapshot.aiBusy}
                onClick={() => {
                  if (!confirmReveal) {
                    setConfirmReveal(true);
                  } else {
                    setConfirmReveal(false);
                    onReveal();
                  }
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs transition ${
                  confirmReveal
                    ? 'bg-rose-500 text-white border-rose-400 font-semibold'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{confirmReveal ? '确认揭晓?' : '看汤底'}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPuzzleModal(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 text-ink-950 font-semibold text-xs hover:bg-amber-400 transition"
            >
              🍲 换一锅新汤
            </button>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={inputMode !== 'chat' && (!isPlaying || snapshot.aiBusy)}
            placeholder={
              inputMode === 'ask'
                ? isPlaying
                  ? '向 AI 提一个是非题（如：死者和餐厅老板认识吗？）'
                  : '本锅已结束，可切换“讨论”聊天或换一锅新汤'
                : inputMode === 'guess'
                  ? '写出你推理出的完整真相，AI 会计算还原度...'
                  : '和房间里的群友自由讨论线索（不触发 AI）...'
            }
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!text.trim() || (inputMode !== 'chat' && (!isPlaying || snapshot.aiBusy))}
            className={`shrink-0 px-3.5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-1 transition disabled:opacity-40 ${
              inputMode === 'guess'
                ? 'bg-emerald-500 text-ink-950 hover:bg-emerald-400'
                : inputMode === 'chat'
                  ? 'bg-sky-500 text-ink-950 hover:bg-sky-400'
                  : 'bg-amber-500 text-ink-950 hover:bg-amber-400'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>

      <PuzzleModal
        open={showPuzzleModal}
        puzzles={puzzles}
        aiEnabled={snapshot.aiMode === 'gemini'}
        busy={snapshot.aiBusy}
        onClose={() => setShowPuzzleModal(false)}
        onSelect={onNextRound}
      />
    </div>
  );
};

const FeedCard: React.FC<{ item: FeedItem; isMe: boolean }> = ({ item, isMe }) => {
  if (item.type === 'system') {
    return (
      <div className="flex justify-center">
        <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/5 text-[11px] text-slate-400 text-center">
          {item.content}
        </span>
      </div>
    );
  }

  if (item.type === 'hint') {
    return (
      <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
          <Lightbulb className="w-3.5 h-3.5" />
          <span>
            AI 主持人提示（由 {item.playerAvatar} {item.playerName} 请求）
          </span>
        </div>
        <p className="text-sm text-amber-100 leading-relaxed">{item.content}</p>
      </div>
    );
  }

  if (item.type === 'chat') {
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[82%] rounded-2xl px-3.5 py-2 border text-sm ${
            isMe
              ? 'bg-sky-500/15 border-sky-400/30 text-sky-100'
              : 'bg-ink-900 border-white/10 text-slate-200'
          }`}
        >
          <div className="text-[11px] text-slate-400 mb-0.5">
            {item.playerAvatar} {item.playerName} · 群内讨论
          </div>
          <p className="leading-relaxed break-words">{item.content}</p>
        </div>
      </div>
    );
  }

  if (item.type === 'guess') {
    const score = item.score ?? 0;
    return (
      <div className="rounded-2xl bg-ink-900/95 border border-emerald-500/30 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
            <span>{item.playerAvatar}</span>
            <span>{item.playerName}</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px]">
              提交汤底推理
            </span>
          </div>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              item.solved
                ? 'bg-emerald-500 text-ink-950'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
            }`}
          >
            还原度 {score}%
          </span>
        </div>

        <p className="text-sm text-slate-100 leading-relaxed bg-ink-950/70 rounded-xl p-2.5 border border-white/5">
          {item.content}
        </p>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              item.solved ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-500 to-emerald-400'
            }`}
            style={{ width: `${Math.max(4, score)}%` }}
          />
        </div>

        <div className="text-xs text-amber-100/90 leading-relaxed">
          <span className="text-amber-400 font-semibold">🐢 主持人：</span>
          {item.aiReply}
        </div>

        {item.matchedClues && item.matchedClues.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.matchedClues.map((c, i) => (
              <span
                key={i}
                className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-200 border border-emerald-500/25"
              >
                ✓ {c}
              </span>
            ))}
          </div>
        )}

        {item.missedHint && !item.solved && (
          <div className="text-[11px] text-slate-400">💡 方向提醒：{item.missedHint}</div>
        )}
      </div>
    );
  }

  // Default: question
  const style = VERDICT_STYLE[item.verdict || 'irrelevant'];
  return (
    <div className="rounded-2xl bg-ink-900/90 border border-white/10 p-3.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>{item.playerAvatar}</span>
            <span className={isMe ? 'text-amber-200 font-medium' : 'text-slate-300'}>
              {item.playerName}
            </span>
          </div>
          <p className="text-sm text-white leading-relaxed break-words">{item.content}</p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.badge}`}
        >
          <span>{style.icon}</span>
          <span>{item.verdictLabel}</span>
        </span>
      </div>

      {item.aiReply && (
        <div className="pt-2 border-t border-white/5 text-xs text-slate-300 leading-relaxed">
          <span className="text-amber-400/90 font-medium">🐢 主持人：</span>
          {item.aiReply}
        </div>
      )}
    </div>
  );
};
