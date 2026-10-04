# Android build guide

This app uses Capacitor to package the Vite web app as an Android application. The automated workflow is defined in [`.github/workflows/android.yml`](../.github/workflows/android.yml).

## Automated build

The **Android build** GitHub Actions workflow runs for:

- pushes to `main` and `arena/**` branches;
- pull requests; and
- manual runs from **Actions → Android build → Run workflow**.

The workflow installs the locked npm dependencies, builds the web app, syncs the generated `dist/` files into the native project, and runs the Gradle debug build. When it succeeds, download the `signal-debug-apk-<run number>` artifact from the workflow run. The APK in that artifact comes directly from:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

The artifact is retained for 14 days. It is a debug APK intended for testing and can be installed with:

```bash
adb install -r app-debug.apk
```

Android may require permission to install an app from an unknown source. A debug APK is not suitable for Play Store distribution.

## Build locally

### Requirements

- Node.js 22
- npm
- JDK 21
- Android SDK with Android API 36 installed

From the repository root, run the same steps as CI:

```bash
npm ci
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

On Windows, use `gradlew.bat assembleDebug` for the final command. The resulting APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Relevant project files

- [`package.json`](../package.json) — web dependencies and the `npm run build` command.
- [`capacitor.config.ts`](../capacitor.config.ts) — Capacitor app ID, app name, and `dist` web output directory.
- [`android/app/build.gradle`](../android/app/build.gradle) — Android application ID, version, SDK settings, and build types.
- [`android/variables.gradle`](../android/variables.gradle) — minimum, compile, and target Android SDK versions.
- [`android/gradle/wrapper/gradle-wrapper.properties`](../android/gradle/wrapper/gradle-wrapper.properties) — pinned Gradle wrapper version.
- [`.github/workflows/android.yml`](../.github/workflows/android.yml) — CI build and artifact upload steps.

After changing web code, always run `npm run build` and `npx cap sync android` before invoking Gradle so the APK contains the current web bundle.

## Release signing

The workflow intentionally creates only a debug APK and does not require signing secrets. For a distributable release, configure a release signing block in `android/app/build.gradle`, store the keystore and passwords as GitHub Actions secrets, and build an Android App Bundle with `./gradlew bundleRelease`. Never commit a keystore or signing credentials to the repository.
