# 🚀 Deployment Guide - Gongcha Admin

## Ringkasan
- **Platform**: Vercel (Frontend + API Hosting)
- **Database**: Firebase Firestore (sudah terpasang)
- **Auth**: Firebase Auth + NextAuth.js

---

## 📋 Step-by-Step Deployment

### Step 1: Persiapan Environment Variables

#### 1.1 Firebase Client Config (Public)
Ambil dari Firebase Console > Project Settings > General > Your apps > SDK setup and configuration

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

#### 1.2 Firebase Admin SDK (Private)
**Opsi A - Base64 (Recommended):**
```bash
# Encode serviceAccountKey.json ke base64
base64 -i serviceAccountKey.json | pbcopy

# Paste ke Vercel sebagai:
FIREBASE_SERVICE_ACCOUNT_KEY_BASE64=your_base64_string_here
```

**Opsi B - Individual Fields:**
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

#### 1.3 NextAuth Secret
```bash
# Generate secret
openssl rand -base64 32

NEXTAUTH_SECRET=your_generated_secret_here
NEXTAUTH_URL=https://your-app.vercel.app  # atau custom domain
```

---

### Step 2: Deploy ke Vercel

#### Opsi A: Via Vercel Dashboard (Recommended untuk pertama kali)

1. **Login ke Vercel**: https://vercel.com/dashboard
2. **Add New Project** → Import Git Repository
3. **Pilih repository** project Anda
4. **Configure Project**:
   - Framework Preset: Next.js
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)
5. **Environment Variables**: Tambahkan semua variables dari Step 1
6. **Deploy** 🚀

#### Opsi B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

---

### Step 3: Konfigurasi Firebase Auth (WAJIB)

Setelah deploy, tambahkan domain Vercel ke Firebase Auth:

1. **Firebase Console** > Authentication > Settings > Authorized domains
2. **Add domain**: `your-app.vercel.app`
3. Jika pakai custom domain, tambahkan juga

---

### Step 4: Deploy Firestore Rules & Indexes

```bash
# Install Firebase CLI jika belum
npm install -g firebase-tools

# Login
firebase login

# Deploy rules dan indexes
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## 🔧 Troubleshooting

### Error: "Failed to load static props"
- Pastikan semua environment variables sudah di-set di Vercel
- Check spelling dan nilai variables

### Error: "Firebase App already exists"
- Ini normal, tidak masalah untuk production

### Error: "Unauthorized domain"
- Tambahkan domain Vercel ke Firebase Auth authorized domains

### Build Error: TypeScript/ESLint
- Sudah di-configure di `next.config.js` untuk ignore saat build

---

## 📊 Monitoring

- **Vercel Dashboard**: https://vercel.com/dashboard
  - Analytics, Logs, Performance
- **Firebase Console**: https://console.firebase.google.com
  - Database usage, Auth users, Security rules

---

## 🔄 Update Deployment

```bash
# Push ke Git (auto-deploy jika connected)
git add .
git commit -m "Update feature"
git push origin main

# Atau manual deploy
vercel --prod
```

---

## 💰 Biaya

| Service | Free Tier | Notes |
|---------|-----------|-------|
| Vercel | 100GB bandwidth, 10k API calls/month | Cukup untuk start |
| Firebase Auth | 10k users/month | Free |
| Firestore | 1GB storage, 50k reads/day | Monitor usage |

---

## ✅ Post-Deployment Checklist

- [ ] Website accessible di domain Vercel
- [ ] Login functionality works
- [ ] API routes responding (test: `/api/stores`)
- [ ] Firestore data loading correctly
- [ ] Images/assets loading
- [ ] Mobile responsive check

---

## 🆘 Butuh Bantuan?

- Vercel Docs: https://vercel.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment
- Firebase Support: https://firebase.google.com/support
