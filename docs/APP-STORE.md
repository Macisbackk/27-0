# 27-0 on the App Store and Google Play

The iPhone and Android apps are the **same code as the website**. GitHub Actions builds a static
export of the Next.js site (`npm run build:mobile`, `CAPACITOR_BUILD=1`) and wraps it in Capacitor.
Vercel keeps deploying the website from `main` exactly as before (`next build`, no static export).

Nothing here needs a Mac: every iPhone build, signature and upload happens on GitHub's macOS runners.

| Workflow | When it runs | What you get |
|---|---|---|
| **App builds** (`.github/workflows/app-build.yml`) | every push to `main`, every PR to `main`, or by hand | Android debug APK + AAB, iPhone simulator build + unsigned archive. With the secrets below: signed Android AAB uploaded to Play internal testing and a signed iPhone build uploaded to TestFlight (push to `main`, or a manual run with **upload** ticked). |
| **iPhone project (generate)** (`.github/workflows/ios-project.yml`) | by hand (Actions tab), or when its own files change on a branch | Creates/refreshes `ios/`, app icon, splash, App Store settings, and commits them back to the branch. |

---

## How the website and the apps stay in sync

- **One version number.** `data/version.ts` → `GAME_VERSION` (e.g. `v1.15`) becomes the app version on
  both stores (`CFBundleShortVersionString` / `versionName` = `1.15`). Bump it for a release as you do now.
- **Build numbers** come from the **App builds** run number: iPhone `CFBundleVersion` = run number,
  Android `versionCode` = 2000 + run number. They only ever go up, which is what both stores require.
- **Every merge to `main`** deploys the website (Vercel) *and* produces app builds. With the secrets in
  place it also puts the new build in TestFlight and Play internal testing. Store releases to the
  public still need you to press "Submit for review" (Apple) / "Promote to production" (Google): the
  stores review each version, so the apps trail the website by the review time (usually 1-2 days).
- Game content, data and fixes ship with each app build (the app doesn't load the live site), so the
  app works offline. Accounts, leaderboards and cloud saves talk to the same Supabase project as the site.

---

## What only you can do (one-off)

### 1. Apple Developer Program (£79 / year)

1. On an iPhone or the web, enrol at <https://developer.apple.com/programs/enroll/> as an
   **Individual** (your own name shows as the seller) or an **Organisation** (needs a D-U-N-S number).
   Enrolment needs two-factor auth on your Apple Account and can take 1-2 days to be approved.
2. Note your **Team ID**: <https://developer.apple.com/account> → Membership details (10 characters,
   e.g. `AB12CD34EF`).

### 2. Register the bundle ID and create the app record

1. <https://developer.apple.com/account/resources/identifiers/list> → **+** → App IDs → App →
   Description `27-0`, **Explicit** Bundle ID **`com.twentysevenzero.game`**. No extra capabilities are
   needed (no push, no Sign in with Apple, no Associated Domains). Continue → Register.
2. <https://appstoreconnect.apple.com/apps> → **+** → New App:
   - Platform **iOS**, Name **27-0** (if taken, try "27-0 Rugby League"), Primary language English (UK),
   - Bundle ID `com.twentysevenzero.game`, SKU `27-0`, User access Full Access.

### 3. App Store Connect API key (lets GitHub sign and upload)

1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** →
   Team Keys → **+**. Name `GitHub Actions`, Access **Admin** (needed so Xcode can create the
   distribution certificate and provisioning profile in the cloud; "App Manager" can upload but can't
   create certificates).
2. Download the `.p8` file (you can only download it once) and note the **Key ID** and the
   **Issuer ID** shown at the top of the page.

### 4. GitHub secrets

GitHub → the 27-0 repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value | Used for |
|---|---|---|
| `APPLE_TEAM_ID` | Team ID from step 1 | iPhone signing |
| `APP_STORE_CONNECT_KEY_ID` | Key ID from step 3 | iPhone signing + TestFlight upload |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID from step 3 | iPhone signing + TestFlight upload |
| `APP_STORE_CONNECT_PRIVATE_KEY` | the whole text of the `.p8` file, including the `-----BEGIN PRIVATE KEY-----` lines | iPhone signing + TestFlight upload |
| `ANDROID_KEYSTORE_BASE64` | upload keystore, base64 (see MOBILE_APP.md → Play Store release) | signed Android AAB |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password | signed Android AAB |
| `ANDROID_KEY_ALIAS` | e.g. `upload` | signed Android AAB |
| `ANDROID_KEY_PASSWORD` | key password (can match the keystore password) | signed Android AAB |
| `PLAY_SERVICE_ACCOUNT_JSON` | Google Play service account JSON key (see Google Play below) | Play internal testing upload |

