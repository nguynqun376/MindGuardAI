import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("mindguard.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS moods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    date TEXT,
    level INTEGER,
    tags TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
  );

  CREATE TABLE IF NOT EXISTS journals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    content TEXT,
    sentiment_score REAL,
    risk_label TEXT,
    advice TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    role TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Middleware to get user_id from headers
  const getUserId = (req: express.Request) => req.headers["x-user-id"] as string;

  app.get("/api/user", (req, res) => {
    res.json({ email: process.env.USER_EMAIL || null });
  });

  // API Routes
  app.get("/api/moods", (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(400).json({ error: "Missing user ID" });
    const moods = db.prepare("SELECT * FROM moods WHERE user_id = ? ORDER BY date DESC LIMIT 30").all(userId);
    res.json(moods);
  });

  app.post("/api/moods", (req, res) => {
    const userId = getUserId(req);
    const { level, date, tags } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing user ID" });
    const stmt = db.prepare("INSERT OR REPLACE INTO moods (user_id, date, level, tags) VALUES (?, ?, ?, ?)");
    stmt.run(userId, date, level, tags);
    res.json({ success: true });
  });

  app.get("/api/journals", (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(400).json({ error: "Missing user ID" });
    const journals = db.prepare("SELECT * FROM journals WHERE user_id = ? ORDER BY timestamp DESC").all(userId);
    res.json(journals);
  });

  app.post("/api/journals", (req, res) => {
    const userId = getUserId(req);
    const { content, sentiment_score, risk_label, advice, timestamp } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing user ID" });
    
    if (timestamp) {
      const stmt = db.prepare("INSERT INTO journals (user_id, content, sentiment_score, risk_label, advice, timestamp) VALUES (?, ?, ?, ?, ?, ?)");
      stmt.run(userId, content, sentiment_score, risk_label, advice, timestamp);
    } else {
      const stmt = db.prepare("INSERT INTO journals (user_id, content, sentiment_score, risk_label, advice) VALUES (?, ?, ?, ?, ?)");
      stmt.run(userId, content, sentiment_score, risk_label, advice);
    }
    res.json({ success: true });
  });

  app.get("/api/chat-history", (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(400).json({ error: "Missing user ID" });
    const history = db.prepare("SELECT * FROM chat_history WHERE user_id = ? ORDER BY timestamp ASC").all(userId);
    res.json(history);
  });

  app.post("/api/chat-history", (req, res) => {
    const userId = getUserId(req);
    const { role, content } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing user ID" });
    const stmt = db.prepare("INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?)");
    stmt.run(userId, role, content);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
