# Frontend TranslateBox

React + Vite. Node.js 22.12+ requis.

```sh
npm ci
npm start
npm test
npm run build
```

La sortie de production est `dist/`. Le serveur de développement transmet `/api` (HTTP et WebSocket) à `http://127.0.0.1:8001`. `VITE_BACKEND_URL` est facultatif et réservé à un backend hébergé sur une origine distincte. Ne jamais fournir une clé OpenAI dans une variable frontend.

`.npmrc` conserve `legacy-peer-deps` pour les composants hérités du kit UI ; le lockfile fige les versions installées. Les scripts CRA/CRACO et les extensions de prévisualisation tierces ont été retirés.

Consulter les guides README et DEPLOYMENT à la racine pour les secrets opérateur, HTTPS et la compatibilité audio.
