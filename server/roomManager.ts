import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import { BUILTIN_PUZZLES, getPuzzleById, getRandomPuzzle } from './puzzles.js';
import {
  generateHint,
  generateNewPuzzle,
  getGeminiConfig,
  judgeGuess,
  judgeQuestion,
} from './gemini.js';
import type { FeedItem, Player, PublicPuzzle, Puzzle, RoomSnapshot, RoomStatus } from './types.js';

interface ConnectedClient {
  ws: WebSocket;
  playerId: string;
}

interface RoomState {
  roomCode: string;
  status: RoomStatus;
  round: number;
  puzzle: Puzzle;
  players: Map<string, Player>;
  clients: Set<ConnectedClient>;
  feed: FeedItem[];
  hintsUsed: number;
  maxHints: number;
  aiBusy: boolean;
  aiBusyText: string;
  winnerName?: string;
  lastActiveAt: number;
}

const AVATARS = ['🕵️', '🦊', '🐱', '🦉', '🦝', '🐼', '🐸', '🐙', '🦄', '🐻', '🐺', '🐢'];

export class RoomManager {
  private rooms = new Map<string, RoomState>();

  constructor() {
    // Clean up idle rooms older than 6 hours every 15 minutes
    setInterval(() => {
      const cutoff = Date.now() - 6 * 60 * 60 * 1000;
      for (const [code, room] of this.rooms.entries()) {
        if (room.clients.size === 0 && room.lastActiveAt < cutoff) {
          this.rooms.delete(code);
        }
      }
    }, 15 * 60 * 1000).unref();
  }

