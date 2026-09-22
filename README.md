# TranslateBox Live

Console d’interprétation vocale en temps réel et diffusion aux auditeurs par lien/QR code.
React + Vite, FastAPI, WebRTC vers OpenAI, WebSocket pour la diffusion.

## Démarrage local

Prérequis : Python 3.12 et Node.js 22.12+.

```sh
python3.12 -m venv .venv
.venv/bin/pip install -r backend/requirements.lock -r backend/requirements-dev.txt
cp backend/.env.example backend/.env
python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
```

Renseigner `OPENAI_API_KEY` et `OPERATOR_TOKEN` dans `backend/.env`. Le code opérateur généré est indépendant de la clé OpenAI. Ne jamais placer la clé OpenAI dans le frontend.

```sh
.venv/bin/uvicorn server:app --app-dir backend --host 127.0.0.1 --port 8001 --reload
```

Dans un autre terminal :

```sh
cd frontend
npm ci
npm start
```

Ouvrir <http://localhost:5173>, saisir le code opérateur, tester l’entrée audio puis démarrer la traduction. Vite transmet `/api` et les WebSockets au port 8001. Aucune variable frontend n’est nécessaire pour ce mode ou le déploiement standard.

## Déploiement HTTPS

Voir [DEPLOYMENT.md](DEPLOYMENT.md). Le dépôt contient une stack Docker Compose complète avec interface compilée, reverse proxy Caddy, HTTPS automatique et backend privé. MongoDB n’est pas nécessaire.

```sh
cp .env.example .env
# Renseigner domaine, origine HTTPS, clé OpenAI et code opérateur dans .env.
docker compose up -d --build
```

**Un seul worker et une seule réplique backend.** Les événements sont sauvegardés dans SQLite, sur le volume Docker `event_data`. Après redémarrage ou rechargement, utiliser **Saved events → Resume**, puis **START EVENT**, pour conserver le lien, le QR code et le PIN. La reprise renouvelle le jeton de publication et est refusée si un opérateur diffuse déjà. Les salles inactives expirent après 24 heures ; maximum 100 événements et 30 auditeurs par événement par défaut. Cette version vise une installation gérée par un opérateur de confiance, pas un service SaaS multi-utilisateurs.

## Utilisation

- Sélectionner la langue cible, le microphone et la sortie casque. L’audio source est automatiquement reconnu par le modèle.
- `Test` vérifie le niveau sans envoyer d’audio à OpenAI ; `START` lance une session payante selon votre compte OpenAI.
- Pour diffuser : créer un événement, partager son QR code et appuyer sur `START EVENT`. Le PIN auditeur est facultatif.
- Les auditeurs ouvrent `/e/<identifiant>` sans code opérateur, puis appuient sur `LISTEN`.
- Les sous-titres sont facultatifs. Désactiver leur diffusion efface le texte affiché chez les auditeurs connectés.
- Export TXT/PDF disponible dans les paramètres. « Save transcripts » conserve le texte dans la session de la page après arrêt ; ce n’est pas une sauvegarde durable.

## Sécurité et confidentialité

Les routes de création de session, d’événement et de statistiques exigent `Authorization: Bearer <OPERATOR_TOKEN>`. Le code opérateur reste en mémoire dans l’onglet et n’est pas intégré au build. Chaque événement possède un jeton de publication distinct, envoyé dans le premier message WebSocket, jamais dans le QR code ou l’URL. Le PIN est également envoyé dans le premier message.

La clé OpenAI reste sur le serveur. Le navigateur opérateur reçoit uniquement le secret temporaire et les métadonnées nécessaires. Les requêtes sont limitées en taille et fréquence. Les origines HTTP/WS sont explicitement configurées. Les enregistrements audio ne sont pas écrits sur disque par cette application ; des tampons audio temporaires existent en mémoire, et l’audio de traduction est traité par OpenAI. Les profils et préférences utilisent le stockage local du navigateur.

## Tests

```sh
PYTHONPATH=backend .venv/bin/pytest backend/unit_tests -q
cd frontend
npm ci
npm test
npm run build
npm audit
```

Ces tests sont hors ligne vis-à-vis d’OpenAI : aucune clé réelle ni crédit API nécessaire. Les fichiers historiques dans `backend/tests` et `test_reports` décrivent l’ancien environnement de prévisualisation ; ils ne sont pas la suite de validation de cette version. Ne pas les lancer contre une instance de production.

La CI ajoute la construction des deux images et un contrôle HTTP de la stack Compose.

## Limites à vérifier avant un événement réel

- Microphone et WebRTC : HTTPS obligatoire hors localhost.
- Diffusion : WebM/Opus via MediaRecorder et MediaSource. Chrome/Edge sont la cible ; Safari/iOS doit être testé sur les appareils exacts. Une erreur explicite s’affiche si le format est indisponible.
- Validation audio de bout en bout, arrivée tardive d’auditeurs, reprise après coupure et charge à 30 auditeurs restent à effectuer sur le réseau réel. Les tests automatisés ne prouvent pas la qualité audio ni la latence.
- La latence affichée est une estimation. Les profils/glossaires sont une tentative de personnalisation avec repli si le modèle les refuse.
- `/api/stats.openai_sessions` compte les opérateurs de diffusion connectés, pas les sessions OpenAI réelles ; une session utilisée uniquement dans la console n’est pas comptabilisée.

Intégration fondée sur la [documentation officielle de traduction temps réel](https://developers.openai.com/api/docs/guides/realtime-translation).
