import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { BUILTIN_PUZZLES } from './puzzles.js';
import { generateNewPuzzle, getGeminiConfig } from './gemini.js';
import { RoomManager } from './roomManager.js';
import type { Puzzle } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

const roomManager = new RoomManager();

// Health & status
app.get('/api/health', (_req, res) => {
  const cfg = getGeminiConfig();
  res.json({
    ok: true,
    aiMode: cfg.enabled ? 'gemini' : 'demo',
    model: cfg.model,
    ...roomManager.getStats(),
  });
});

// List built-in puzzles (without truth!)
app.get('/api/puzzles', (_req, res) => {
  res.json({
    puzzles: BUILTIN_PUZZLES.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      difficulty: p.difficulty,
      surface: p.surface,
      tags: p.tags || [],
    })),
  });
});

// Create room
app.post('/api/rooms', async (req, res) => {
  try {
    const body = (req.body || {}) as {
      mode?: 'builtin' | 'random' | 'ai' | 'custom';
      puzzleId?: string;
      theme?: string;
      difficulty?: 1 | 2 | 3;
      customTitle?: string;
      customSurface?: string;
      customTruth?: string;
    };

    let customPuzzle: Puzzle | undefined;
    let puzzleId: string | undefined = body.puzzleId;

    if (body.mode === 'random') {
      puzzleId = BUILTIN_PUZZLES[Math.floor(Math.random() * BUILTIN_PUZZLES.length)].id;
    } else if (body.mode === 'ai') {
      const diff = body.difficulty === 1 || body.difficulty === 3 ? body.difficulty : 2;
      customPuzzle = await generateNewPuzzle(body.theme, diff);
    } else if (body.mode === 'custom') {
      const surface = (body.customSurface || '').trim();
      const truth = (body.customTruth || '').trim();
      if (!surface || !truth) {
        res.status(400).json({ error: '自定义题目需要同时填写汤面和汤底' });
        return;
      }
      customPuzzle = {
        id: `custom-${Date.now().toString(36)}`,
        title: (body.customTitle || '玩家私房汤').trim().slice(0, 20),
        category: '自定义',
        difficulty: 2,
        surface,
        truth,
        keyClues: [truth.slice(0, 60)],
        hints: ['仔细品味出题人在汤面中埋下的伏笔。'],
        tags: ['玩家出题'],
      };
    }

    const room = roomManager.createRoom(puzzleId, customPuzzle);
    res.json({
      roomCode: room.roomCode,
      puzzleTitle: room.puzzle.title,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '创建房间失败';
    res.status(500).json({ error: msg });
  }
});

// Check if room exists
app.get('/api/rooms/:code', (req, res) => {
  const room = roomManager.getRoom(req.params.code);
  if (!room) {
    res.status(404).json({ error: '房间不存在或已解散，请检查 4 位房间号' });
    return;
  }
  res.json({
    roomCode: room.roomCode,
    puzzleTitle: room.puzzle.title,
    playerCount: room.players.size,
    status: room.status,
  });
});

// Serve built frontend in production
const distDir = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  let boundRoom: ReturnType<RoomManager['getRoom']> = undefined;
  let boundPlayer: { id: string; name: string; avatar: string; isHost: boolean; joinedAt: number } | undefined;
  let boundClient: { ws: typeof ws; playerId: string } | undefined;

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(String(raw)) as Record<string, unknown>;
      const type = String(msg.type || '');

      if (type === 'join') {
        const roomCode = String(msg.roomCode || '');
        const name = String(msg.name || '');
        const avatar = typeof msg.avatar === 'string' ? msg.avatar : undefined;
        const joined = roomManager.joinRoom(roomCode, ws, name, avatar);
        if (!joined) {
          ws.send(JSON.stringify({ type: 'error', message: '房间不存在或已过期' }));
          return;
        }
        boundRoom = joined.room;
        boundPlayer = joined.player;
        boundClient = joined.client;
        ws.send(
          JSON.stringify({
            type: 'joined',
            playerId: joined.player.id,
            snapshot: roomManager.getSnapshot(joined.room),
          })
        );
        return;
      }

      if (!boundRoom || !boundPlayer) {
        ws.send(JSON.stringify({ type: 'error', message: '请先加入房间' }));
        return;
      }

      if (type === 'ask') {
        await roomManager.handleAsk(boundRoom, boundPlayer, String(msg.content || ''));
      } else if (type === 'guess') {
        await roomManager.handleGuess(boundRoom, boundPlayer, String(msg.content || ''));
      } else if (type === 'chat') {
        roomManager.handleChat(boundRoom, boundPlayer, String(msg.content || ''));
      } else if (type === 'hint') {
        await roomManager.handleHint(boundRoom, boundPlayer);
      } else if (type === 'reveal') {
        roomManager.handleReveal(boundRoom, boundPlayer);
      } else if (type === 'next_round') {
        await roomManager.handleNextRoundByMode(boundRoom, boundPlayer, {
          mode: (msg.mode as 'random' | 'builtin' | 'ai' | 'custom') || 'random',
          puzzleId: typeof msg.puzzleId === 'string' ? msg.puzzleId : undefined,
          theme: typeof msg.theme === 'string' ? msg.theme : undefined,
          difficulty: msg.difficulty === 1 || msg.difficulty === 3 ? msg.difficulty : 2,
          customTitle: typeof msg.customTitle === 'string' ? msg.customTitle : undefined,
          customSurface: typeof msg.customSurface === 'string' ? msg.customSurface : undefined,
          customTruth: typeof msg.customTruth === 'string' ? msg.customTruth : undefined,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '消息格式错误';
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'error', message }));
      }
    }
  });

  ws.on('close', () => {
    if (boundRoom && boundClient) {
      roomManager.leaveRoom(boundRoom, boundClient);
    }
  });
});

const PORT = Number(process.env.PORT || 3088);
server.listen(PORT, '0.0.0.0', () => {
  const cfg = getGeminiConfig();
  console.log(`🐢 Turtle Soup server running at http://localhost:${PORT}`);
  console.log(
    cfg.enabled
      ? `✨ Gemini AI enabled (model: ${cfg.model})`
      : `⚠️ GEMINI_API_KEY not set — running in local demo mode`
  );
});
