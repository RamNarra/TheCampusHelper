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

```env
# --- PUBLIC (Client-Side) ---
# Safe to expose in browser bundle.
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...

# --- PRIVATE (Server-Side ONLY) ---
# NEVER prefix with VITE_. Only accessible by api/ functions.
GEMINI_API_KEY=AIzaSy...
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

## 🛠️ Deployment
Connect this repository to Vercel. The `api/` directory will automatically be deployed as Serverless Functions.
