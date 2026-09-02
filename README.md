# Sungkhar Tuanthu

Dark, glassmorphism family chronicle. Guests can read the origin, timeline, and tree. Only an authorized Admin Gmail can add, edit, or delete.

## Run locally

```bash
npm install
npm run dev
```

Use **Admin → Sign in with Google**. Keepers are the addresses in `VITE_ADMIN_EMAILS`.

## Firebase

1. Authentication → enable **Google**.
2. Authorized domains: `localhost` plus your live host.
3. Realtime Database: publish `database.rules.json` (writes limited to the keeper Gmails).
4. `.env` must include Firebase keys and `VITE_ADMIN_EMAILS`.

Anyone with the link can view. The first Admin sign-in publishes the sample chronicle if the database is empty; the Admin can then replace it.

## Media gallery

Everyone can open **Media** to view, preview, and play images, videos, and audio. **Add / Edit / Delete** link controls appear only for signed-in Admins. Links are stored in Realtime Database at `sungkhar/media` (external URLs — no Cloud Storage required).
