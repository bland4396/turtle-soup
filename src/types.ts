export type PuzzleCategory = '悬疑推理' | '细思极恐' | '温情反转' | '脑洞奇谭' | 'AI现编' | '自定义';

export interface PuzzleSummary {
  id: string;
  title: string;
  category: PuzzleCategory;
  difficulty: 1 | 2 | 3;
  surface: string;
  tags: string[];
}

export interface PublicPuzzle {
  id: string;
  title: string;
  category: PuzzleCategory;
  difficulty: 1 | 2 | 3;
  surface: string;
  tags?: string[];
  truth?: string;
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
  score?: number;
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

export interface HealthInfo {
  ok: boolean;
  aiMode: 'gemini' | 'demo';
  model: string;
  activeRooms: number;
  onlinePlayers: number;
}

export const AVATARS = ['🕵️', '🦊', '🐱', '🦉', '🦝', '🐼', '🐸', '🐙', '🦄', '🐻', '🐺', '🐢'];
