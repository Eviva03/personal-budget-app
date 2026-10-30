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

## Neon Setup

1. Creez un projet dans le [dashboard Neon](https://console.neon.tech), puis activez **Data API** et **Neon Auth**.
2. Appliquez `neon/migrations/20261030000000_create_budget_schema.sql` sur la branche cible.
3. Creez `.env.local` a partir de `.env.example`, puis renseignez uniquement :

```bash
VITE_NEON_URL=https://YOUR_NEON_HOST/your_database
```

4. Dans la configuration Neon Auth, autorisez l'URL locale, par exemple `http://localhost:5173`, ainsi que l'URL de production Vercel. Le fournisseur e-mail partage de Neon envoie des codes de connexion; un SMTP personnalise est necessaire pour les Magic Links.

Ne placez jamais dans un fichier frontend un mot de passe de base de donnees, une cle secrete ou un secret JWT.

## Import de documents

- Les releves CSV peuvent utiliser les separateurs `;`, `,` ou tabulation. Les colonnes date, libelle/description et montant sont reconnues sous leurs noms francais ou anglais usuels.
- Chaque ligne est validee et affichee avant import. Les montants negatifs de relevés bancaires sont normalises en depenses positives.
- Les PDF contenant du texte affichent un apercu a verifier. Pour un PDF scanne, l'OCR s'execute localement dans le navigateur, sans cle ni service distant.
- L'OCR est volontairement limite aux trois premieres pages et son texte n'est jamais importe automatiquement: il doit etre controle avant toute saisie.

## Assistant Gemini optionnel

L'assistant est appele uniquement depuis une fonction serveur et ne doit jamais recevoir une cle dans le navigateur. La migration Neon cree ses tables de quota. Ajoutez ces variables dans l'environnement Vercel:

```bash
VITE_NEON_URL=https://YOUR_NEON_HOST/your_database
NEON_URL=https://YOUR_NEON_HOST/your_database
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=YOUR_APPROVED_GEMINI_FLASH_MODEL
```

Les fonctions `api/import-assistant.ts`, `api/document-assistant.ts` et `api/analysis-assistant.ts` partagent une limite de 20 demandes par utilisateur et par mois. Leur compteur global estime 0,01 EUR par demande, signale 3 EUR et bloque les nouvelles demandes a 5 EUR.

- L'assistant d'import propose des categories pour les lignes ambigues.
- L'assistant documentaire propose une lecture structuree d'un releve, d'une facture ou d'un ticket.
- Depuis la page **Analyse**, l'analyse intelligente produit sur demande un resume, des risques avant la paie, des depenses inhabituelles et des pistes budgetaires. Elle ne modifie jamais les donnees.

Chaque resultat reste une proposition a verifier par l'utilisateur.

## Gestion du budget

- La page **Categories** permet de creer, renommer, colorer et supprimer les categories personnelles.
- Les transactions et engagements peuvent etre modifies ou supprimes depuis leurs listes respectives.
- La page **Historique** compare les six derniers mois selon le revenu, la reserve, les transactions et les engagements enregistres.
- Depuis le profil connecte, **Telecharger ma sauvegarde** genere un fichier JSON contenant les reglages, categories, transactions et engagements de l'utilisateur.