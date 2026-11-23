# 🐢 午夜海龟汤 · AI 联机推理馆 (`turtle-soup`)

适合发到微信群直接点开玩的多人实时 **AI 海龟汤（情境推理）** Web 应用。

- 线上地址：https://soup.sgayy.space
- 技术栈：React 18 + TypeScript + Tailwind CSS + Express + WebSocket (`ws`) + Google Gemini API

## 核心功能
- **微信群一键开黑**：4 位房间号 + 一键复制微信群邀请文案，点开链接填昵称即进房。
- **实时联机同步**：基于 WebSocket，房间内所有人的提问、AI 判定、提示、猜汤底进度条和讨论实时同步。
- **多种出题方式**：内置 16 道精选海龟汤题库 + **AI 现编新汤**（自定义主题/难度）+ **玩家自定义出题**。
- **AI 主持人裁判**：接入 Google Gemini API（自动多 Flash 备用模型容灾降级），支持是非题判定（`是 / 不是 / 无关 / 关键线索 / 是也不是`）、不剧透微提示、以及猜汤底语义还原度打分（0–100%）。

## 本地运行
```bash
npm install
cp .env.example .env
# 在 .env 中填入 GEMINI_API_KEY（可在 Google AI Studio 免费层级获取）
npm run build
npm start
```
默认监听 `http://localhost:3088`（开发模式可用 `npm run dev`）。
