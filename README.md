# TheCampusHelper

A secure, full-stack student resource platform featuring RBAC-protected resources, an academic calculator, AI tools, and real-time collaboration features.

## ✨ Features

### 📚 Resource Management
- Upload and access subject resources (PPTs, MID Papers, PYQs, Important Qs)

## Resources structure (system-defined)

Resources are organized as:

- Semester
	- Subject
		- PPTs
		- MID Papers
		- PYQs
		- Important Qs

The four categories are system-defined (non-editable). New uploads must use one of these categories.

### Migration (no data loss)

If you have existing Firestore `resources` docs with legacy `unit` fields and/or legacy types (`Note`, `Lab Record`), run:

- Dry run: `npm run migrate:resources:categories`
- Apply: `node scripts/migrate-resources-to-categories.mjs`

This migration:
- Deletes the legacy `unit` field
- Normalizes `type` into one of: `PPT`, `MidPaper`, `PYQ`, `ImpQ`
- Preserves the original value in `legacyType` when mapping occurs
- Branch and semester-specific organization
- Admin-controlled approval workflow

### 🤝 Real-Time Collaboration (NEW)
- **Study Groups**: Create and join study groups by subject/branch
- **Live Chat**: Real-time messaging within study groups
- **Video Sessions**: Schedule and manage video study sessions
- **Collaborative Notes**: Shared notes that all group members can edit
- Real-time updates powered by Firestore

### 🧮 Academic Tools
- CGPA Calculator with GPA computation
- Online Code Compiler with multiple language support
- AI-powered content generation

### 🎉 Campus Events
- Browse upcoming hackathons, workshops, and cultural events
- Filter by category and search functionality
A secure, full-stack student resource platform featuring RBAC-protected resources, an academic calculator, AI-powered study assistant, and AI tools.

## ✨ Features

- **📚 Curated Resources**: Access verified notes, lab manuals, and previous question papers organized by branch and semester
- **🧠 AI-Generated Quizzes**: Create adaptive MCQ quizzes on any topic with instant feedback and detailed explanations
- **🧮 CGPA Calculator**: Calculate SGPA & CGPA with automatic JNTUH grade mapping and credit weightage
- **💻 Code Compiler**: In-browser code execution with support for multiple programming languages
- **🔐 Role-Based Access Control**: Secure authentication with admin and user roles
- **🎨 Dark/Light Mode**: Beautiful UI with theme switching support

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

If you're using Vercel, you can do the one-time local setup (links project + pulls dev env vars):
```bash
npm run local:init
```

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

# --- OPTIONAL (Client-side file uploads: PDF/PPTX) ---
# If Firebase Storage billing is not enabled, configure Cloudinary (free tier) for device uploads.
# Create an *unsigned* upload preset with resource type "raw" and allowed formats: pdf,pptx
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset

# --- PRIVATE (Server-Side ONLY) ---
# NEVER prefix with VITE_. Only accessible by api/ functions.
GEMINI_API_KEY=REDACTED

# Firebase Admin SDK (Required for server-side token verification)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="REDACTED_FIREBASE_PRIVATE_KEY"

# Upstash Redis (Required for rate limiting on AI endpoints)
UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token
```

### 2. Installation
```bash
npm install
```

### 3. Running Locally (Secure Mode)
**Use Vercel Dev (full stack):**
```bash
# Recommended
npm run dev

# Alias
npm run dev:secure

# Manual
npx vercel dev
```

The app will start at `http://localhost:3000`.

**Frontend-only (no `api/` functions):**
```bash
npm run dev:frontend
```
This starts Vite (usually at `http://localhost:5173`). AI/admin serverless routes will 404 in this mode.

---

## 🛡️ Security Audit Checklist
1.  **No Leaks**: Ensure `GEMINI_API_KEY` is not present in any file inside `src/`, `components/`, or `pages/`.
2.  **Git Hygiene**: Ensure `.env.local` is listed in `.gitignore`.
3.  **Proxy Usage**: Verify `services/firebase.ts` calls `fetch('/api/generate')`, not `google.generativeai`.
4.  **Database Rules**: Ensure `firestore.rules` does not contain `allow write: if true`.


## Phase-1 Runtime Toggle (Serverless-Only Mutations)

Phase-1 uses a single runtime toggle stored in Firestore:

- Document: `config/phase1`
- Field: `serverlessOnly: boolean`

Behavior:

- `serverlessOnly = true`: sensitive mutations route through serverless endpoints and Firestore rules disable legacy direct-write paths.
- `serverlessOnly = false` (or doc missing): clients fall back to legacy behavior for those paths.

This same toggle is read by both client code and Firestore rules to keep rollback one-switch and reversible.

### Admin Endpoint (Safe Toggle Flip)

To safely change the runtime toggle without using the Firebase console, use the admin-only serverless endpoint:

- `POST /api/admin/setPhase1Toggle`
- RBAC: **admin** or **super_admin** only
- Body: `{ "serverlessOnly": boolean, "reason"?: string }`

This endpoint writes `config/phase1.serverlessOnly` **atomically** and emits an audit log entry:

- `action: config.phase1.toggle`
- `metadata.before`  `metadata.after`
- `actorUid`, `actorRole`
- optional `metadata.reason`

Example (replace `ID_TOKEN` with an admin user's Firebase ID token):

```bash
curl -s -X POST "https://<your-domain>/api/admin/setPhase1Toggle" \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer ID_TOKEN" \
	-d '{"serverlessOnly":true,"reason":"Enable Phase-1 serverless-only"}'
```

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

## Phase-3 (System Brain) — Observer Only

Phase-3 is a **read-only** intelligence layer:

- It **must never** write data, expose mutation endpoints, or trigger workflows.
- It may only read server-authoritative data (e.g. `domainEvents`) and render advisory insights.

See [PHASE3.md](PHASE3.md) for the permanent invariant.
- Uses Gemini AI for intelligent responses

## 🛠️ Deployment
Connect this repository to Vercel. The `api/` directory will automatically be deployed as Serverless Functions.