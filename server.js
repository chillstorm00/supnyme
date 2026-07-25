const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");
const { containsBlockedContent, isRateLimited } = require("./moderation");

const app = express();
const PORT = process.env.PORT || 3000;
const IP_SALT = process.env.IP_SALT || "change-moi-en-production";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-moi-aussi-en-production";

const db = new Database(path.join(__dirname, "anonwall.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pseudo TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT,
    reply_to_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reports INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    ip_hash TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (reply_to_id) REFERENCES messages(id)
  );

  CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    emoji TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

app.set("trust proxy", 1);
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);
app.use(express.static(path.join(__dirname, "public")));

function hashIp(ip) {
  return crypto.createHash("sha256").update(ip + IP_SALT).digest("hex");
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Connecte-toi d'abord." });
  }
  next();
}

const PSEUDO_RE = /^[a-zA-Z0-9_]{3,20}$/;

// --- Authentification ---

app.post("/api/auth/register", async (req, res) => {
  const pseudo = (req.body.pseudo || "").trim();
  const password = req.body.password || "";
  const email = (req.body.email || "").trim();

  if (!PSEUDO_RE.test(pseudo)) {
    return res.status(400).json({
      error: "Pseudo invalide (3-20 caractères, lettres/chiffres/_ uniquement).",
    });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Mot de passe : 6 caractères minimum." });
  }

  const existing = db.prepare("SELECT id FROM users WHERE pseudo = ?").get(pseudo);
  if (existing) {
    return res.status(409).json({ error: "Ce pseudo est déjà pris." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const info = db
    .prepare("INSERT INTO users (pseudo, password_hash, email) VALUES (?, ?, ?)")
    .run(pseudo, passwordHash, email || null);

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Erreur serveur." });
    req.session.userId = info.lastInsertRowid;
    req.session.pseudo = pseudo;
    res.status(201).json({ pseudo });
  });
});

app.post("/api/auth/login", async (req, res) => {
  const pseudo = (req.body.pseudo || "").trim();
  const password = req.body.password || "";

  const user = db.prepare("SELECT * FROM users WHERE pseudo = ?").get(pseudo);
  if (!user) {
    return res.status(401).json({ error: "Pseudo ou mot de passe incorrect." });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Pseudo ou mot de passe incorrect." });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Erreur serveur." });
    req.session.userId = user.id;
    req.session.pseudo = user.pseudo;
    res.json({ pseudo: user.pseudo });
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.userId) return res.json({ pseudo: null });
  const user = db
    .prepare("SELECT pseudo, email, created_at FROM users WHERE id = ?")
    .get(req.session.userId);
  res.json(user || { pseudo: null });
});

app.patch("/api/auth/pseudo", requireAuth, (req, res) => {
  const newPseudo = (req.body.pseudo || "").trim();
  if (!PSEUDO_RE.test(newPseudo)) {
    return res.status(400).json({
      error: "Pseudo invalide (3-20 caractères, lettres/chiffres/_ uniquement).",
    });
  }
  const existing = db
    .prepare("SELECT id FROM users WHERE pseudo = ? AND id != ?")
    .get(newPseudo, req.session.userId);
  if (existing) {
    return res.status(409).json({ error: "Ce pseudo est déjà pris." });
  }
  db.prepare("UPDATE users SET pseudo = ? WHERE id = ?").run(newPseudo, req.session.userId);
  req.session.pseudo = newPseudo;
  res.json({ pseudo: newPseudo });
});

// --- Aide : construire les messages enrichis (réponses + réactions) ---

function attachExtras(rows, viewerId) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");

  const replyIds = [...new Set(rows.map((r) => r.reply_to_id).filter(Boolean))];
  let repliesById = {};
  if (replyIds.length > 0) {
    const rPlaceholders = replyIds.map(() => "?").join(",");
    const replyRows = db
      .prepare(
        `SELECT id, content, deleted FROM messages WHERE id IN (${rPlaceholders})`
      )
      .all(...replyIds);
    repliesById = Object.fromEntries(replyRows.map((r) => [r.id, r]));
  }

  const reactionRows = db
    .prepare(
      `SELECT message_id, emoji, COUNT(*) as count
       FROM reactions WHERE message_id IN (${placeholders})
       GROUP BY message_id, emoji`
    )
    .all(...ids);

  const myReactionRows = viewerId
    ? db
        .prepare(
          `SELECT message_id, emoji FROM reactions
           WHERE user_id = ? AND message_id IN (${placeholders})`
        )
        .all(viewerId, ...ids)
    : [];
  const myReactionByMsg = Object.fromEntries(myReactionRows.map((r) => [r.message_id, r.emoji]));

  const reactionsByMsg = {};
  for (const r of reactionRows) {
    if (!reactionsByMsg[r.message_id]) reactionsByMsg[r.message_id] = [];
    reactionsByMsg[r.message_id].push({ emoji: r.emoji, count: r.count });
  }

  return rows.map((r) => ({
    id: r.id,
    content: r.deleted ? null : r.content,
    deleted: !!r.deleted,
    created_at: r.created_at,
    isMine: viewerId ? r.user_id === viewerId : false,
    replyTo: r.reply_to_id
      ? {
          id: r.reply_to_id,
          content: repliesById[r.reply_to_id]
            ? repliesById[r.reply_to_id].deleted
              ? null
              : repliesById[r.reply_to_id].content
            : null,
        }
      : null,
    reactions: reactionsByMsg[r.id] || [],
    myReaction: myReactionByMsg[r.id] || null,
  }));
}

