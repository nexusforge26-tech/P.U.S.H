"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/auth";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  unreadNotifications: number;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  unreadNotifications: 0,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const loadMe = useCallback(async (activeSession: Session | null) => {
    if (!activeSession?.access_token) {
      setUser(null);
      setProfile(null);
      setUnreadNotifications(0);
      setLoading(false);
      return;
    }

    setUser(activeSession.user);
    try {
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${activeSession.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile ?? null);
        setUnreadNotifications(Number(data.unreadNotifications ?? 0));
      } else {
        const { data: p } = await supabase
          .from("profiles")
          .select("id,email,full_name,avatar_url,role,phone,whatsapp,university_id")
          .eq("id", activeSession.user.id)
          .maybeSingle();
        setProfile((p as UserProfile | null) ?? null);
      }
    } catch {
      // تجاهل الأخطاء المؤقتة
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      loadMe(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession ?? null);
      loadMe(nextSession ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadMe]);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session ?? null);
    await loadMe(data.session ?? null);
  }, [loadMe]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    setUnreadNotifications(0);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        unreadNotifications,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
