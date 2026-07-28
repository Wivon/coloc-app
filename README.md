# ColocApp

Tâches, dépenses et comptes de colocation — une PWA installable sur l'écran
d'accueil, connexion par passkey.

- **Tâches** : tâches récurrentes réparties automatiquement, équilibrées selon
  la charge de chacun.
- **Dépenses** : partagées avec toute la coloc par défaut, ou avec une sélection.
- **Comptes** : soldes en direct et remboursements réduits au minimum de virements.
- **Insights** : dépenses par mois, catégorie et coloc.

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis remplissez les valeurs
npm run dev
```

### Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé `service_role`, **serveur uniquement** |
| `AUTH_SECRET` | Signature des cookies de session (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | Origine publique — sert de domaine aux passkeys |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Notifications push (`npx web-push generate-vapid-keys`) |
| `CRON_SECRET` | Protège `/api/cron/reminders` |

### Base de données

Appliquez `supabase/migrations/0001_init.sql` sur le projet Supabase (SQL Editor,
ou `supabase db push`). Toutes les tables ont RLS activé **sans aucune policy** :
seule la clé `service_role`, utilisée côté serveur, y accède. L'autorisation est
faite explicitement dans `src/lib/domain/`.

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run dev:https` | Idem en HTTPS — nécessaire pour tester les notifications |
| `npm run build` / `npm start` | Build et exécution en production |
| `npm run typecheck` | Types de routes + `tsc --noEmit` |
| `npm test` | Tests unitaires de la logique métier |
| `npm run icons` | Régénère les icônes PWA |

## Architecture

```
src/
  app/                 Routes App Router
    (app)/             Pages authentifiées (coquille + barre d'onglets)
    api/auth/          Cérémonies WebAuthn (passkeys)
    api/cron/          Rappels quotidiens
  actions/             Server Actions, une par domaine
  components/          UI — `ui/` = primitives réutilisables
  lib/
    auth/              Sessions (JWT en cookie) et passkeys
    db/                Client Supabase + types du schéma
    domain/            Règles métier ; `*-math.ts` = logique pure et testée
supabase/migrations/   Schéma SQL
```

Quelques règles pour ajouter une fonctionnalité :

1. **Le schéma d'abord** — une migration SQL, puis les types dans
   `src/lib/db/types.ts`.
2. **Les règles dans `lib/domain/`** — ces modules importent `server-only` et
   sont les seuls à parler à la base. La logique pure (calculs, répartition) vit
   dans un fichier `*-math.ts` séparé, sans dépendance serveur, donc testable.
3. **Les mutations dans `actions/`** — une Server Action renvoie toujours un
   `ActionResult` plutôt que de lever une erreur, pour que les formulaires
   affichent un message.
4. **Passer par `requireHouseholdContext()`** dans toute page authentifiée :
   c'est ce qui garantit que l'utilisateur appartient bien à la colocation.

### Répartition automatique des tâches

Une tâche porte une cadence (`frequency_days`) et un poids (`effort`, 1 à 5).
`planAssignments()` déroule les échéances à venir et attribue chacune au coloc
dont la charge cumulée est la plus faible — historique des 30 derniers jours et
planning à venir confondus. À date égale les tâches lourdes sont placées en
premier (heuristique LPT), ce qui laisse les petites combler les écarts.

Départages : celui qui a fait cette tâche-là le moins récemment, puis l'ordre
d'arrivée dans la coloc. Le résultat est déterministe, idempotent, et la rotation
s'installe sans mémoriser de « tour ».

### Authentification

Inscription et connexion par **passkey**, l'email servant d'identifiant. Le
serveur émet un challenge WebAuthn (`/api/auth/*/options`) et le vérifie
(`/api/auth/*/verify`), puis pose un cookie httpOnly contenant un JWT signé.

Les passkeys sont liées au domaine exact de `NEXT_PUBLIC_APP_URL` : une passkey
créée sur `localhost` ne fonctionnera pas en production, et inversement.

### Notifications push

Le service worker (`public/sw.js`) ne gère que les notifications — pas de cache
hors-ligne, donc aucun risque de servir une version périmée.

Sur iPhone, Safari n'autorise les notifications **que** si l'app a été ajoutée à
l'écran d'accueil (bouton Partager → « Sur l'écran d'accueil »). L'app détecte le
cas et affiche la marche à suivre.

Rappel quotidien des tâches — à planifier une fois par jour :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://votre-domaine/api/cron/reminders
```

Sur Vercel, ce cron est déjà déclaré dans `vercel.json` (tous les jours à 7h UTC).
Si `CRON_SECRET` est défini dans les variables d'environnement du projet, Vercel
l'envoie automatiquement en en-tête `Authorization: Bearer`.
