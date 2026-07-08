import { cookies } from "next/headers";
import { getAdminAuth } from "./firebase-admin";

export interface ServerUser {
  uid: string;
  name: string;
  email?: string;
}

export async function getServerUser(): Promise<ServerUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return null;
    }

    const adminAuth = await getAdminAuth();

    if (!adminAuth) {
      // Local fallback for build-time and development environments without admin credentials
      // Decode user info from client-saved cookies if available
      const userName = cookieStore.get("userName")?.value || "Local Developer";
      const userId = cookieStore.get("userId")?.value || "local-dev-uid";
      return {
        uid: userId,
        name: userName,
      };
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      name: decodedToken.name || "Anonymous User",
      email: decodedToken.email,
    };
  } catch (error) {
    console.error("Error in getServerUser:", error);
    return null;
  }
}