Optional repository **variable** (same page, Variables tab): `PLAY_RELEASE_STATUS` = `completed` once
the Play listing has passed its first review (until then uploads go in as `draft`).

Until a group of secrets exists, that lane is simply skipped and the run stays green.

### 5. Supabase redirect URLs (so email links open the app)

Supabase dashboard → project **wpkwcaxzrmutacizenzg** → **Authentication → URL Configuration →
Redirect URLs** → Add URL, and add **both**:

```
com.twentysevenzero.game://auth/callback
com.twentysevenzero.game://auth/reset-password
```

(or the single wildcard `com.twentysevenzero.game://**`). Leave the **Site URL** as
`https://27-0.co.uk` and keep the existing website entries.

What this does: when someone signs up or asks for a password reset **in the app**, the email link
opens the app, logs them in and shows the right screen. Until these are added, Supabase falls back to
the Site URL, so the links open the website instead (the account still gets confirmed; they then log in
in the app). If someone opens the email on a computer, the email is confirmed but the browser can't
open the app: they just log in on their phone.

No other Supabase change is needed: the app logs in with email + password through the same project.
Also make sure `supabase/2026-10-22-delete-my-account.sql` has been applied (in-app account deletion
uses it; Apple requires in-app deletion for apps with accounts).

### 6. First run

1. Actions → **iPhone project (generate)** → Run workflow on `main` (only needed once; it has
   already been run for the `feat/app-store` branch).
