const feed = document.getElementById("feed");
const loading = document.getElementById("loading");
const contentInput = document.getElementById("content");
const sendBtn = document.getElementById("send");
const composerForm = document.getElementById("composer-form");
const composerError = document.getElementById("composer-error");
const searchInput = document.getElementById("search");
const trendingSection = document.getElementById("trending");
const trendingList = document.getElementById("trending-list");
const replyPreview = document.getElementById("reply-preview");
const replyPreviewText = document.getElementById("reply-preview-text");
const replyCancel = document.getElementById("reply-cancel");

let replyingTo = null; // {id, content}
let searchDebounce = null;

const EMOJIS = ["👍","❤️","😂","😮","😢","🙏","🔥","😡","🎉","💯","👀","😴"];

// --- Session ---

function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(id)
  );
}

(async function checkSession() {
  try {
    const res = await fetchWithTimeout("/api/auth/me");
    const data = await res.json();
    if (!data.pseudo) {
      window.location.href = "login.html";
      return;
    }
    document.getElementById("settings-pseudo").value = data.pseudo;
    document.getElementById("settings-email").textContent = data.email || "Aucun email renseigné";
    init();
  } catch (e) {
    if (loading) {
      loading.outerHTML = `
        <div class="feed-empty">
          <p>Le serveur met du temps à répondre (ça arrive après une période d'inactivité).</p>
          <button id="retry-btn" class="btn-small" style="margin-top:0.6rem;">Réessayer</button>
        </div>`;
      const retryBtn = document.getElementById("retry-btn");
      if (retryBtn) retryBtn.addEventListener("click", () => window.location.reload());
    }
  }
})();

function init() {
  loadMessages();
  loadTrending();
  refreshNotifBadge();
  setInterval(loadMessages, 8000);
  setInterval(refreshNotifBadge, 15000);
}

// --- Utils ---