// --- Messages ---

app.get("/api/messages", (req, res) => {
  const search = (req.query.q || "").trim();
  let rows;
  if (search) {
    rows = db
      .prepare(
        `SELECT id, user_id, content, reply_to_id, created_at, deleted
         FROM messages
         WHERE hidden = 0 AND deleted = 0 AND content LIKE ?
         ORDER BY id DESC LIMIT 200`
      )
      .all(`%${search}%`);
  } else {
    rows = db
      .prepare(
        `SELECT id, user_id, content, reply_to_id, created_at, deleted
         FROM messages
         WHERE hidden = 0 AND deleted = 0
         ORDER BY id DESC LIMIT 200`
      )
      .all();
  }
  res.json(attachExtras(rows, req.session.userId || null));
});

app.get("/api/messages/trending", (req, res) => {
  const rows = db
    .prepare(
      `SELECT messages.id, messages.user_id, messages.content, messages.reply_to_id,
              messages.created_at, messages.deleted, COUNT(reactions.id) as reaction_count
       FROM messages
       LEFT JOIN reactions ON reactions.message_id = messages.id
       WHERE messages.hidden = 0 AND messages.deleted = 0
       GROUP BY messages.id
       HAVING reaction_count > 0
       ORDER BY reaction_count DESC
       LIMIT 5`
    )
    .all();
  res.json(attachExtras(rows, req.session.userId || null));
});

app.post("/api/messages", requireAuth, (req, res) => {
  const content = (req.body.content || "").trim();
  const replyToId = req.body.replyToId ? Number(req.body.replyToId) : null;

  if (!content) {
    return res.status(400).json({ error: "Le message est vide." });
  }
  if (content.length > 280) {
    return res.status(400).json({ error: "280 caractères maximum." });
  }

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const ipHash = hashIp(ip);

  if (isRateLimited(ipHash)) {
    return res.status(429).json({ error: "Trop de messages, respire un peu 😅" });
  }
  if (containsBlockedContent(content)) {
    return res.status(400).json({
      error: "Message bloqué : insulte, menace ou contenu haineux détecté.",
    });
  }

  if (replyToId) {
    const target = db.prepare("SELECT id FROM messages WHERE id = ?").get(replyToId);
    if (!target) {
      return res.status(400).json({ error: "Message d'origine introuvable." });
    }
  }

  const info = db
    .prepare(
      "INSERT INTO messages (user_id, content, reply_to_id, ip_hash) VALUES (?, ?, ?, ?)"
    )
    .run(req.session.userId, content, replyToId, ipHash);

  const created = db
    .prepare(
      `SELECT id, user_id, content, reply_to_id, created_at, deleted
       FROM messages WHERE id = ?`
    )
    .get(info.lastInsertRowid);

  res.status(201).json(attachExtras([created], req.session.userId)[0]);
});

app.delete("/api/messages/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
  if (!msg) return res.status(404).json({ error: "Message introuvable." });
  if (msg.user_id !== req.session.userId) {
    return res.status(403).json({ error: "Tu ne peux supprimer que tes propres messages." });
  }
  db.prepare("UPDATE messages SET deleted = 1, content = NULL WHERE id = ?").run(id);
  res.json({ ok: true });
});

// --- Réactions ---

app.post("/api/messages/:id/react", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const emoji = (req.body.emoji || "").trim();
  if (!emoji) return res.status(400).json({ error: "Emoji manquant." });

  const msg = db.prepare("SELECT id FROM messages WHERE id = ?").get(id);
  if (!msg) return res.status(404).json({ error: "Message introuvable." });

  const existing = db
    .prepare("SELECT * FROM reactions WHERE message_id = ? AND user_id = ?")
    .get(id, req.session.userId);

  if (existing && existing.emoji === emoji) {
    db.prepare("DELETE FROM reactions WHERE id = ?").run(existing.id);
  } else if (existing) {
    db.prepare("UPDATE reactions SET emoji = ? WHERE id = ?").run(emoji, existing.id);
  } else {
    db.prepare(
      "INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)"
    ).run(id, req.session.userId, emoji);
  }

  const rows = db
    .prepare(
      `SELECT id, user_id, content, reply_to_id, created_at, deleted
       FROM messages WHERE id = ?`
    )
    .all(id);
  res.json(attachExtras(rows, req.session.userId)[0]);
});

app.listen(PORT, () => {
  console.log(`SUP'NYME lancé sur http://localhost:${PORT}`);
});
