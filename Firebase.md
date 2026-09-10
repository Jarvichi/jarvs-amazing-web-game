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

### Deploying the rules — manual, and easy to forget

**Editing `firestore.rules` changes nothing until someone runs this:**

```bash
firebase deploy --only firestore:rules --project jawg-a3271
```

There is **no CI job that deploys the rules.** `deploy-firebase` was removed on
2026-08-09 (`497f2e5`) after it failed persistently with a 403 from
`serviceusage.googleapis.com` that resisted diagnosis. Merging to `main` deploys
the *site* and nothing else — a green workflow says nothing about the rules.

So the committed rules and the rules Firestore actually enforces drift apart
silently, and the failure mode is delayed and confusing: the code ships, the
collection it needs is denied, and the error surfaces in Rollbar days later as a
`permission-denied` nobody connects to a rules edit. That is exactly how
`userIndex` (#2264) broke — the rule was committed on 2026-08-29 and never
deployed, taking the account-deletion `allow delete` grants (#2090) and the
`chronicleVotes` tally down with it.

**Whenever a change adds or edits a `match` block, deploy the rules as part of
shipping it, and say so in the PR.** Verify afterwards in the Firebase Console
(Firestore → Rules) that the live text matches `firestore.rules` — the console
shows the deployed version and its timestamp.

> **If you ever revisit the CI job:** it needs a `FIREBASE_SERVICE_ACCOUNT`
> secret holding the full JSON key of a service account with
> `roles/firebaserules.admin`. Workload Identity Federation would be preferable,
> but `firebase-tools` discards ADC/WIF credentials and dies with a misleading
> "Failed to authenticate, have you run firebase login?"
> ([firebase-tools#10726](https://github.com/firebase/firebase-tools/issues/10726)).
> The 403 that killed the job last time is usually the service account lacking
> `roles/serviceusage.serviceUsageConsumer`, or the CLI resolving no quota
> project — untested against this project, so treat it as a starting point.

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
