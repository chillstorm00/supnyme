// Filtre de modération simple : liste de mots à bloquer + détection de spam.
// Objectif : bloquer les insultes/injures les plus courantes et le
// harcèlement direct (menaces, incitation). Liste volontairement non
// exhaustive : à compléter selon les retours des étudiants.

const BLOCKED_WORDS = [
  "connard", "connasse", "salope", "pute", "putain de",
  "batard", "enculé", "enculer", "nique ta mère", "fils de pute",
  "sale pd", "sale gouine", "tg mdr crève", "va crever", "va mourir",
  "je vais te tuer", "je vais te frapper", "suicide toi", "vas te suicider",
];

function containsBlockedContent(text) {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // enlève les accents pour mieux matcher

  return BLOCKED_WORDS.some((word) => normalized.includes(word));
}

// Anti-spam très simple : limite le nombre de messages par empreinte IP
// sur une fenêtre glissante, en mémoire (suffisant pour un petit site).
const submissionLog = new Map(); // ipHash -> [timestamps]

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_PER_WINDOW = 3;

function isRateLimited(ipHash) {
  const now = Date.now();
  const timestamps = (submissionLog.get(ipHash) || []).filter(
    (t) => now - t < WINDOW_MS
  );
  timestamps.push(now);
  submissionLog.set(ipHash, timestamps);
  return timestamps.length > MAX_PER_WINDOW;
}

module.exports = { containsBlockedContent, isRateLimited };