  private generateRoomCode(): string {
    for (let i = 0; i < 50; i++) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      if (!this.rooms.has(code)) return code;
    }
    return String(Math.floor(10000 + Math.random() * 90000));
  }

  private makePublicPuzzle(puzzle: Puzzle, status: RoomStatus): PublicPuzzle {
    const revealed = status === 'solved' || status === 'revealed';
    return {
      id: puzzle.id,
      title: puzzle.title,
      category: puzzle.category,
      difficulty: puzzle.difficulty,
      surface: puzzle.surface,
      tags: puzzle.tags,
      ...(revealed ? { truth: puzzle.truth, keyClues: puzzle.keyClues } : {}),
    };
  }

  public getSnapshot(room: RoomState): RoomSnapshot {
    const cfg = getGeminiConfig();
    return {
      roomCode: room.roomCode,
      status: room.status,
      round: room.round,
      puzzle: this.makePublicPuzzle(room.puzzle, room.status),
      players: Array.from(room.players.values()),
      feed: room.feed.slice(-120),
      hintsUsed: room.hintsUsed,
      maxHints: room.maxHints,
      aiBusy: room.aiBusy,
      aiBusyText: room.aiBusyText,
      winnerName: room.winnerName,
      aiMode: cfg.enabled ? 'gemini' : 'demo',
      modelName: cfg.model,
      questionCount: room.feed.filter((f) => f.type === 'question').length,
    };
  }

  public broadcast(room: RoomState, event = 'room_state', extra?: Record<string, unknown>) {
    const payload = JSON.stringify({
      type: event,
      snapshot: this.getSnapshot(room),
      ...extra,
    });
    for (const client of room.clients) {
      if (client.ws.readyState === 1) {
        client.ws.send(payload);
      }
    }
  }

  private pushSystem(room: RoomState, content: string) {
    room.feed.push({
      id: crypto.randomUUID(),
      type: 'system',
      content,
      createdAt: Date.now(),
    });
  }

  public createRoom(puzzleId?: string, customPuzzle?: Puzzle): RoomState {
    const roomCode = this.generateRoomCode();
    const puzzle = customPuzzle || (puzzleId ? getPuzzleById(puzzleId) : undefined) || BUILTIN_PUZZLES[0];
    const room: RoomState = {
      roomCode,
      status: 'playing',
      round: 1,
      puzzle,
      players: new Map(),
      clients: new Set(),
      feed: [],
      hintsUsed: 0,
      maxHints: 3,
      aiBusy: false,
      aiBusyText: '',
      lastActiveAt: Date.now(),
    };
    this.pushSystem(room, `欢迎来到午夜海龟汤馆！第 1 锅《${puzzle.title}》已端上桌，请开始向 AI 主持人提问是非题。`);
    this.rooms.set(roomCode, room);
    return room;
  }

  public getRoom(roomCode: string): RoomState | undefined {
    return this.rooms.get(roomCode.trim());
  }

  public getStats() {
    let onlinePlayers = 0;
    for (const r of this.rooms.values()) {
      onlinePlayers += r.clients.size;
    }
    return {
      activeRooms: this.rooms.size,
      onlinePlayers,
    };
  }

  public joinRoom(
    roomCode: string,
    ws: WebSocket,
    playerName: string,
    avatar?: string
  ): { room: RoomState; player: Player; client: ConnectedClient } | null {
    const room = this.rooms.get(roomCode.trim());
    if (!room) return null;

    const cleanName = playerName.trim().slice(0, 14) || `侦探${Math.floor(10 + Math.random() * 89)}`;
    const playerId = crypto.randomUUID();
    const isHost = room.players.size === 0;
    const pickedAvatar = avatar && AVATARS.includes(avatar) ? avatar : AVATARS[room.players.size % AVATARS.length];

    const player: Player = {
      id: playerId,
      name: cleanName,
      avatar: pickedAvatar,
      isHost,
      joinedAt: Date.now(),
    };

    const client: ConnectedClient = { ws, playerId };
    room.players.set(playerId, player);
    room.clients.add(client);
    room.lastActiveAt = Date.now();

    this.pushSystem(room, `${player.avatar} ${player.name} 推门加入了推理馆`);
    this.broadcast(room);
    return { room, player, client };
  }

  public leaveRoom(room: RoomState, client: ConnectedClient) {
    room.clients.delete(client);
    const player = room.players.get(client.playerId);
    room.players.delete(client.playerId);
    room.lastActiveAt = Date.now();

    if (player) {
      // Transfer host if needed
      if (player.isHost && room.players.size > 0) {
        const nextHost = room.players.values().next().value as Player | undefined;
        if (nextHost) {
          nextHost.isHost = true;
        }
      }
      this.pushSystem(room, `${player.avatar} ${player.name} 暂时离开了房间`);
      this.broadcast(room);
    }
  }

  public async handleAsk(room: RoomState, player: Player, question: string) {
    const cleanQ = question.trim().slice(0, 200);
    if (!cleanQ || room.status !== 'playing' || room.aiBusy) return;

    room.lastActiveAt = Date.now();
    room.aiBusy = true;
    room.aiBusyText = `AI 主持人正在审视 ${player.name} 的提问...`;
    this.broadcast(room);

    try {
      const result = await judgeQuestion(room.puzzle, cleanQ, room.feed);
      room.feed.push({
        id: crypto.randomUUID(),
        type: 'question',
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        content: cleanQ,
        verdict: result.verdict,
        verdictLabel: result.verdictLabel,
        aiReply: result.aiReply,
        createdAt: Date.now(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      this.pushSystem(room, `⚠️ AI 主持人开小差了：${msg}`);
    } finally {
      room.aiBusy = false;
      room.aiBusyText = '';
      this.broadcast(room);
    }
  }

  public async handleGuess(room: RoomState, player: Player, guess: string) {
    const cleanGuess = guess.trim().slice(0, 500);
    if (!cleanGuess || room.status !== 'playing' || room.aiBusy) return;

    room.lastActiveAt = Date.now();
    room.aiBusy = true;
    room.aiBusyText = `AI 主持人正在核对 ${player.name} 的汤底推理...`;
    this.broadcast(room);

    try {
      const result = await judgeGuess(room.puzzle, cleanGuess);
      room.feed.push({
        id: crypto.randomUUID(),
        type: 'guess',
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        content: cleanGuess,
        score: result.score,
        solved: result.solved,
        matchedClues: result.matchedClues,
        missedHint: result.missedHint,
        aiReply: result.aiReply,
        createdAt: Date.now(),
      });

      if (result.solved) {
        room.status = 'solved';
        room.winnerName = `${player.avatar} ${player.name}`;
        this.pushSystem(room, `🎉 恭喜 ${player.avatar} ${player.name} 喝汤成功（还原度 ${result.score}%）！完整汤底已揭晓。`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      this.pushSystem(room, `⚠️ AI 裁判暂时无法评分：${msg}`);
    } finally {
      room.aiBusy = false;
      room.aiBusyText = '';
      this.broadcast(room);
    }
  }

  public async handleHint(room: RoomState, player: Player) {
    if (room.status !== 'playing' || room.aiBusy) return;
    if (room.hintsUsed >= room.maxHints) {
      this.pushSystem(room, '💡 本锅汤的 3 次提示机会已全部用完啦，再试试集体头脑风暴吧！');
      this.broadcast(room);
      return;
    }

    room.lastActiveAt = Date.now();
    room.aiBusy = true;
    room.aiBusyText = 'AI 主持人正在斟酌一条不剧透的微提示...';
    this.broadcast(room);

    try {
      const hintText = await generateHint(room.puzzle, room.hintsUsed, room.feed);
      room.hintsUsed += 1;
      room.feed.push({
        id: crypto.randomUUID(),
        type: 'hint',
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        content: hintText,
        createdAt: Date.now(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      this.pushSystem(room, `⚠️ 获取提示失败：${msg}`);
    } finally {
      room.aiBusy = false;
      room.aiBusyText = '';
      this.broadcast(room);
    }
  }

  public handleChat(room: RoomState, player: Player, text: string) {
    const clean = text.trim().slice(0, 200);
    if (!clean) return;
    room.lastActiveAt = Date.now();
    room.feed.push({
      id: crypto.randomUUID(),
      type: 'chat',
      playerId: player.id,
      playerName: player.name,
      playerAvatar: player.avatar,
      content: clean,
      createdAt: Date.now(),
    });
    this.broadcast(room);
  }

  public handleReveal(room: RoomState, player: Player) {
    if (room.status !== 'playing' || room.aiBusy) return;
    room.lastActiveAt = Date.now();
    room.status = 'revealed';
    this.pushSystem(room, `📖 ${player.avatar} ${player.name} 揭开了锅盖，本锅汤底已公开。`);
    this.broadcast(room);
  }

  public startNextRound(room: RoomState, player: Player, nextPuzzle: Puzzle) {
    room.lastActiveAt = Date.now();
    room.round += 1;
    room.puzzle = nextPuzzle;
    room.status = 'playing';
    room.hintsUsed = 0;
    room.winnerName = undefined;
    room.feed = [];
    this.pushSystem(
      room,
      `🍲 ${player.avatar} ${player.name} 开启了第 ${room.round} 锅《${nextPuzzle.title}》！大家继续盘它！`
    );
    this.broadcast(room);
  }

  public async handleNextRoundByMode(
    room: RoomState,
    player: Player,
    payload: {
      mode: 'random' | 'builtin' | 'ai' | 'custom';
      puzzleId?: string;
      theme?: string;
      difficulty?: 1 | 2 | 3;
      customTitle?: string;
      customSurface?: string;
      customTruth?: string;
    }
  ) {
    if (room.aiBusy) return;

    if (payload.mode === 'random') {
      const next = getRandomPuzzle(room.puzzle.id);
      this.startNextRound(room, player, next);
      return;
    }

    if (payload.mode === 'builtin' && payload.puzzleId) {
      const next = getPuzzleById(payload.puzzleId) || getRandomPuzzle(room.puzzle.id);
      this.startNextRound(room, player, next);
      return;
    }

    if (payload.mode === 'custom') {
      const surface = (payload.customSurface || '').trim();
      const truth = (payload.customTruth || '').trim();
      if (!surface || !truth) return;
      const custom: Puzzle = {
        id: `custom-${Date.now().toString(36)}`,
        title: (payload.customTitle || '玩家私房汤').trim().slice(0, 20),
        category: '自定义',
        difficulty: 2,
        surface,
        truth,
        keyClues: [truth.slice(0, 60)],
        hints: ['仔细琢磨出题人埋在汤面里的每一个关键词。'],
        tags: ['玩家出题'],
      };
      this.startNextRound(room, player, custom);
      return;
    }

    if (payload.mode === 'ai') {
      room.aiBusy = true;
      room.aiBusyText = 'AI 主厨正在现熬一锅全新海龟汤，请稍候...';
      this.broadcast(room);
      try {
        const diff = payload.difficulty === 1 || payload.difficulty === 3 ? payload.difficulty : 2;
        const generated = await generateNewPuzzle(payload.theme, diff);
        room.aiBusy = false;
        room.aiBusyText = '';
        this.startNextRound(room, player, generated);
      } catch (err) {
        room.aiBusy = false;
        room.aiBusyText = '';
        const msg = err instanceof Error ? err.message : '生成失败';
        this.pushSystem(room, `⚠️ AI 现编新汤失败：${msg}`);
        this.broadcast(room);
      }
    }
  }
}
