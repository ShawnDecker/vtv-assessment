# Aligned Hearts — Google Play Store Build

## Prerequisites
- Node.js 16+
- Java JDK 11+ (for Android signing)
- Android SDK (or Android Studio)

## Steps to Build APK

### 1. Install Bubblewrap
```bash
npm install -g @anthropic-ai/anthropic-sdk @nicolo-ribaudo/bubblewrap
```
Or use Google's version:
```bash
npm install -g @nicolo-ribaudo/bubblewrap-cli
```

### 2. Initialize the project
```bash
cd twa
bubblewrap init --manifest https://assessment.valuetovictory.com/manifest.json
```

### 3. Build the APK
```bash
bubblewrap build
```
This generates `app-release-signed.apk` in the current directory.

### 4. Test on device
```bash
adb install app-release-signed.apk
```

### 5. Upload to Google Play Console
1. Go to https://play.google.com/console
2. Create new app: "Aligned Hearts"
3. Category: Social > Dating
4. Content rating: 18+
5. Upload the signed APK/AAB
6. Fill in store listing (description, screenshots, etc.)
7. Complete data safety form
8. Submit for review

## Store Listing Content

**Title:** Aligned Hearts — Values-Based Dating

**Short Description:**
Faith-based dating powered by P.I.N.K. — match on character, not just chemistry.

**Full Description:**
Aligned Hearts is a values-based dating app built on the P.I.N.K. Value Engine.

Instead of swiping based on looks alone, Aligned Hearts measures compatibility across 5 life pillars:
- Time — how you invest your hours
- People — who you surround yourself with
- Influence — the impact you have on others
- Numbers — your financial awareness
- Knowledge — how you learn and apply

Take the free P.I.N.K. assessment to discover your Master Score, then connect with people whose values align with yours.

Features:
- 3-axis compatibility scoring (pillar alignment + interests + preferences)
- Faith-based matching for Christians seeking purpose-driven relationships
- Secure messaging after mutual match
- 30-day free trial
- Built by a Navy veteran and certified life coach

Love. Values. Purpose.

**Category:** Social > Dating
**Content Rating:** Mature 17+
**Target Age:** 18+
**Privacy Policy:** https://assessment.valuetovictory.com/privacy
**Terms:** https://assessment.valuetovictory.com/terms
