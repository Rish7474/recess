"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import ProfileView, { type ProfileData } from "@/components/ProfileView";
import Link from "next/link";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });
  }, [supabase]);

  const fetchProfile = (userId: string) => {
    setProfileLoading(true);
    setProfileError(false);

    const serverUrl =
      process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";

    fetch(`${serverUrl}/api/profile/${userId}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => setProfile(data))
      .catch(() => { setProfile(null); setProfileError(true); })
      .finally(() => setProfileLoading(false));
  };

  useEffect(() => {
    if (!user) return;
    fetchProfile(user.id);
  }, [user]);

  const signInWith = async (provider: "google" | "discord") => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="text-lg font-bold tracking-tight">
          <span className="text-accent">RECESS</span>
        </Link>
        <Link
          href="/"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          Back to lobby
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-10 overflow-y-auto">
        {authLoading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : !user ? (
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
            <h2 className="text-xl font-bold text-foreground mb-2">
              Your Profile
            </h2>
            <p className="text-sm text-muted mb-6">
              Sign in to track your game history and earn badges.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => signInWith("google")}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-white text-black hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Google
              </button>
              <button
                onClick={() => signInWith("discord")}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#5865F2] text-white hover:bg-[#4752C4] transition-colors cursor-pointer"
              >
                Discord
              </button>
            </div>
          </div>
        ) : profileLoading ? (
          <p className="text-sm text-muted">Loading profile...</p>
        ) : profileError ? (
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted mb-3">Could not load profile. Check your connection and try again.</p>
            <button
              onClick={() => user && fetchProfile(user.id)}
              className="text-sm text-accent hover:underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : profile ? (
          <ProfileView data={profile} />
        ) : (
          <p className="text-sm text-muted">Could not load profile.</p>
        )}
      </main>
    </div>
  );
}
