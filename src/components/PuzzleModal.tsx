import React, { useMemo, useState } from 'react';
import { Sparkles, Shuffle, BookOpen, PenTool, X } from 'lucide-react';
import type { PuzzleSummary } from '../types';
import type { NextRoundPayload } from '../hooks/useRoomSocket';

interface PuzzleModalProps {
  open: boolean;
  puzzles: PuzzleSummary[];
  aiEnabled: boolean;
  busy?: boolean;
  onClose: () => void;
  onSelect: (payload: NextRoundPayload) => void;
}

const CATEGORIES = ['全部', '悬疑推理', '细思极恐', '温情反转', '脑洞奇谭'] as const;

export const PuzzleModal: React.FC<PuzzleModalProps> = ({
  open,
  puzzles,
  aiEnabled,
  busy,
  onClose,
  onSelect,
}) => {
  const [tab, setTab] = useState<'builtin' | 'ai' | 'custom'>('builtin');
  const [category, setCategory] = useState<string>('全部');
  const [aiTheme, setAiTheme] = useState('');
  const [aiDifficulty, setAiDifficulty] = useState<1 | 2 | 3>(2);
  const [customTitle, setCustomTitle] = useState('');
  const [customSurface, setCustomSurface] = useState('');
  const [customTruth, setCustomTruth] = useState('');

  const filtered = useMemo(() => {
    if (category === '全部') return puzzles;
    return puzzles.filter((p) => p.category === category);
  }, [puzzles, category]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="relative w-full max-w-lg max-h-[86vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-ink-900 border border-amber-500/20 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-lg">🍲</span>
            <h2 className="text-base font-semibold text-amber-100">换一锅新汤</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-3 bg-ink-950/60 border-b border-white/5">
          <button
            onClick={() => setTab('builtin')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition ${
              tab === 'builtin'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            精选题库
          </button>
          <button
            onClick={() => setTab('ai')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition ${
              tab === 'ai'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI 现编
          </button>
          <button
            onClick={() => setTab('custom')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition ${
              tab === 'custom'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            自己出题
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'builtin' && (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`px-2.5 py-1 rounded-full text-xs transition ${
                        category === c
                          ? 'bg-amber-500 text-ink-950 font-semibold'
                          : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <button
                  disabled={busy}
                  onClick={() => {
                    onSelect({ mode: 'random' });
                    onClose();
                  }}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 hover:bg-indigo-500/30 transition"
                >
                  <Shuffle className="w-3 h-3" />
                  随机
                </button>
              </div>

              <div className="space-y-2">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    disabled={busy}
                    onClick={() => {
                      onSelect({ mode: 'builtin', puzzleId: p.id });
                      onClose();
                    }}
                    className="w-full text-left p-3 rounded-xl bg-ink-800/70 hover:bg-ink-800 border border-white/5 hover:border-amber-500/35 transition group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-sm text-slate-100 group-hover:text-amber-200 transition">
                        《{p.title}》
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-300">
                          {p.category}
                        </span>
                        <span className="text-amber-400">
                          {'★'.repeat(p.difficulty)}
                          {'☆'.repeat(3 - p.difficulty)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{p.surface}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'ai' && (
            <div className="space-y-4 py-1">
              {!aiEnabled && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 leading-relaxed">
                  当前尚未配置 <code className="px-1 py-0.5 rounded bg-black/40">GEMINI_API_KEY</code>
                  ，配置后即可让 Gemini 实时原创全新海龟汤！
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">主题关键词（可选）</label>
                <input
                  value={aiTheme}
                  onChange={(e) => setAiTheme(e.target.value)}
                  placeholder="例如：程序员加班、密室逃脱、校园反转、职场脑洞..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-ink-950 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">难度</label>
                <div className="grid grid-cols-3 gap-2">
                  {([1, 2, 3] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setAiDifficulty(d)}
                      className={`py-2 rounded-xl text-xs font-medium border transition ${
                        aiDifficulty === d
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : 'bg-ink-950 text-slate-400 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {d === 1 ? '★☆☆ 轻松' : d === 2 ? '★★☆ 适中' : '★★★ 烧脑'}
                    </button>
                  ))}
                </div>
              </div>
              <button
                disabled={busy || !aiEnabled}
                onClick={() => {
                  onSelect({ mode: 'ai', theme: aiTheme, difficulty: aiDifficulty });
                  onClose();
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-ink-950 font-semibold text-sm disabled:opacity-40 hover:brightness-110 transition flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                让 Gemini 现熬一锅新汤
              </button>
            </div>
          )}

          {tab === 'custom' && (
            <div className="space-y-3 py-1">
              <p className="text-xs text-slate-400">
                你来出题，写好汤面和汤底后交给 AI 当裁判，你也可以和群友一起看戏！
              </p>
              <input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="题目名称（例如：深夜的快递）"
                className="w-full px-3.5 py-2.5 rounded-xl bg-ink-950 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
              />
              <textarea
                rows={3}
                value={customSurface}
                onChange={(e) => setCustomSurface(e.target.value)}
                placeholder="汤面（公开给所有人看的悬疑开头）..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-ink-950 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 resize-none"
              />
              <textarea
                rows={3}
                value={customTruth}
                onChange={(e) => setCustomTruth(e.target.value)}
                placeholder="汤底（隐藏真相，仅 AI 主持人可见）..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-ink-950 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 resize-none"
              />
              <button
                disabled={busy || !customSurface.trim() || !customTruth.trim()}
                onClick={() => {
                  onSelect({
                    mode: 'custom',
                    customTitle,
                    customSurface,
                    customTruth,
                  });
                  onClose();
                }}
                className="w-full py-3 rounded-xl bg-amber-500 text-ink-950 font-semibold text-sm disabled:opacity-40 hover:bg-amber-400 transition"
              >
                端上我的私房汤
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
