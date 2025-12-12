# TheCampusHelper

A secure, full-stack student resource platform featuring RBAC-protected resources, an academic calculator, and AI tools.

## 🔒 Security Architecture
This project uses a **Server-Side Proxy Architecture** to protect sensitive credentials (like the Gemini API Key).
*   **Frontend**: React + Vite (Client-Side).
*   **Backend**: Vercel Serverless Functions (`api/` folder).
*   **Database**: Firebase Firestore (Secured via `firestore.rules`).

> **CRITICAL**: The frontend **NEVER** calls the Gemini API directly. All AI traffic flows through `/api/generate`.

---

## 🚀 Getting Started

### 1. Environment Configuration
Create a `.env.local` file in the root. **DO NOT COMMIT THIS FILE.**

> **IMPORTANT:** Replace the values below with your actual API keys and secrets. Never commit real credentials to Git.

```env
# --- PUBLIC (Client-Side) ---
# Safe to expose in browser bundle.
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# --- PRIVATE (Server-Side ONLY) ---
# NEVER prefix with VITE_. Only accessible by api/ functions.
GEMINI_API_KEY=REDACTED

# Firebase Admin SDK (Required for server-side token verification)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="REDACTED_FIREBASE_PRIVATE_KEY"
```

### 2. Installation
```bash
npm install
```

### 3. Running Locally (Secure Mode)
**STOP:** Do not use `npm run dev`. It only runs the frontend (Vite) and cannot serve the `api/` backend functions, causing AI features to fail (404 Errors).

**You must use Vercel Dev:**
```bash
# Option A: Using the script (Recommended)
npm run dev:secure

# Option B: Manual
npx vercel dev
```

The app will start at `http://localhost:3000`.

---

## 🛡️ Security Audit Checklist
1.  **No Leaks**: Ensure `GEMINI_API_KEY` is not present in any file inside `src/`, `components/`, or `pages/`.
2.  **Git Hygiene**: Ensure `.env.local` is listed in `.gitignore`.
3.  **Proxy Usage**: Verify `services/firebase.ts` calls `fetch('/api/generate')`, not `google.generativeai`.
4.  **Database Rules**: Ensure `firestore.rules` does not contain `allow write: if true`.

## 📱 PWA Features

TheCampusHelper is a **Progressive Web App (PWA)** with the following features:

### Key Capabilities
- **Offline Support**: Access basic pages and cached resources without internet
- **App Installation**: Install the app on your device for a native app-like experience
- **Fast Loading**: Smart caching strategies for improved performance
- **Push Notifications**: Ready for future notification features
- **Mobile-First**: Optimized responsive design for all devices

### Caching Strategy
The PWA implements intelligent caching for:
- **Google Fonts**: Cached for 1 year (CacheFirst)
- **Tailwind CDN**: Cached with automatic updates (StaleWhileRevalidate)
- **AI Studio CDN**: Cached for 1 week with updates (StaleWhileRevalidate)
- **API Calls**: Network-first with 5-minute fallback cache

### Installation
Users can install TheCampusHelper on:
- **Desktop**: Chrome, Edge, Opera (via browser install prompt)
- **Android**: Chrome, Edge, Samsung Internet (Add to Home Screen)
- **iOS**: Safari (Add to Home Screen via share menu)

The app will automatically prompt eligible users to install after a few seconds of use. The prompt can be dismissed and will reappear after 7 days.

## 🛠️ Deployment
Connect this repository to Vercel. The `api/` directory will automatically be deployed as Serverless Functions. The PWA service worker is automatically generated during the build process.