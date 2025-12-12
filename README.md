# TheCampusHelper

A secure, full-stack student resource platform featuring RBAC-protected resources, an academic calculator, AI-powered study assistant, and AI tools.

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

## 🎓 Features

### AI-Powered Study Assistant
An intelligent, context-aware tutoring system that helps students learn effectively:

- **Personalized Learning**: Adapts responses based on difficulty level (beginner, intermediate, advanced)
- **Conversation Memory**: Remembers the last 5 messages to provide contextual help
- **JNTUH-Specific**: Tailored for JNTUH curriculum with relevant examples and syllabus topics
- **Rich Content**: Supports LaTeX formulas and detailed visual descriptions
- **Subject & Topic Context**: Set your study context for focused, relevant explanations

#### Using the Study Assistant
1. Navigate to the Study Assistant page
2. Set your study context (subject, topic, difficulty level)
3. Ask questions and receive step-by-step explanations
4. The assistant remembers your conversation for better context
5. Change context anytime to study a different topic

**API Endpoint**: `/api/study-assistant`
- Secured with Firebase Authentication
- Rate-limited (10 requests/minute per user+IP)
- Uses Gemini AI for intelligent responses

## 🛠️ Deployment
Connect this repository to Vercel. The `api/` directory will automatically be deployed as Serverless Functions.