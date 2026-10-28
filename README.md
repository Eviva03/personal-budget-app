# Horizon

Horizon est une application de pilotage de budget personnel construite avec React, TypeScript et Vite.

## Prerequis

- Node.js 24 ou superieur
- npm 11 ou superieur

## Demarrage

```bash
npm install
npm run dev
```

Vite affiche ensuite l'URL locale dans le terminal, habituellement `http://localhost:5173`.

## Verification

```bash
npm run build
npm run lint
npm run test
```

`npm run build` execute la verification TypeScript avant de produire le dossier `dist`.

## Structure

```text
src/
  components/     Layout et navigation
  pages/          Pages de l'application
  App.tsx         Routes de la SPA
  main.tsx        Point d'entree React
```

Les routes SPA sont couvertes en deploiement par `vercel.json`. Les variables futures destinees au navigateur sont documentees dans `.env.example`.

## Supabase Setup

1. Creez un projet dans le [dashboard Supabase](https://supabase.com/dashboard).
2. Dans **Project Settings > API**, copiez `Project URL` et la cle `Publishable`.
3. Creez `.env.local` a partir de `.env.example`, puis renseignez uniquement :

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

4. Dans **SQL Editor**, executez le contenu de `supabase/migrations/20261027000000_create_profiles.sql`.
  Executez ensuite `supabase/migrations/20261027010000_create_budget_data.sql` pour creer les donnees budget et leurs policies RLS.
  Enfin, executez `supabase/migrations/20261027020000_grant_budget_api_access.sql` pour accorder les privileges SQL necessaires au role authentifie.
  Executez `supabase/migrations/20261027030000_create_budget_settings.sql` pour enregistrer le revenu mensuel et la reserve de chaque utilisateur.
  Executez `supabase/migrations/20261027040000_add_payday_to_budget_settings.sql` pour activer la timeline jusqu a la prochaine paie.
5. Dans **Authentication > URL Configuration**, ajoutez votre URL locale, par exemple `http://localhost:5173`, a **Redirect URLs**. Ajoutez egalement l'URL de production Vercel apres le premier deploiement.
6. Dans **Authentication > Providers > Email**, activez Email et Magic Link.

Ne placez jamais dans un fichier frontend un mot de passe de base de donnees, une `service_role key`, une cle secrete ou un secret JWT.

## Import de documents

- Les releves CSV peuvent utiliser les separateurs `;`, `,` ou tabulation. Les colonnes date, libelle/description et montant sont reconnues sous leurs noms francais ou anglais usuels.
- Chaque ligne est validee et affichee avant import. Les montants negatifs de relevés bancaires sont normalises en depenses positives.
- Les PDF contenant du texte affichent un apercu a verifier. Pour un PDF scanne, l'OCR s'execute localement dans le navigateur, sans cle ni service distant.
- L'OCR est volontairement limite aux trois premieres pages et son texte n'est jamais importe automatiquement: il doit etre controle avant toute saisie.

## Assistant Gemini optionnel

L'assistant est appele uniquement depuis une fonction serveur et ne doit jamais recevoir une cle dans le navigateur. Avant de l'activer, executez la migration `supabase/migrations/20261028010000_create_ai_import_usage.sql`, puis ajoutez ces variables uniquement dans l'environnement Vercel:

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=YOUR_APPROVED_GEMINI_FLASH_MODEL
```

La fonction `api/import-assistant.ts` limite chaque utilisateur a 20 demandes par mois. Son compteur global estime 0,01 EUR par demande, signale 3 EUR et bloque les nouvelles demandes a 5 EUR. L'assistant renvoie seulement des propositions de categories, qui restent a valider par l'utilisateur.

## Gestion du budget

- La page **Categories** permet de creer, renommer, colorer et supprimer les categories personnelles.
- Les transactions et engagements peuvent etre modifies ou supprimes depuis leurs listes respectives.
- La page **Historique** compare les six derniers mois selon le revenu, la reserve, les transactions et les engagements enregistres.
- Depuis le profil connecte, **Telecharger ma sauvegarde** genere un fichier JSON contenant les reglages, categories, transactions et engagements de l'utilisateur.