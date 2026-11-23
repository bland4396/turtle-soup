export type PuzzleCategory = '悬疑推理' | '细思极恐' | '温情反转' | '脑洞奇谭' | 'AI现编' | '自定义';

export interface Puzzle {
  id: string;
  title: string;
  category: PuzzleCategory;
  difficulty: 1 | 2 | 3;
  surface: string; // 汤面
  truth: string; // 汤底（未揭晓前不下发给前端）
  keyClues: string[]; // 关键线索点，用于 AI 评估还原度
  hints: string[]; // 预设渐进提示（AI 也会结合已问问题动态生成）
  tags?: string[];
}

export interface PublicPuzzle {
  id: string;
  title: string;
  category: PuzzleCategory;
  difficulty: 1 | 2 | 3;
  surface: string;
  tags?: string[];
  truth?: string; // 仅在 status === 'solved' | 'revealed' 时下发
  keyClues?: string[];
}

export type VerdictType = 'yes' | 'no' | 'irrelevant' | 'close' | 'partial';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  joinedAt: number;
}

export type FeedItemType = 'system' | 'question' | 'guess' | 'hint' | 'chat';

export interface FeedItem {
  id: string;
  type: FeedItemType;
  playerId?: string;
  playerName?: string;
  playerAvatar?: string;
  content: string;
  verdict?: VerdictType;
  verdictLabel?: string;
  aiReply?: string;
  score?: number; // 0-100 for guess
  matchedClues?: string[];
  missedHint?: string;
  solved?: boolean;
  createdAt: number;
}

export type RoomStatus = 'playing' | 'solved' | 'revealed';

export interface RoomSnapshot {
  roomCode: string;
  status: RoomStatus;
  round: number;
  puzzle: PublicPuzzle;
  players: Player[];
  feed: FeedItem[];
  hintsUsed: number;
  maxHints: number;
  aiBusy: boolean;
  aiBusyText: string;
  winnerName?: string;
  aiMode: 'gemini' | 'demo';
  modelName: string;
  questionCount: number;
}
