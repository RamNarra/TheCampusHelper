# TheCampusHelper

A secure, full-stack student resource platform featuring RBAC-protected resources, an academic calculator, AI tools, and real-time collaboration features.

## ✨ Features

### 📚 Resource Management
- Upload and access study materials (Notes, PYQs, Lab Records, PPTs)
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

> **Note**: The current icon files are placeholder SVGs. For production deployment, replace these with proper PNG files generated at the required sizes (72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512). You can use tools like [Favicon Generator](https://realfavicongenerator.net/) or [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator) to create proper PWA icons from your logo.
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
Connect this repository to Vercel. The `api/` directory will automatically be deployed as Serverless Functions. The PWA service worker is automatically generated during the build process.