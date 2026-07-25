# SUP'NYME

Mur de discussion anonyme pour les étudiants de SUP'PTIC, façon fil de discussion façon chat, avec comptes (pseudo), réactions emoji, réponses, suppression de ses propres messages, recherche et tendances.

## Lancer en local

```bash
npm install
npm start
```

Puis ouvre http://localhost:3000/login.html

## Pages

- `login.html` — écran de connexion
- `register.html` — écran d'inscription (connexion automatique après création du compte)
- `index.html` — le mur (fil de discussion), accessible uniquement connecté

## Fonctionnement

- **Comptes** : pseudo (3-20 caractères) + mot de passe (6 caractères min.) + email optionnel. Mots de passe hachés avec bcrypt.
- **Anonymat** : le pseudo n'apparaît jamais publiquement sur les messages — il ne sert qu'à se connecter et, en coulisses, à la modération.
- **Réactions** : picker d'emojis complet, une réaction par personne et par message (re-cliquer la retire).
- **Réponses** : citer un message existant ; si le message cité est supprimé, la citation affiche "message supprimé".
- **Suppression** : chacun peut supprimer ses propres messages (suppression douce : le contenu est effacé mais les réponses qui le citaient restent cohérentes).
- **Recherche** : filtre le fil par mot-clé.
- **Tendances** : les 5 messages ayant reçu le plus de réactions.
- **Thèmes** : 4 palettes de couleurs + mode sombre, choix mémorisé dans le navigateur (paramètre local, pas synchronisé entre appareils).
- **Modération automatique** : filtre anti-insultes/menaces + limite anti-spam (3 messages/minute par IP), toujours actifs même sans bouton "signaler" visible.

## Déployer gratuitement (ex. Render.com)

1. Crée un dépôt GitHub avec ces fichiers (structure identique : `public/` en dossier séparé)
2. Sur render.com → "New Web Service" → connecte le dépôt
3. Build command : `npm install`
4. Start command : `npm start`
5. Ajoute deux variables d'environnement avec des valeurs secrètes aléatoires différentes : `IP_SALT` et `SESSION_SECRET`

⚠️ Le fichier `anonwall.db` (SQLite) vit sur le disque du serveur. Sur les hébergeurs gratuits type Render, le disque peut être réinitialisé à chaque redéploiement — pense à activer un disque persistant si tu veux garder les messages dans la durée.

## Pistes pour une v2

- Notifications quand quelqu'un répond ou réagit
- Signets/favoris
- Statistiques personnelles (nombre de messages, réactions reçues)
- Partage d'un lien direct vers un message
