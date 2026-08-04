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

The rules live in **`firestore.rules`** at the repo root — the single source of
truth. `firebase.json` points the CLI at it. They cover player saves
(`saves/{uid}`, readable/writable only by that authenticated user; anonymous
users have no access) plus the daily/weekly leaderboards and other collections.

### Automatic deploy

The `deploy-firebase` job in `.github/workflows/deploy.yml` pushes the rules on
every merge to `main`. It needs one repo secret:

| Secret | What it is |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | The **full JSON key** of a service account with the *Firebase Rules Admin* role (`roles/firebaserules.admin`; `roles/firebase.admin` also works) |

Create it in the Google Cloud console under IAM → Service Accounts → Keys →
Add key → JSON, then paste the whole file into the secret.

If the secret is unset the job **warns and skips** rather than failing, so a
green workflow does not by itself prove the rules deployed — check the job log.

> **Why a JSON key and not Workload Identity Federation?** WIF is the better
> practice, but `firebase-tools` currently discards ADC/WIF credentials and dies
> with a misleading "Failed to authenticate, have you run firebase login?"
> ([firebase-tools#10726](https://github.com/firebase/firebase-tools/issues/10726)).
> A JSON key is long-lived — rotate it periodically.

### Manual deploy

```bash
firebase deploy --only firestore:rules --project jawg-a3271
```

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
