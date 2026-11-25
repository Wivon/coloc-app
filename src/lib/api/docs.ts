/**
 * Documentation de l'API personnelle, téléchargeable depuis les réglages.
 *
 * Générée plutôt que copiée dans `public/` : l'adresse de l'API dépend du
 * déploiement, et un fichier statique finirait par pointer vers le mauvais hôte.
 * Elle ne contient jamais le jeton — `<VOTRE_JETON>` reste à remplacer — pour
 * pouvoir être partagée ou versionnée sans risque.
 */
export function apiDocumentation(baseUrl: string): string {
  return `# API personnelle ColocApp

Lisez les données de votre colocation — dépenses, soldes, remboursements,
tâches, statistiques — depuis un script, un tableur, un raccourci iOS ou un
tableau de bord.

- **Adresse de l'API** : \`${baseUrl}\`
- **Accès** : lecture seule, uniquement la colocation dont vous êtes membre.
- **Format** : JSON (UTF-8).

---

## Authentification

Chaque requête porte votre jeton dans l'en-tête \`Authorization\` :

\`\`\`
Authorization: Bearer <VOTRE_JETON>
\`\`\`

Le jeton (\`coloc_…\`) se copie dans **Réglages → API personnelle**.

> **Le jeton vaut mot de passe.** Qui le possède peut lire tous les comptes de
> la coloc. Ne le collez pas dans une URL, ne le publiez pas dans un dépôt de
> code. S'il a fuité, appuyez sur **Régénérer** : l'ancien cesse aussitôt de
> fonctionner.

### Premier essai

\`\`\`bash
curl -H "Authorization: Bearer <VOTRE_JETON>" ${baseUrl}/summary
\`\`\`

---

## Conventions

| Sujet | Règle |
| --- | --- |
| Montants | **centimes entiers**, champs suffixés \`_cents\` — \`1250\` = 12,50 €. La devise est donnée par le champ \`currency\`. |
| Dates | \`AAAA-MM-JJ\` (ex. \`2026-09-14\`). Les horodatages sont en ISO 8601. |
| Mois | \`AAAA-MM\` (ex. \`2026-09\`). |
| Colocs | désignés par leur \`id\` (UUID), toujours accompagné de leur nom. |
| Soldes | \`net_cents\` > 0 : on doit de l'argent à la personne. < 0 : elle en doit. |
| Booléens en paramètre | \`true\` / \`false\` (ou \`1\` / \`0\`). |

Un paramètre mal formé n'est jamais ignoré : il renvoie une erreur \`400\`.

---

## Ressources

Toutes s'appellent en \`GET\`.

| Ressource | Contenu |
| --- | --- |
| [\`/summary\`](#get-summary) | Tout l'essentiel en un appel |
| [\`/household\`](#get-household) | La coloc et ses membres |
| [\`/expenses\`](#get-expenses) | Les dépenses et leur répartition |
| [\`/stats\`](#get-stats) | Statistiques d'un mois |
| [\`/balances\`](#get-balances) | Soldes et virements pour tout solder |
| [\`/settlements\`](#get-settlements) | Remboursements enregistrés |
| [\`/tasks\`](#get-tasks) | Agenda des tâches ménagères |
| [\`/chores\`](#get-chores) | Tâches récurrentes et charge de chacun |

\`GET ${baseUrl}\` (sans jeton) liste ces ressources ; \`GET ${baseUrl}/docs\`
renvoie ce document.

---

### GET /summary

Vue d'ensemble : la coloc, vos comptes, le mois en cours, les 10 dernières
dépenses et les tâches des 7 prochains jours. Idéal pour un widget.

Réponse : les champs de [\`/household\`](#get-household), plus
\`balances\` ([\`/balances\`](#get-balances)), \`month\` ([\`/stats\`](#get-stats)),
\`recent_expenses\` ([\`/expenses\`](#get-expenses)) et
\`upcoming_tasks\` ([\`/tasks\`](#get-tasks)).

---

### GET /household

\`\`\`json
{
  "household": { "id": "…", "name": "Talence", "currency": "EUR", "created_at": "2026-07-24T14:30:00Z" },
  "me": { "id": "…", "name": "Lilian", "email": "…" },
  "members": [
    { "id": "…", "name": "Lilian", "email": "…", "role": "owner", "is_me": true },
    { "id": "…", "name": "Nathan", "email": "…", "role": "member", "is_me": false }
  ]
}
\`\`\`

---

### GET /expenses

Dépenses, de la plus récente à la plus ancienne.

| Paramètre | Défaut | Description |
| --- | --- | --- |
| \`from\` | — | Début de période, \`AAAA-MM-JJ\`, incluse. |
| \`to\` | — | Fin de période, \`AAAA-MM-JJ\`, incluse. |
| \`limit\` | \`50\` | Nombre maximum de dépenses renvoyées (1 à 1000). |

\`has_more\` vaut \`true\` s'il reste des dépenses au-delà de \`limit\` : élargissez
\`limit\` ou resserrez la période plutôt que de calculer un total sur une liste
incomplète.

\`\`\`json
{
  "currency": "EUR",
  "count": 1,
  "has_more": false,
  "expenses": [
    {
      "id": "…",
      "date": "2026-09-14",
      "description": "Courses Lidl",
      "category": "courses",
      "category_label": "Courses",
      "amount_cents": 4237,
      "payer_id": "…",
      "payer_name": "Nathan",
      "created_by": "…",
      "shares": [
        { "user_id": "…", "name": "Lilian", "amount_cents": 1413 },
        { "user_id": "…", "name": "Nathan", "amount_cents": 1412 },
        { "user_id": "…", "name": "Tom", "amount_cents": 1412 }
      ],
      "my_share_cents": 1413
    }
  ]
}
\`\`\`

Catégories possibles : \`courses\`, \`maison\`, \`factures\`, \`loyer\`, \`resto\`,
\`transport\`, \`other\`.

---

### GET /stats

Statistiques d'un mois.

| Paramètre | Défaut | Description |
| --- | --- | --- |
| \`month\` | mois en cours | \`AAAA-MM\` |

\`\`\`json
{
  "currency": "EUR",
  "month": "2026-09",
  "total_cents": 84210,
  "previous_month_total_cents": 79100,
  "change_ratio": 0.0646,
  "expense_count": 23,
  "daily_average_cents": 2807,
  "by_category": [ { "category": "courses", "category_label": "Courses", "amount_cents": 31200, "ratio": 0.37 } ],
  "by_member": [ { "user_id": "…", "name": "Lilian", "paid_cents": 30100, "share_cents": 21050 } ],
  "trend": [ { "month": "2026-04", "amount_cents": 70210 } ],
  "top_expenses": [ "… même format que /expenses …" ]
}
\`\`\`

- \`change_ratio\` : variation par rapport au mois précédent (\`0.0646\` = +6,46 %),
  \`null\` si le mois précédent est vide.
- \`by_member\` : \`paid_cents\` est ce que la personne a **avancé**,
  \`share_cents\` ce qu'elle a réellement **consommé**.
- \`trend\` : les 6 derniers mois, jusqu'au mois demandé.

---

### GET /balances

Soldes de chacun et virements à faire pour tout remettre à zéro — les mêmes
chiffres que l'onglet Comptes.

\`\`\`json
{
  "currency": "EUR",
  "balances": [
    {
      "user_id": "…", "name": "Lilian",
      "net_cents": 2350,
      "paid_cents": 120000, "owed_cents": 98650,
      "settled_out_cents": 5000, "settled_in_cents": 24000
    }
  ],
  "transfers": [
    { "from_user_id": "…", "from_name": "Tom", "to_user_id": "…", "to_name": "Lilian", "amount_cents": 2350 }
  ],
  "me": {
    "net_cents": 2350,
    "i_owe": [],
    "owed_to_me": [ { "from_name": "Tom", "to_name": "Lilian", "amount_cents": 2350, "…": "…" } ]
  }
}
\`\`\`

\`transfers\` est déjà simplifié : au plus *n − 1* virements pour *n* colocs.

---

### GET /settlements

Remboursements enregistrés, du plus récent au plus ancien.

| Paramètre | Défaut | Description |
| --- | --- | --- |
| \`limit\` | \`50\` | 1 à 500 |

\`\`\`json
{
  "currency": "EUR",
  "settlements": [
    {
      "id": "…", "date": "2026-09-01",
      "from_user_id": "…", "from_name": "Tom",
      "to_user_id": "…", "to_name": "Lilian",
      "amount_cents": 2000, "note": "Lydia", "created_at": "…"
    }
  ]
}
\`\`\`

---

### GET /tasks

Échéances des tâches ménagères.

| Paramètre | Défaut | Description |
| --- | --- | --- |
| \`from\` | il y a 14 jours | \`AAAA-MM-JJ\` — le passé récent montre le retard. |
| \`to\` | dans 21 jours | \`AAAA-MM-JJ\`. La période ne peut dépasser 120 jours. |
| \`mine\` | \`false\` | \`true\` : seulement vos tâches. |
| \`include_done\` | \`false\` | \`true\` : inclure les tâches déjà faites. |

\`\`\`json
{
  "today": "2026-09-14",
  "from": "2026-08-31",
  "to": "2026-10-05",
  "tasks": [
    {
      "id": "…", "chore_id": "…",
      "title": "Sortir les poubelles", "emoji": "🗑️", "effort": 1,
      "due_on": "2026-09-13",
      "assignee_id": "…", "assignee_name": "Joshua",
      "done": false, "completed_at": null,
      "late": true
    }
  ]
}
\`\`\`

---

### GET /chores

Tâches récurrentes et charge de travail de chacun (30 derniers jours + 21 jours
à venir).

\`\`\`json
{
  "chores": [
    { "id": "…", "title": "Aspirateur", "emoji": "🧹", "effort": 2, "frequency_days": 7, "starts_on": "2026-07-24" }
  ],
  "workload": [
    { "user_id": "…", "name": "Lilian", "done_effort": 9, "pending_effort": 4 }
  ]
}
\`\`\`

\`effort\` va de 1 (rapide) à 5 (grosse corvée).

---

## Erreurs

Toujours le même format :

\`\`\`json
{ "error": { "code": "invalid_parameter", "message": "« month » doit être un mois AAAA-MM." } }
\`\`\`

| Statut | \`code\` | Quand |
| --- | --- | --- |
| 400 | \`invalid_parameter\` | Paramètre mal formé ou hors bornes. |
| 401 | \`missing_token\` | En-tête \`Authorization\` absent ou mal formé. |
| 401 | \`invalid_token\` | Jeton inconnu ou régénéré depuis. |
| 404 | \`unknown_resource\` | Faute de frappe dans le nom de la ressource. |
| 500 | \`internal_error\` | Problème côté serveur — réessayez plus tard. |

---

## Exemples

### JavaScript (navigateur ou Node 18+)

\`\`\`js
const API = '${baseUrl}';
const TOKEN = process.env.COLOC_TOKEN; // ne l'écrivez pas en dur dans le code

const res = await fetch(\`\${API}/balances\`, {
  headers: { Authorization: \`Bearer \${TOKEN}\` },
});
if (!res.ok) throw new Error((await res.json()).error.message);

const { me, currency } = await res.json();
const euros = (cents) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
console.log(\`Mon solde : \${euros(me.net_cents)}\`);
\`\`\`

### Python

\`\`\`python
import os, requests

API = "${baseUrl}"
headers = {"Authorization": f"Bearer {os.environ['COLOC_TOKEN']}"}

r = requests.get(f"{API}/expenses", headers=headers,
                 params={"from": "2026-09-01", "to": "2026-09-30", "limit": 1000})
r.raise_for_status()
data = r.json()

total = sum(e["my_share_cents"] for e in data["expenses"])
print(f"Ma part en septembre : {total / 100:.2f} {data['currency']}")
\`\`\`

### Shell + jq

\`\`\`bash
# Qui doit combien à qui
curl -s -H "Authorization: Bearer $COLOC_TOKEN" ${baseUrl}/balances \\
  | jq -r '.transfers[] | "\\(.from_name) → \\(.to_name) : \\(.amount_cents / 100) €"'

# Mes tâches en retard
curl -s -H "Authorization: Bearer $COLOC_TOKEN" "${baseUrl}/tasks?mine=true" \\
  | jq -r '.tasks[] | select(.late) | "\\(.emoji) \\(.title) — prévu le \\(.due_on)"'
\`\`\`

---

## Bon à savoir

- **Lecture seule.** Pour ajouter une dépense ou cocher une tâche depuis un
  assistant IA, utilisez plutôt le connecteur MCP (Réglages → Connecter votre IA).
- **Un jeton par personne.** Il donne votre point de vue : \`my_share_cents\`,
  \`me\` et \`mine=true\` se rapportent à vous.
- **Jeton distinct du lien MCP.** Régénérer l'un ne coupe pas l'autre.
- **Pas de cache.** Chaque appel renvoie l'état exact de la coloc à cet instant.
`;
}
