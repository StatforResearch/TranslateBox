# Déployer TranslateBox

## 1. Préparer le serveur

Utiliser un serveur Linux avec Docker Engine et Docker Compose v2. Le domaine doit pointer vers son adresse publique (DNS A, et AAAA uniquement si IPv6 est correctement routé). Autoriser les ports TCP 80/443 ; UDP 443 est facultatif pour HTTP/3. Ne pas exposer le port backend 8001.

L’application conserve ses événements en mémoire. Garder **une seule réplique backend et un seul worker Uvicorn**. Pas de MongoDB, Redis ou GPU nécessaire pour cette version. L’interprétation exige une connexion Internet vers OpenAI.

## 2. Configurer les secrets et HTTPS

```sh
cp .env.example .env
python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
```

Éditer `.env` :

| Variable | Valeur |
| --- | --- |
| `SITE_ADDRESS` | Domaine, par exemple `translate.exemple.fr` |
| `CORS_ORIGINS` | Origine exacte `https://translate.exemple.fr` (sans chemin) |
| `OPENAI_API_KEY` | Clé d’un projet ayant accès à `gpt-realtime-translate` et du crédit |
| `OPERATOR_TOKEN` | Code aléatoire généré ci-dessus, minimum 32 caractères |
| `MAX_LISTENERS` | `30` par défaut |

Ne pas versionner `.env`. Le code opérateur donne accès à la création de sessions qui consomment le budget du projet OpenAI ; le partager uniquement avec les opérateurs autorisés. Le PIN d’un événement est destiné aux auditeurs, pas à l’administration.

Caddy obtient et renouvelle le certificat automatiquement pour le domaine configuré. Les volumes `caddy_data` et `caddy_config` conservent son état. Si un autre service occupe 80/443, libérer ces ports ou adapter explicitement l’intégration au reverse proxy existant.

## 3. Démarrer et vérifier

```sh
docker compose config --quiet
docker compose up -d --build --wait
docker compose ps
curl --fail https://translate.exemple.fr/api/health
```

Le contrôle de santé confirme que le serveur répond et indique si une clé est configurée. Il **ne vérifie pas** sa validité, le crédit ou l’accès au modèle.

Ouvrir le domaine, se connecter avec `OPERATOR_TOKEN`, sélectionner un casque et lancer `Test`. Après validation du niveau micro, démarrer une courte traduction FR → EN puis EN → FR. Créer un événement avec PIN, ouvrir son lien sur un second appareil et vérifier l’audio. Tester aussi une arrivée après le début du flux, l’arrêt/reprise opérateur, une coupure réseau et le bouton Pause.

Un redémarrage backend invalide les liens d’événement existants. Recréer l’événement après redémarrage et diffuser le nouveau QR code. Le certificat et les fichiers de configuration sont persistants ; les événements ne le sont pas.

## 4. Mise à jour et retour arrière

Conserver le SHA Git ou l’archive de la version déployée. Avant une mise à jour, arrêter l’événement en cours puis :

```sh
git pull --ff-only
docker compose up -d --build --wait
```

Pour revenir à une version précédente, restaurer son code et relancer la même commande. `docker compose down` arrête la stack ; éviter `down -v`, qui supprimerait aussi les certificats stockés. Les journaux se consultent avec `docker compose logs --tail=100 backend web`.

## 5. Configuration avancée

- Le frontend utilise l’origine courante pour HTTP et WS. En hébergement séparé seulement, définir `VITE_BACKEND_URL=https://api.exemple.fr` au build et ajouter l’origine du frontend à `CORS_ORIGINS`. Le Dockerfile fourni correspond au déploiement sur une seule origine.
- Le backend accepte les en-têtes de proxy provenant du réseau privé Compose ; Caddy remplace `X-Forwarded-For` par l’adresse observée. Si le backend est exposé autrement, configurer `FORWARDED_ALLOW_IPS` avec les seules adresses de proxy de confiance, jamais `*` sur un port public.
- `SESSION_RATE_LIMIT_MAX` (20), `SESSION_RATE_LIMIT_WINDOW` (60 secondes), `MAX_BODY_BYTES` (32768), `MAX_EVENTS` (100) et `EVENT_TTL_SECONDS` (86400) sont réglables dans l’environnement backend. Les limites sont en mémoire, partagées par adresse IP ; les auditeurs derrière le même NAT partagent la limite de connexions (120/minute).
- Rotation du code opérateur : changer `OPERATOR_TOKEN` puis recréer le conteneur backend. Les sessions et événements existants sont interrompus.

## État de validation

Build frontend, tests serveur et frontend et audit npm exécutés localement. Connexion console, création d’événement/QR et connexion auditeur vérifiées dans un navigateur. Docker absent de la machine de validation : exécution des conteneurs et émission réelle du certificat à confirmer par la CI et sur le serveur. Aucun appel payant de traduction ni essai microphone réel effectué.
