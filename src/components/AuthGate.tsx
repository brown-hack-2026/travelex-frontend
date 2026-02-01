"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useAtom } from "jotai";
import { userAtom } from "@/utils/atom";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useAtom(userAtom);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="text-sm text-neutral-500">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-dvh flex flex-col justify-between p-6 bg-neutral-950 text-white">
        <div className="space-y-2">
          <div className="text-2xl font-semibold">Tour Guide</div>
          <div className="text-neutral-300 text-sm">
            Tap places on the map, get audio guides, and generate a shareable
            recap.
          </div>
        </div>

        <button
          className="w-full rounded-2xl py-3 font-medium bg-white text-neutral-950 active:scale-[0.99]"
          onClick={() => signInWithPopup(auth, googleProvider)}
        >
          Continue with Google
        </button>

        <div className="text-[11px] text-neutral-400">
          Hackathon build — auth is just to keep sessions tied to you.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <div className="fixed top-3 right-3 z-50">
        <button
          className="rounded-full px-3 py-1 text-xs bg-white/90 text-neutral-900 shadow"
          onClick={() => signOut(auth)}
        >
          Sign out
        </button>
      </div>
      {children}
    </div>
  );
}
