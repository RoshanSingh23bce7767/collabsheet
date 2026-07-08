import { getApps, initializeApp, cert, getApp, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getDatabase, Database } from "firebase-admin/database";

let app: App | undefined;

if (typeof window === "undefined") {
  try {
    const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    const privateKey = rawKey
      ? rawKey.replace(/\\n/g, "\n").replace(/^"|"$/g, "")
      : undefined;

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

    // Detect if the configuration is using sandbox/dummy values
    const isDummy =
      !privateKey ||
      privateKey.includes("MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC") ||
      clientEmail?.includes("firebase-adminsdk-xxxxx") ||
      projectId === "your_project_id" ||
      projectId === "collabsheet-demo";

    if (isDummy) {
      console.log("ℹ️ Collabsheet: running in local Sandbox Mode (Firestore Admin SDK is simulated/offline).");
    } else if (projectId && clientEmail && privateKey) {
      app = getApps().length > 0
        ? getApp()
        : initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey,
            }),
            databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
          });
    } else {
      console.warn("Firebase Admin credentials not fully configured in environment variables.");
    }
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

export const adminDb = app ? getFirestore(app) : null as unknown as Firestore;
export const adminRtdb = app ? getDatabase(app) : null as unknown as Database;
export { app as adminApp };

// Lazy-load firebase-admin/auth only when actually needed (avoids ESM/CJS crash on Vercel)
export async function getAdminAuth() {
  if (!app) return null;
  const { getAuth } = await import("firebase-admin/auth");
  return getAuth(app);
}
