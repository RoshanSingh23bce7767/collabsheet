import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getDatabase, type Database } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

const IS_DUMMY_KEY =
  !firebaseConfig.apiKey ||
  firebaseConfig.apiKey === "AIzaSyDummyKeyForBuildAndTesting";

// Singleton initialization — only create the app if we have a real key
// or if running on the client (where sandbox mode will handle the dummy case).
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let rtdb: Database | null = null;

if (!IS_DUMMY_KEY) {
  // Real Firebase credentials — initialize normally
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  rtdb = getDatabase(app);
} else if (typeof window !== "undefined") {
  // Dummy key but running on the client — Firebase Auth will fail,
  // but we still initialise the app so Firestore/RTDB references
  // can be created (sandbox hooks guard against actually using them).
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
    rtdb = getDatabase(app);
  } catch {
    // Silently ignore — sandbox mode handles everything locally
  }
  // Deliberately skip getAuth() — it throws with a dummy key.
  // AuthProvider's sandbox mode creates local identities instead.
}

export { app, auth, db, rtdb };
