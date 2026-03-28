# Firebase Setup

Project ID: `jawg-a3271`
Live URL: `https://jarvichi.github.io/jarvs-amazing-web-game/`

---

## Required: Authorize the GitHub Pages domain

Google sign-in (`signInWithPopup`) will fail with `auth/unauthorized-domain`
unless `jarvichi.github.io` is in Firebase's authorized domains list.

Firebase always authorizes `jawg-a3271.firebaseapp.com` and `localhost`
automatically. GitHub Pages needs to be added manually.

### Option A — REST API (recommended, works from Cloud Shell)

```bash
TOKEN=$(gcloud auth print-access-token)

curl -s -X PATCH \
  "https://identitytoolkit.googleapis.com/v2/projects/jawg-a3271/config?updateMask=authorizedDomains" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "authorizedDomains": [
      "jawg-a3271.firebaseapp.com",
      "localhost",
      "jarvichi.github.io"
    ]
  }'
```

If you get a 403, run `gcloud auth login` first and ensure the account has
the **Firebase Admin** or **Editor** role on project `jawg-a3271`.

### Option B — Firebase Console UI

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Select project **jawg-a3271**
3. Authentication → **Settings** tab → **Authorized domains**
4. Click **Add domain** → enter `jarvichi.github.io` → **Add**

> Note: as of early 2026 this section may not be visible in the UI —
> use Option A if the Settings tab only shows "User account linking".

---

## Required: Enable Google sign-in provider

1. Firebase Console → Authentication → **Sign-in method** tab
2. Click **Google** → toggle **Enable** → save

---

## Firestore Security Rules

Current rules are in `web/src/game/cloudSave.ts` (commented at the top).
Deploy them via the Firebase Console or CLI:

```bash
firebase deploy --only firestore:rules
```

The rules grant each authenticated user read/write access only to their own
document at `saves/{uid}`. Anonymous users have no access.

---

## Firebase CLI setup (optional)

```bash
npm install -g firebase-tools
firebase login
firebase use jawg-a3271
```

Useful commands:
- `firebase deploy --only firestore:rules` — push Firestore rules
- `firebase auth:export users.json` — export user list
