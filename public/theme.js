const PALETTES = {
  bleu: {
    light: { page: "#DDEFFB", surface: "#FFFFFF", header: "#CDE6F7", accent: "#2E7BD8", accentText: "#FFFFFF", bubbleAlt: "#EAF6FF" },
    dark: { page: "#0B1E3D", surface: "#132A52", header: "#0E2140", accent: "#4B92E6", accentText: "#FFFFFF", bubbleAlt: "#173561" },
  },
  violet: {
    light: { page: "#EAE6FB", surface: "#FFFFFF", header: "#DCD5F7", accent: "#6E5CD8", accentText: "#FFFFFF", bubbleAlt: "#F0ECFC" },
    dark: { page: "#1C1740", surface: "#28215A", header: "#1F1A48", accent: "#9384EA", accentText: "#FFFFFF", bubbleAlt: "#302868" },
  },
  vert: {
    light: { page: "#E1F5EC", surface: "#FFFFFF", header: "#CDEEDC", accent: "#1D9E75", accentText: "#FFFFFF", bubbleAlt: "#EAFAF3" },
    dark: { page: "#0C2A20", surface: "#123C2D", header: "#0E3225", accent: "#3FCB99", accentText: "#0C2A20", bubbleAlt: "#164A37" },
  },
  rose: {
    light: { page: "#FBEAF0", surface: "#FFFFFF", header: "#F6D6E3", accent: "#D4537E", accentText: "#FFFFFF", bubbleAlt: "#FDF0F5" },
    dark: { page: "#340F1F", surface: "#4A162E", header: "#3D1226", accent: "#E888AA", accentText: "#340F1F", bubbleAlt: "#571B37" },
  },
};

function getSavedPalette() {
  return localStorage.getItem("supnyme_palette") || "bleu";
}
function getSavedDarkMode() {
  return localStorage.getItem("supnyme_dark") === "1";
}

function applyTheme() {
  const paletteName = getSavedPalette();
  const dark = getSavedDarkMode();
  const palette = PALETTES[paletteName] || PALETTES.bleu;
  const colors = dark ? palette.dark : palette.light;

  const root = document.documentElement.style;
  root.setProperty("--c-page", colors.page);
  root.setProperty("--c-surface", colors.surface);
  root.setProperty("--c-header", colors.header);
  root.setProperty("--c-accent", colors.accent);
  root.setProperty("--c-accent-text", colors.accentText);
  root.setProperty("--c-bubble-alt", colors.bubbleAlt);
  root.setProperty("--c-text", dark ? "#EAF0FB" : "#1A2B3C");
  root.setProperty("--c-text-muted", dark ? "#9FB3D9" : "#8A9BAE");
  root.setProperty("--c-border", dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)");

  document.body.classList.toggle("is-dark", dark);
}

function setPalette(name) {
  localStorage.setItem("supnyme_palette", name);
  applyTheme();
}
function setDarkMode(enabled) {
  localStorage.setItem("supnyme_dark", enabled ? "1" : "0");
  applyTheme();
}

applyTheme();
