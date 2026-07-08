"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import Cookies from "js-cookie";

export interface UserInfo {
  uid: string;
  name: string;
  color: string;
  email?: string | null;
}

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  loginAnonymous: (name: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isSandbox: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const COLLABORATOR_COLORS = [
  "#2563EB", // Royal Blue
  "#10B981", // Emerald
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#F59E0B", // Amber
  "#06B6D4", // Cyan
  "#EF4444", // Red
  "#14B8A6", // Teal
];

function getRandomColor(): string {
  const randomIndex = Math.floor(Math.random() * COLLABORATOR_COLORS.length);
  return COLLABORATOR_COLORS[randomIndex];
}

const IS_SANDBOX =
  !process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "AIzaSyDummyKeyForBuildAndTesting";

function generateLocalUid(): string {
  return "local-" + Math.random().toString(36).substring(2, 12);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Sync sandbox cookies/state on mount; attach Firebase listener for real mode ──
  useEffect(() => {
    if (IS_SANDBOX) {
      const savedUid = localStorage.getItem("sandbox_uid");
      const savedName = localStorage.getItem("sandbox_name");
      const savedColor = localStorage.getItem("sandbox_color");

      if (savedUid && savedName && savedColor) {
        Cookies.set("token", "sandbox-token", { expires: 7 });
        Cookies.set("userId", savedUid, { expires: 7 });
        Cookies.set("userName", savedName, { expires: 7 });
        
        setTimeout(() => {
          setUser({ uid: savedUid, name: savedName, color: savedColor, email: null });
          setShowModal(false);
          setLoading(false);
        }, 0);
      } else {
        setTimeout(() => {
          setShowModal(true);
          setLoading(false);
        }, 0);
      }
      return;
    }

    // Real Firebase auth listener
    if (!auth) {
      setLoading(false);
      setShowModal(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        Cookies.set("token", token, { expires: 7, secure: true, sameSite: "strict" });

        let sessionColor = localStorage.getItem(`color_${firebaseUser.uid}`);
        if (!sessionColor) {
          sessionColor = getRandomColor();
          localStorage.setItem(`color_${firebaseUser.uid}`, sessionColor);
        }

        const name = firebaseUser.displayName || "Anonymous User";
        Cookies.set("userId", firebaseUser.uid, { expires: 7 });
        Cookies.set("userName", name, { expires: 7 });

        setUser({
          uid: firebaseUser.uid,
          name,
          color: sessionColor,
          email: firebaseUser.email,
        });
        setShowModal(false);
      } else {
        Cookies.remove("token");
        Cookies.remove("userId");
        Cookies.remove("userName");
        setUser(null);
        setShowModal(true);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ── Login: sandbox creates a local identity, real mode calls Firebase ──
  const loginAnonymous = useCallback(async (name: string) => {
    if (!name.trim()) return;
    setSubmitting(true);
    setAuthError("");

    if (IS_SANDBOX) {
      const uid = generateLocalUid();
      const color = getRandomColor();
      localStorage.setItem("sandbox_uid", uid);
      localStorage.setItem("sandbox_name", name.trim());
      localStorage.setItem("sandbox_color", color);
      Cookies.set("token", "sandbox-token", { expires: 7 });
      Cookies.set("userId", uid, { expires: 7 });
      Cookies.set("userName", name.trim(), { expires: 7 });
      setUser({ uid, name: name.trim(), color, email: null });
      setShowModal(false);
      setSubmitting(false);
      return;
    }

    try {
      const credential = await signInAnonymously(auth!);
      if (credential.user) {
        await updateProfile(credential.user, { displayName: name.trim() });
        const token = await credential.user.getIdToken(true);
        Cookies.set("token", token, { expires: 7, secure: true, sameSite: "strict" });
        Cookies.set("userName", name.trim(), { expires: 7 });

        let sessionColor = localStorage.getItem(`color_${credential.user.uid}`);
        if (!sessionColor) {
          sessionColor = getRandomColor();
          localStorage.setItem(`color_${credential.user.uid}`, sessionColor);
        }

        setUser({
          uid: credential.user.uid,
          name: name.trim(),
          color: sessionColor,
          email: null,
        });
        setShowModal(false);
      }
    } catch (err: unknown) {
      console.error("Anonymous sign in failed:", err);
      setAuthError("Failed to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, []);

  const loginGoogle = useCallback(async () => {
    setSubmitting(true);
    setAuthError("");

    if (IS_SANDBOX) {
      setAuthError("Google Sign-In requires a real Firebase project. Use a display name to join in Sandbox Mode.");
      setSubmitting(false);
      return;
    }

    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth!, provider);
    } catch (err: unknown) {
      console.error("Google sign in failed:", err);
      setAuthError("Failed to authenticate with Google.");
    } finally {
      setSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);

    if (IS_SANDBOX) {
      localStorage.removeItem("sandbox_uid");
      localStorage.removeItem("sandbox_name");
      localStorage.removeItem("sandbox_color");
      Cookies.remove("token");
      Cookies.remove("userId");
      Cookies.remove("userName");
      setUser(null);
      setShowModal(true);
      setLoading(false);
      return;
    }

    try {
      await signOut(auth!);
    } catch (err: unknown) {
      console.error("Logout failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading Collabsheet...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginAnonymous, loginGoogle, logout, isSandbox: IS_SANDBOX }}>
      {showModal ? (
        <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-2xl">
                📊
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Welcome to Collabsheet
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                A real-time collaborative spreadsheet editor. Choose how you want to join.
              </p>
              {IS_SANDBOX && (
                <span className="mt-3 inline-flex items-center rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-500 border border-amber-500/20">
                  🔧 Sandbox Mode — using local-only identity
                </span>
              )}
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <label
                  htmlFor="display-name"
                  className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                >
                  Enter a Display Name
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="display-name"
                    type="text"
                    placeholder="e.g., Jane Doe"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loginAnonymous(displayNameInput)}
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:focus:border-blue-500"
                  />
                  <button
                    onClick={() => loginAnonymous(displayNameInput)}
                    disabled={submitting || !displayNameInput.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Join
                  </button>
                </div>
              </div>

              {!IS_SANDBOX && (
                <>
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                    </div>
                    <span className="relative bg-white dark:bg-slate-900 px-3 text-xs text-slate-400 uppercase tracking-widest">
                      Or
                    </span>
                  </div>

                  <button
                    onClick={loginGoogle}
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition-all duration-200"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24">
                      <g transform="matrix(1, 0, 0, 1, 0, 0)">
                        <path
                          d="M21.35,11.1H12v2.7h5.38C16.88,15.75,14.88,17,12,17c-2.76,0-5-2.24-5-5s2.24-5,5-5c1.2,0,2.3.43,3.15,1.14l2-2C15.89,4.9,14.07,4,12,4c-4.41,0-8,3.59-8,8s3.59,8,8,8c4.6,0,7.65-3.23,7.65-7.8C19.65,11.75,19.5,11.43,21.35,11.1z"
                          fill="#4285F4"
                        />
                        <path
                          d="M4.35,7.65l2.73,2C7.77,8.39,9.72,7,12,7c2.07,0,3.87,1.16,4.8,2.87l2.7-2C17.75,5.18,15.09,4,12,4C8.58,4,5.74,5.49,4.35,7.65z"
                          fill="#EA4335"
                        />
                        <path
                          d="M12,20c3.12,0,5.81-1.22,7.56-3.18l-2.67-2.07C15.83,15.84,14.03,17,12,17c-2.28,0-4.23-1.39-4.92-3.35l-2.73,2.1C5.74,18.51,8.58,20,12,20z"
                          fill="#34A853"
                        />
                        <path
                          d="M7.08,13.65C6.9,13.13,6.8,12.58,6.8,12s0.1-1.13,0.28-1.65l-2.73-2.1C3.47,9.75,3,10.82,3,12s0.47,2.25,1.35,3.75L7.08,13.65z"
                          fill="#FBBC05"
                        />
                      </g>
                    </svg>
                    Continue with Google
                  </button>
                </>
              )}

              {authError && (
                <p className="text-center text-xs font-medium text-red-500">{authError}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