2. Merge to `main` (or Actions → **App builds** → Run workflow with **upload** ticked).
3. ~15-30 min later the build shows in App Store Connect → TestFlight. Answer the export compliance
   question if asked (the app declares no non-exempt encryption, so it normally isn't asked).
4. Add yourself as an **internal tester** (TestFlight → Internal Testing → +), install the
   **TestFlight** app on your iPhone and try the build.

---

## App Store listing

### Screenshots

iPhone only (the app is set to iPhone; iPads run it in compatibility mode, so no iPad screenshots
are needed). Apple now accepts one size and scales it:

| Display | Size (portrait) | Required |
|---|---|---|
| 6.9" (iPhone 16/17 Pro Max) | **1320 × 2868** (or 1290 × 2796) | Yes, 3 to 10 images |
| 6.5" (older Max/Plus) | 1284 × 2778 or 1242 × 2688 | Only if you don't upload 6.9" |

Google Play: at least 2 phone screenshots (1080 × 1920 or larger, 16:9 or 9:16), a 512 × 512 icon
and a 1024 × 500 feature graphic.

`scripts/store-screenshots.mjs` already takes phone screenshots in CI (PR label `ui-audit`); take
final ones from the TestFlight build so they show the real app (Apple rejects screenshots with browser
chrome or that don't match the app).

### Text

- **Name**: 27-0 · **Subtitle** (30 chars): e.g. "Rugby League Manager & Quiz"
- **Category**: Games → Sports (secondary: Simulation)
- **Privacy policy URL**: <https://27-0.co.uk/privacy>
- **Support URL**: <https://27-0.co.uk> (or a mailto page) · **Marketing URL**: optional
- **Copyright**: "2026 <your name>"
- **Price**: Free. **In-app purchases: none.** Club Funds and Store items are earned in the game and
  can't be bought with money, so no In-App Purchase setup is needed. Keep it that way: selling Club
  Funds or Store items for real money would have to go through Apple's In-App Purchase.

### Age rating (questionnaire answers)

Everything **None / No**: no violence, no sexual content, no profanity, no drugs/alcohol/tobacco, no
simulated gambling (the player "spins" are not betting: nothing is staked or won in money),
no horror, no medical info, unrestricted web access **No** (external links open in an in-app
browser only for specific pages), no contests, no user-to-user messaging. The public coach names on
leaderboards count as **user-generated content: minimal**. Expected rating: **4+**.

### App Privacy ("nutrition label")

Based on what the app actually sends (Supabase only; the app has **no** analytics, ads or tracking SDKs;
Vercel Analytics runs on the website only and is switched off in the app build):

- Do you or your partners collect data? **Yes.**
- **Contact Info → Email Address**: collected, *linked to the user*, *not used for tracking*,
  purpose **App Functionality** (log-in, confirmation and password-reset emails).
- **Identifiers → User ID**: collected (account id + public coach name), linked, not tracking,
  **App Functionality**.
- **User Content → Gameplay Content**: collected (stats, leaderboard entries, Club Funds, Store
  items, Manager Mode save), linked, not tracking, **App Functionality**.
- Everything else (location, contacts, health, financial, browsing/search history, purchases,
  diagnostics, usage data, device ID): **Not collected.**
- Guests (no account) send nothing; their progress stays on the phone.

These match `ios-config/PrivacyInfo.xcprivacy`, which is bundled in the app.

### Review notes (App Review Information)

- **Sign-in required?** No. Paste a demo account anyway so the reviewer can see leaderboards and
  account deletion: create one in the app (e.g. `appreview@…` with a coach name like `AppReview`) and
  give the email + password.
- Notes (suggested):
  > 27-0 is a free, unofficial rugby league management game. Everything is playable without an
  > account. An optional account (email + password) saves progress online and enters public
  > leaderboards. Account deletion: Settings → Account → Delete account. There are no purchases;
  > Club Funds are an in-game currency earned by playing and can't be bought. The game data is
  > bundled in the app, so it works offline.
- **Contact**: your name, phone and email.

### Google Play specifics

1. Play Console (one-off US$25): create the app `27-0`, package `com.twentysevenzero.game`.
2. Upload the **first** signed AAB by hand (Play doesn't accept API uploads until the app exists with
   one release): download `27-0-android-release-…` from an App builds run → Testing → Internal testing
   → Create release. Opt in to **Play App Signing**.
3. Service account for CI uploads: Google Cloud console → create a service account → create a JSON key;
   Play Console → Users and permissions → Invite new user → the service account email → app access
   for 27-0 with "Release to testing tracks". Paste the JSON into `PLAY_SERVICE_ACCOUNT_JSON`.
4. Data safety form: same answers as Apple's privacy label (email, user ID, gameplay content;
   collected, not shared, encrypted in transit, deletion available in app and at
   <https://27-0.co.uk/delete-account>).
5. Content rating (IARC): answer as above; expect PEGI 3 / Everyone.

---

## What's in the app build (and not the website)

| | App | Website |
|---|---|---|
| Splash screen + app icon | native (generated from `resources/`) | PWA icons |
| Haptics | native Taptic Engine / vibrator on key taps (menu, player picks, tries, achievements) | Android browser vibrate as before |
| External links | in-app browser (SFSafariViewController / Custom Tabs), no browser chrome | new tab |
| Offline | game bundled in the app; banner while offline | service worker |
| Buy Me a Coffee links | **hidden** (Apple 3.1.1 / Play payments policy) | shown |
| "Install the app" prompts | **hidden** | shown |
| Vercel Analytics | **off** | on |
| Orientation | portrait (iPhone only on iOS) | any |
| Email links | `com.twentysevenzero.game://auth/…` opens the app | website |

## App Review risks to keep in mind

- **4.2 Minimum functionality**: mitigated (bundled offline game, native splash/haptics/status bar,
  no browser UI, in-app browser for outside links). Don't switch the app to loading the live website.
- **1.2 User-generated content**: coach names are public on leaderboards and there is no profanity
  filter or "report a name" button yet. Apple can ask for filtering + a way to report/block. Cheap
  fix if they do: a blocklist in `validateCoachName` and a "Report" mailto on leaderboard rows.
- **5.2 Intellectual property**: real club and player names. The disclaimer is in the footer; Apple
  may still ask for proof of rights for club names/crests. Crests are drawn by the game (no official
  logos) which helps.
- **3.1.1 Payments**: never add tip / donation / "buy Club Funds" links to the app build.
- **Season card sharing**: uses the iOS share sheet ("Save Image" needs the Photos permission
  string, which is set).
