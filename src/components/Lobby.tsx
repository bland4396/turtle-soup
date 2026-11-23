import React, { useState } from 'react';
import { DoorOpen, PlusCircle, Sparkles, Shuffle, Users, Flame } from 'lucide-react';
import { AVATARS, type HealthInfo, type PuzzleSummary } from '../types';

interface LobbyProps {
  initialRoomCode: string;
  nickname: string;
  avatar: string;
  puzzles: PuzzleSummary[];
  health: HealthInfo | null;
  onChangeNickname: (name: string) => void;
  onChangeAvatar: (avatar: string) => void;
  onEnterRoom: (roomCode: string) => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  initialRoomCode,
  nickname,
  avatar,
  puzzles,
  health,
  onChangeNickname,
  onChangeAvatar,
  onEnterRoom,
}) => {
  const [tab, setTab] = useState<'join' | 'create'>(initialRoomCode ? 'join' : 'create');
  const [roomInput, setRoomInput] = useState(initialRoomCode);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string>(puzzles[0]?.id || 'turtle-classic');
  const [createMode, setCreateMode] = useState<'builtin' | 'random' | 'ai'>('builtin');
  const [aiTheme, setAiTheme] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureNickname = () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      const randomName = `侦探${Math.floor(100 + Math.random() * 899)}`;
      onChangeNickname(randomName);
      return randomName;
    }
    return trimmed;
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const code = roomInput.trim();
    if (!code) {
      setError('请输入 4 位房间号');
      return;
    }
    ensureNickname();
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`);
      const data = (await res.json()) as { roomCode?: string; error?: string };
      if (!res.ok) {
        setError(data.error || '房间不存在');
        return;
      }
      onEnterRoom(data.roomCode || code);
    } catch {
      setError('网络开小差了，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setError(null);
    ensureNickname();
    setLoading(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: createMode,
          puzzleId: selectedPuzzleId,
          theme: aiTheme,
          difficulty: 2,
        }),
      });
      const data = (await res.json()) as { roomCode?: string; error?: string };
      if (!res.ok || !data.roomCode) {
        setError(data.error || '创建房间失败');
        return;
      }
      onEnterRoom(data.roomCode);
    } catch {
      setError('无法连接服务器，请检查后端是否运行');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-5">
        {/* Hero */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs">
            <Flame className="w-3.5 h-3.5" />
            <span>
              {health?.aiMode === 'gemini'
                ? `Gemini AI 主持人在线 · ${health.model}`
                : '本地演示模式 · 配置 GEMINI_API_KEY 解锁真 AI'}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-b from-amber-100 via-amber-200 to-amber-500 bg-clip-text text-transparent">
            🐢 午夜海龟汤
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            甩个链接进微信群 · 实时联机提问 · AI 主持判断真相
          </p>
        </div>

        {/* Profile Card */}
        <div className="rounded-2xl bg-ink-900/90 border border-white/10 p-4 space-y-3 shadow-lantern">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">你的推理代号</label>
            {health && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Users className="w-3 h-3 text-emerald-400" />
                {health.activeRooms} 桌在玩 · {health.onlinePlayers} 人在线
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 shrink-0 rounded-xl bg-ink-800 border border-amber-500/30 flex items-center justify-center text-2xl">
              {avatar}
            </div>
            <input
              value={nickname}
              onChange={(e) => onChangeNickname(e.target.value)}
              maxLength={14}
              placeholder="输入群昵称（如：福尔摩斯小王）"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-ink-950 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {AVATARS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => onChangeAvatar(em)}
                className={`w-8 h-8 shrink-0 rounded-lg text-base flex items-center justify-center transition ${
                  avatar === em
                    ? 'bg-amber-500/25 border border-amber-400 scale-105'
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        {/* Action Card */}
        <div className="rounded-2xl bg-ink-900/90 border border-white/10 overflow-hidden shadow-xl">
          <div className="grid grid-cols-2 border-b border-white/10 bg-ink-950/60">
            <button
              onClick={() => {
                setTab('create');
                setError(null);
              }}
              className={`py-3 text-sm font-medium flex items-center justify-center gap-1.5 transition ${
                tab === 'create'
                  ? 'text-amber-300 border-b-2 border-amber-400 bg-amber-500/5'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              开一锅新汤
            </button>
            <button
              onClick={() => {
                setTab('join');
                setError(null);
              }}
              className={`py-3 text-sm font-medium flex items-center justify-center gap-1.5 transition ${
                tab === 'join'
                  ? 'text-amber-300 border-b-2 border-amber-400 bg-amber-500/5'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <DoorOpen className="w-4 h-4" />
              进好友房间
            </button>
          </div>

          <div className="p-4 space-y-4">
            {error && (
              <div className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
                {error}
              </div>
            )}

            {tab === 'join' ? (
              <form onSubmit={handleJoin} className="space-y-3.5">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">输入微信群里的 4 位房间号</label>
                  <input
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    placeholder="例如：4829"
                    className="w-full px-4 py-3 rounded-xl bg-ink-950 border border-white/10 text-center text-2xl tracking-[0.35em] font-mono text-amber-200 placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-base focus:outline-none focus:border-amber-500/60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-ink-950 font-semibold text-sm hover:brightness-110 disabled:opacity-50 transition"
                >
                  {loading ? '正在推门进入...' : '推门进房破案'}
                </button>
              </form>
            ) : (
              <div className="space-y-3.5">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateMode('builtin')}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border transition ${
                      createMode === 'builtin'
                        ? 'bg-amber-500/20 text-amber-200 border-amber-500/50'
                        : 'bg-ink-950 text-slate-400 border-white/10'
                    }`}
                  >
                    📚 选经典题
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateMode('random')}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border transition flex items-center justify-center gap-1 ${
                      createMode === 'random'
                        ? 'bg-amber-500/20 text-amber-200 border-amber-500/50'
                        : 'bg-ink-950 text-slate-400 border-white/10'
                    }`}
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    手气一锅
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateMode('ai')}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border transition flex items-center justify-center gap-1 ${
                      createMode === 'ai'
                        ? 'bg-amber-500/20 text-amber-200 border-amber-500/50'
                        : 'bg-ink-950 text-slate-400 border-white/10'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI 现编
                  </button>
                </div>

                {createMode === 'builtin' && (
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {puzzles.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPuzzleId(p.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl border transition ${
                          selectedPuzzleId === p.id
                            ? 'bg-amber-500/15 border-amber-500/50 text-amber-100'
                            : 'bg-ink-950/70 border-white/5 text-slate-300 hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">《{p.title}》</span>
                          <span className="text-[11px] text-slate-400">
                            {p.category} · {'★'.repeat(p.difficulty)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {createMode === 'random' && (
                  <div className="p-3 rounded-xl bg-ink-950/70 border border-white/5 text-xs text-slate-400 leading-relaxed">
                    从 {puzzles.length} 道精选海龟汤里随机抽一锅，大家谁都没剧透，直接开盘！
                  </div>
                )}

                {createMode === 'ai' && (
                  <div className="space-y-2">
                    <input
                      value={aiTheme}
                      onChange={(e) => setAiTheme(e.target.value)}
                      placeholder="可选主题：如 职场摸鱼、密室、校园反转（留空随机）"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-ink-950 border border-white/10 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
                    />
                    {health?.aiMode !== 'gemini' && (
                      <p className="text-[11px] text-amber-300/80">
                        提示：AI 现编需要先在服务端配置 GEMINI_API_KEY。
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={loading || (createMode === 'ai' && health?.aiMode !== 'gemini')}
                  onClick={handleCreate}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-ink-950 font-semibold text-sm hover:brightness-110 disabled:opacity-45 transition"
                >
                  {loading ? '正在熬汤建房...' : '开桌！生成微信群邀请链接'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Rules footer */}
        <div className="text-center text-[11px] text-slate-500 leading-relaxed px-2">
          玩法：AI 给出一段离奇的「汤面」，大家轮流问是非题，AI 只回
          <span className="text-emerald-400"> 是</span> /<span className="text-rose-400"> 不是</span> /
          <span className="text-slate-300"> 无关</span>，拼出完整「汤底」即喝汤成功！
        </div>
      </div>
    </div>
  );
};
