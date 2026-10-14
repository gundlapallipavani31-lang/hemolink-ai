This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Safe Firebase QA environment

The QA environment uses only the Firebase Auth and Firestore emulators with the fixed demo project ID `demo-hemolink-qa`. QA mode is opt-in; both the browser Firebase SDK and server Firebase Admin SDK require the QA flags and exact loopback emulator settings. If QA configuration is missing or points elsewhere, initialization fails with a warning rather than falling back to a live project. Never use real patient data in this environment.

Prerequisites: Node.js dependencies installed, the Firebase CLI installed, and Java available for the Firestore emulator.

Start the emulators in one PowerShell terminal:

```powershell
cd C:\Projects\hemolink-ai
. .\scripts\qa-env.ps1
firebase emulators:start --only auth,firestore --project demo-hemolink-qa
```

In a second PowerShell terminal, seed the explicitly synthetic hospital, blood bank, verified memberships, test-only users, and inventory, then start Next.js:

```powershell
cd C:\Projects\hemolink-ai
. .\scripts\qa-env.ps1
npm run qa:seed
npm run dev
```

The seeder reports the local-only test credentials. Sign in through the regular login page at `http://localhost:3000/login`. Inventory fixtures include the existing synthetic O+ red-cell lot and a separate `qa-synthetic-a-positive-whole-blood` lot (2 available A+ whole-blood units) for reservation workflow testing. Inventory lots are created only when absent; reseeding does not reset existing lot quantities or reservations. The seeded emergency request fixture is labelled `SYNTHETIC QA ONLY`; no patient records are seeded.

In a third PowerShell terminal, run the authorization and end-to-end workflow checks:

```powershell
cd C:\Projects\hemolink-ai
. .\scripts\qa-env.ps1
npm run qa:verify
```

The verification checks that unauthenticated and wrong-role requests are denied, then exercises hospital request creation, admin assignment/acknowledgement/approval, blood-bank preparation/dispatch, and hospital receipt confirmation. It verifies the final `fulfilled` state and workflow events against Firestore Emulator.

To clean up, stop the Next.js process and Firebase emulators with `Ctrl+C` in their terminals. The emulators run without data import/export, so stopping them discards the synthetic Auth and Firestore data. Do not start the app with plain `npm run dev` when doing QA; source `scripts/qa-env.ps1` in that terminal first. QA does not require or use production Firebase credentials.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
