# 27-0 Android app (Capacitor)

This repository still ships the **web / Vercel** game. Android is a Capacitor shell that packages a **static export** of the same frontend (`out/`). It does **not** load the live website as its main UI.

There is **no iOS** project in this repo.

---

## Quick commands

| Goal | Command |
|------|---------|
| Web (Vercel) | `npm run build` |
| Mobile static export | `npm run build:mobile` |
| Copy + sync into Android | `npm run cap:sync` |
| Build export **and** sync | `npm run android` |
| Open Android Studio | `npm run android:open` |
| Regenerate icons | `npm run icons:mobile` |

After you change game code in Cursor, update the Android app with:

```bash
npm run android
```

Or step by step:

```bash
npm run build:mobile
npx cap sync android
```

Then open Android Studio (`npm run android:open`) and Run on a device/emulator.

---

## ANDROID SETUP

### 1. What software you need

- **Node.js** (LTS) and npm — already used for this project
- **Android Studio** (includes Android SDK, emulator tools, and Gradle support)
- **JDK 17 or 21** (Android Studio’s bundled JBR is fine). Command-line Gradle will fail on Java 8.
- A Windows PC with enough disk for the Android SDK (~several GB)

> This machine may only have an old Java 8 JRE until Android Studio (or Temurin 21) is installed. Install Android Studio first — then use its JDK, or set `JAVA_HOME` to a JDK 17+ before running `gradlew`.

Optional but useful:

- A USB cable for a real phone
- Git (already used for this repo)

### 2. Install / configure Android Studio

1. Download Android Studio from Google’s official site:  
   https://developer.android.com/studio
2. Run the installer and complete the setup wizard.
3. When prompted, install at least:
   - Android SDK
   - Android SDK Platform (API **36** matches this project’s target)
   - Android SDK Build-Tools
   - Android Emulator (if you want virtual devices)
4. Open **Settings → Languages & Frameworks → Android SDK** and confirm SDK Platform **36** (or the latest available) is installed.
5. Note your SDK path (often `C:\Users\<you>\AppData\Local\Android\Sdk`).  
   Capacitor / Gradle will use `android/local.properties` (gitignored) for this path once Android Studio opens the project.

### 3. How to build 27-0 for mobile

From the project root:

```bash
npm install
npm run build:mobile
```

This sets `CAPACITOR_BUILD=1`, so Next.js writes a **static export** into `out/`.  
Normal Vercel builds still use `npm run build` (no static export).

### 4. How to sync Capacitor

```bash
npx cap sync android
```

Or:

```bash
npm run cap:sync
```

This copies `out/` into `android/app/src/main/assets/public` and updates native plugins.

### 5. How to open Android Studio

```bash
npm run android:open
```

Equivalent:

```bash
npx cap open android
```

First open may take a while while Gradle downloads dependencies.

---

## REAL PHONE

### 1. Enable Developer Options

1. On the phone: **Settings → About phone**.
2. Tap **Build number** seven times until it says you are a developer.

### 2. Enable USB debugging

1. **Settings → System → Developer options** (wording varies by manufacturer).
2. Turn on **USB debugging**.

### 3. Connect the phone

1. Plug in USB.
2. On the phone, accept the **Allow USB debugging?** prompt (tick “Always allow” if you trust this PC).
3. If needed, set USB mode to **File transfer / MTP**.

### 4. Run 27-0 on the phone

1. Sync the latest web build: `npm run android`
2. Open Android Studio: `npm run android:open`
3. In the device dropdown at the top, select your phone.
4. Click the green **Run** button (or **Run → Run ‘app’**).
5. Wait for the install; 27-0 should launch as a normal app (no Chrome URL bar).

---

## EMULATOR

### 1. Create an Android Virtual Device

1. In Android Studio: **Device Manager** (phone icon in the toolbar / Tools menu).
2. **Create Device**.
3. Pick a phone profile (e.g. Pixel 6).
4. Download a system image (API 34+ recommended) and finish the wizard.

### 2. Start the emulator

Start it from Device Manager, or select it in the Run device dropdown (Android Studio starts it).

### 3. Run 27-0

Same as the real phone: select the emulator → **Run ‘app’**.

A real phone is usually better for touch / safe-area checks.

---

## TEST APK

### 1. Generate a debug APK

**Option A — Android Studio**

1. Open the Android project (`npm run android:open`).
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
3. When finished, click **locate** in the notification.

**Option B — command line** (from the `android` folder, after SDK is set up):

```bash
cd android
.\gradlew.bat assembleDebug
```

### 2. Where the APK appears

Typical path:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

(APK files under `android/app/build/` are gitignored.)

### 3. Install manually on a phone

1. Copy `app-debug.apk` to the phone (USB, Drive, etc.).
2. Open the file on the phone.
3. Allow **Install unknown apps** for that file source if prompted.
4. Install and open **27-0**.

Debug APKs are for testing only (not Play Store release builds).

---

## GOOGLE PLAY

### 1. How an AAB is generated

After signing is configured in Android Studio / Gradle:

```bash
cd android
.\gradlew.bat bundleRelease
```

Typical output:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

You can also use **Build → Generate Signed Bundle / APK** in Android Studio.

### 2. What signing is

Google Play requires a **release keystore** (private key) so only you can publish updates for `com.twentysevenzero.game`.  
Play App Signing usually holds the app signing key; you keep an upload keystore.

### 3. What you will need before release

- Google Play Console developer account
- Release keystore / upload key (create once; store securely offline)
- Store listing (title, description, screenshots, feature graphic)
- Privacy policy URL if you collect accounts / personal data
- Content rating questionnaire
- Target API level that meets Play’s current requirement (this project targets SDK **36**)
- Production `versionCode` / `versionName` bumps for each upload

### 4. Do **not** generate production credentials yet

This repo does **not** include a production keystore or passwords.  
Do not commit `*.keystore` / `*.jks` or put secrets in source.

When you are ready to publish, create a keystore locally (Android Studio wizard or `keytool`) and keep credentials out of git.

---

## UPDATING 27-0 AFTER CODE CHANGES

Whenever you change the game in Cursor:

```bash
npm run android
npx cap open android
```

Then Run on device/emulator again.

If you only need to refresh web assets already built:

```bash
npx cap copy android
```

Prefer `cap sync` after dependency or plugin changes.

---

## Architecture notes

| Concern | Behaviour |
|---------|-----------|
| Web / Vercel | `npm run build` — normal Next.js server build |
| Android package | `npm run build:mobile` → static `out/` → Capacitor `webDir` |
| App ID | `com.twentysevenzero.game` |
| App name | `27-0` |
| Config | `capacitor.config.ts` |
| Permissions | `INTERNET` only |
| Storage | Same browser `localStorage` / IndexedDB inside the WebView |
| Online features | Auth / leaderboard / analytics still need network; offline play of local modes should work from packaged assets |
| iOS | Not installed / not configured |

---

## Versioning

- Public web footer version: `data/version.ts` → `GAME_VERSION`
- Android `versionName` / `versionCode`: `android/app/build.gradle`  
  Keep these aligned when you ship a Play build (e.g. `0.78` / `78` for `v0.78`).