function formatTime(isoString) {
  const d = new Date(isoString + "Z");
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function dateLabel(isoString) {
  const d = new Date(isoString + "Z");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Aujourd'hui";
  if (sameDay(d, yesterday)) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
}

function truncate(text, n) {
  if (!text) return "";
  return text.length > n ? text.slice(0, n) + "…" : text;
}

// --- Rendu des messages ---

function renderReactions(msg) {
  if (!msg.reactions || msg.reactions.length === 0) return "";
  return `<div class="bubble__reactions">${msg.reactions
    .map(
      (r) =>
        `<button class="reaction-chip ${msg.myReaction === r.emoji ? "is-mine" : ""}" data-emoji="${r.emoji}" data-id="${msg.id}">${r.emoji} ${r.count}</button>`
    )
    .join("")}</div>`;
}

function renderMessage(msg) {
  const wrap = document.createElement("div");
  wrap.className = msg.isMine ? "bubble-row bubble-row--mine" : "bubble-row bubble-row--theirs";
  wrap.dataset.id = msg.id;

  const contentHtml = msg.deleted
    ? `<p class="bubble__content bubble__content--deleted">message supprimé</p>`
    : `<p class="bubble__content"></p>`;

  const replyHtml = msg.replyTo
    ? `<div class="bubble__reply">${msg.replyTo.content ? "" : "message supprimé"}</div>`
    : "";

  wrap.innerHTML = `
    <div class="bubble ${msg.isMine ? "bubble--mine" : ""}">
      ${replyHtml}
      ${contentHtml}
      ${renderReactions(msg)}
      <div class="bubble__meta">
        <div class="bubble__actions">
          ${!msg.deleted ? `<button class="action-react" title="Réagir"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>` : ""}
          ${!msg.deleted ? `<button class="action-reply" title="Répondre"><svg viewBox="0 0 24 24" fill="none"><path d="M9 10l-5 5 5 5M4 15h11a4 4 0 004-4V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ""}
          ${!msg.deleted ? `<button class="action-bookmark ${msg.isBookmarked ? "is-active" : ""}" title="Favori"><svg viewBox="0 0 24 24" fill="${msg.isBookmarked ? "currentColor" : "none"}"><path d="M6 4a2 2 0 012-2h8a2 2 0 012 2v17l-6-4-6 4V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>` : ""}
          ${!msg.deleted ? `<button class="action-share" title="Partager"><svg viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="2.5" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="2.5" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="2.5" stroke="currentColor" stroke-width="2"/><path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4" stroke="currentColor" stroke-width="2"/></svg></button>` : ""}
          ${msg.isMine && !msg.deleted ? `<button class="action-delete" title="Supprimer"><svg viewBox="0 0 24 24" fill="none"><path d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ""}
        </div>
        <span class="bubble__time">${formatTime(msg.created_at)}</span>
      </div>
    </div>
  `;

  if (!msg.deleted) {
    wrap.querySelector(".bubble__content").textContent = msg.content;
  }
  if (msg.replyTo) {
    const replyEl = wrap.querySelector(".bubble__reply");
    if (msg.replyTo.content) replyEl.textContent = truncate(msg.replyTo.content, 60);
  }

  const reactBtn = wrap.querySelector(".action-react");
  if (reactBtn) reactBtn.addEventListener("click", () => openReactionSheet(msg.id));

  const replyBtn = wrap.querySelector(".action-reply");
  if (replyBtn)
    replyBtn.addEventListener("click", () => setReplyTarget(msg.id, msg.content));

  const deleteBtn = wrap.querySelector(".action-delete");
  if (deleteBtn) deleteBtn.addEventListener("click", () => deleteMessage(msg.id));

  const bookmarkBtn = wrap.querySelector(".action-bookmark");
  if (bookmarkBtn) bookmarkBtn.addEventListener("click", () => toggleBookmark(msg.id, bookmarkBtn));

  const shareBtn = wrap.querySelector(".action-share");
  if (shareBtn) shareBtn.addEventListener("click", () => shareMessage(msg.id, shareBtn));

  wrap.querySelectorAll(".reaction-chip").forEach((chip) => {
    chip.addEventListener("click", () => sendReaction(msg.id, chip.dataset.emoji));
  });

  return wrap;
}

let isFirstRender = true;

function renderFeed(messages) {
  const wasNearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 120;
  const shouldScroll = isFirstRender || wasNearBottom;

  feed.innerHTML = "";
  if (messages.length === 0) {
    feed.innerHTML = `
      <div class="feed-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
        </svg>
        <p>Aucun message pour l'instant — sois le premier à écrire !</p>
      </div>`;
    isFirstRender = false;
    return;
  }

  let lastLabel = null;
  // Les messages arrivent du plus récent au plus ancien : on inverse pour l'affichage chronologique.
  const chrono = [...messages].reverse();

  chrono.forEach((msg) => {
    const label = dateLabel(msg.created_at);
    if (label !== lastLabel) {
      const sep = document.createElement("div");
      sep.className = "date-sep";
      sep.textContent = label;
      feed.appendChild(sep);
      lastLabel = label;
    }
    feed.appendChild(renderMessage(msg));
  });

  if (shouldScroll) {
    feed.scrollTop = feed.scrollHeight;
  }
  isFirstRender = false;
}

// --- Chargement ---

let currentSearch = "";

let hasHighlighted = false;

async function loadMessages() {
  try {
    const url = currentSearch ? `/api/messages?q=${encodeURIComponent(currentSearch)}` : "/api/messages";
    const res = await fetchWithTimeout(url);
    const messages = await res.json();
    if (loading) loading.remove();
    renderFeed(messages);
    if (!hasHighlighted) {
      hasHighlighted = true;
      highlightSharedMessage();
    }
  } catch (e) {
    feed.innerHTML = `<p class="feed-empty">Connexion au serveur impossible ou trop lente. <button id="retry-feed" class="btn-small">Réessayer</button></p>`;
    const retryFeed = document.getElementById("retry-feed");
    if (retryFeed) retryFeed.addEventListener("click", loadMessages);
  }
}

async function loadTrending() {
  try {
    const res = await fetch("/api/messages/trending");
    const messages = await res.json();
    if (messages.length === 0) {
      trendingSection.hidden = true;
      return;
    }
    trendingSection.hidden = false;
    trendingList.innerHTML = messages
      .map((m) => {
        const total = m.reactions.reduce((s, r) => s + r.count, 0);
        return `<div class="trending-item"><span>${escapeHtml(truncate(m.content || "message supprimé", 60))}</span><span>${total} réaction${total > 1 ? "s" : ""}</span></div>`;
      })
      .join("");
  } catch (e) {
    trendingSection.hidden = true;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Envoi / réponse / suppression ---

function setReplyTarget(id, content) {
  replyingTo = { id, content };
  replyPreviewText.textContent = truncate(content, 80);
  replyPreview.hidden = false;
  contentInput.focus();
}

replyCancel.addEventListener("click", () => {
  replyingTo = null;
  replyPreview.hidden = true;
});

composerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = contentInput.value.trim();
  composerError.textContent = "";
  if (!content) return;

  sendBtn.disabled = true;
  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        replyToId: replyingTo ? replyingTo.id : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      composerError.textContent = data.error || "Erreur inconnue.";
      return;
    }
    contentInput.value = "";
    replyingTo = null;
    replyPreview.hidden = true;
    isFirstRender = true; // force le retour en bas : c'est notre propre message qu'on vient d'envoyer
    loadMessages();
    loadTrending();
  } catch (e) {
    composerError.textContent = "Impossible d'envoyer, réessaie.";
  } finally {
    sendBtn.disabled = false;
  }
});

