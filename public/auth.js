// Si déjà connecté, on saute direct au mur.
(async function redirectIfLoggedIn() {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data.pseudo) window.location.href = "index.html";
  } catch (e) {
    /* silencieux */
  }
})();

const errorEl = document.getElementById("error");

const loginForm = document.getElementById("form-login");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const pseudo = document.getElementById("pseudo").value.trim();
    const password = document.getElementById("password").value;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        errorEl.textContent = data.error || "Erreur de connexion.";
        return;
      }
      window.location.href = "index.html";
    } catch (e) {
      errorEl.textContent = "Connexion au serveur impossible.";
    }
  });
}

const registerForm = document.getElementById("form-register");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const pseudo = document.getElementById("pseudo").value.trim();
    const password = document.getElementById("password").value;
    const email = document.getElementById("email").value.trim();

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo, password, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        errorEl.textContent = data.error || "Erreur d'inscription.";
        return;
      }
      // Inscription = connexion automatique (session déjà créée côté serveur)
      window.location.href = "index.html";
    } catch (e) {
      errorEl.textContent = "Connexion au serveur impossible.";
    }
  });
}