async function deleteMessage(id) {
  if (!confirm("Supprimer ce message ?")) return;
  try {
    await fetch(`/api/messages/${id}`, { method: "DELETE" });
    loadMessages();
    loadTrending();
  } catch (e) {
    /* silencieux */
  }
}

async function sendReaction(id, emoji) {
  try {
    await fetch(`/api/messages/${id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    loadMessages();
    loadTrending();
  } catch (e) {
    /* silencieux */
  }
  closeReactionSheet();
}

async function toggleBookmark(id, btn) {
  try {
    const res = await fetch(`/api/messages/${id}/bookmark`, { method: "POST" });
    const data = await res.json();
    btn.classList.toggle("is-active", data.bookmarked);
    btn.querySelector("svg").setAttribute("fill", data.bookmarked ? "currentColor" : "none");
  } catch (e) {
    /* silencieux */
  }
}

function showToast(text) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("is-visible"), 10);
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 250);
  }, 2000);
}

async function shareMessage(id) {
  const url = `${window.location.origin}/index.html?m=${id}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast("Lien copié !");
  } catch (e) {
    showToast(url);
  }
}

function highlightSharedMessage() {
  const params = new URLSearchParams(window.location.search);
  const targetId = params.get("m");
  if (!targetId) return;
  const el = feed.querySelector(`[data-id="${targetId}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const bubble = el.querySelector(".bubble");
  if (bubble) {
    bubble.classList.add("bubble--highlight");
    setTimeout(() => bubble.classList.remove("bubble--highlight"), 2000);
  }
}

// --- Recherche ---

searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    currentSearch = searchInput.value.trim();
    loadMessages();
  }, 300);
});

// --- Panneau réactions ---

const reactionSheet = document.getElementById("reaction-sheet");
const emojiGrid = document.getElementById("emoji-grid");
const reactionBackdrop = document.getElementById("reaction-backdrop");
let reactingToId = null;

function openReactionSheet(id) {
  reactingToId = id;
  emojiGrid.innerHTML = EMOJIS.map(
    (e) => `<button class="emoji-option" data-emoji="${e}">${e}</button>`
  ).join("");
  emojiGrid.querySelectorAll(".emoji-option").forEach((btn) => {
    btn.addEventListener("click", () => sendReaction(reactingToId, btn.dataset.emoji));
  });
  reactionSheet.hidden = false;
}
function closeReactionSheet() {
  reactionSheet.hidden = true;
  reactingToId = null;
}
reactionBackdrop.addEventListener("click", closeReactionSheet);

// --- Panneau paramètres ---

const settingsSheet = document.getElementById("settings-sheet");
const settingsBackdrop = document.getElementById("settings-backdrop");
document.getElementById("open-settings").addEventListener("click", () => {
  settingsSheet.hidden = false;
  syncPaletteButtons();
  document.getElementById("dark-toggle").checked = getSavedDarkMode();
  loadStats();
});
settingsBackdrop.addEventListener("click", () => (settingsSheet.hidden = true));

document.getElementById("save-pseudo").addEventListener("click", async () => {
  const pseudoError = document.getElementById("pseudo-error");
  pseudoError.textContent = "";
  const newPseudo = document.getElementById("settings-pseudo").value.trim();
  try {
    const res = await fetch("/api/auth/pseudo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pseudo: newPseudo }),
    });
    const data = await res.json();
    if (!res.ok) {
      pseudoError.textContent = data.error || "Erreur inconnue.";
      return;
    }
    pseudoError.style.color = "var(--c-accent)";
    pseudoError.textContent = "Pseudo mis à jour ✓";
  } catch (e) {
    pseudoError.textContent = "Connexion impossible.";
  }
});

function syncPaletteButtons() {
  const current = getSavedPalette();
  document.querySelectorAll(".swatch").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.palette === current);
  });
}

document.querySelectorAll(".swatch").forEach((btn) => {
  btn.addEventListener("click", () => {
    setPalette(btn.dataset.palette);
    syncPaletteButtons();
  });
});

document.getElementById("dark-toggle").addEventListener("change", (e) => {
  setDarkMode(e.target.checked);
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (e) {
    /* silencieux */
  }
  window.location.href = "login.html";
});

// --- Statistiques ---

async function loadStats() {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    document.getElementById("stat-messages").textContent = data.messageCount ?? 0;
    document.getElementById("stat-reactions").textContent = data.reactionsReceived ?? 0;
  } catch (e) {
    /* silencieux */
  }
}

// --- Notifications ---

const notifBadge = document.getElementById("notif-badge");
const notificationsSheet = document.getElementById("notifications-sheet");
const notificationsBackdrop = document.getElementById("notifications-backdrop");
const notificationsList = document.getElementById("notifications-list");

function notifText(n) {
  if (n.type === "reply") return "a répondu à ton message";
  if (n.type === "reaction") return "a réagi à ton message";
  return "nouvelle activité";
}

async function refreshNotifBadge() {
  try {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    if (data.unreadCount > 0) {
      notifBadge.textContent = data.unreadCount > 9 ? "9+" : data.unreadCount;
      notifBadge.hidden = false;
    } else {
      notifBadge.hidden = true;
    }
  } catch (e) {
    /* silencieux */
  }
}

document.getElementById("open-notifications").addEventListener("click", async () => {
  notificationsSheet.hidden = false;
  try {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    if (data.notifications.length === 0) {
      notificationsList.innerHTML = `<p class="feed-empty">Aucune notification pour l'instant.</p>`;
    } else {
      notificationsList.innerHTML = data.notifications
        .map(
          (n) => `
        <button class="notif-item ${n.read ? "" : "is-unread"}" data-message-id="${n.messageId}">
          <span class="notif-item__text">Quelqu'un ${notifText(n)}</span>
          <span class="notif-item__preview">${escapeHtml(truncate(n.preview || "message supprimé", 60))}</span>
        </button>`
        )
        .join("");
      notificationsList.querySelectorAll(".notif-item").forEach((item) => {
        item.addEventListener("click", () => {
          notificationsSheet.hidden = true;
          const el = feed.querySelector(`[data-id="${item.dataset.messageId}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            const bubble = el.querySelector(".bubble");
            if (bubble) {
              bubble.classList.add("bubble--highlight");
              setTimeout(() => bubble.classList.remove("bubble--highlight"), 2000);
            }
          }
        });
      });
    }
    await fetch("/api/notifications/read-all", { method: "POST" });
    refreshNotifBadge();
  } catch (e) {
    notificationsList.innerHTML = `<p class="feed-empty">Connexion impossible.</p>`;
  }
});
notificationsBackdrop.addEventListener("click", () => (notificationsSheet.hidden = true));

// --- Favoris ---

const bookmarksSheet = document.getElementById("bookmarks-sheet");
const bookmarksBackdrop = document.getElementById("bookmarks-backdrop");
const bookmarksList = document.getElementById("bookmarks-list");

document.getElementById("open-bookmarks").addEventListener("click", async () => {
  bookmarksSheet.hidden = false;
  try {
    const res = await fetch("/api/bookmarks");
    const messages = await res.json();
    if (messages.length === 0) {
      bookmarksList.innerHTML = `<p class="feed-empty">Aucun favori pour l'instant.</p>`;
      return;
    }
    bookmarksList.innerHTML = "";
    messages.forEach((m) => bookmarksList.appendChild(renderMessage(m)));
  } catch (e) {
    bookmarksList.innerHTML = `<p class="feed-empty">Connexion impossible.</p>`;
  }
});
bookmarksBackdrop.addEventListener("click", () => (bookmarksSheet.hidden = true));
