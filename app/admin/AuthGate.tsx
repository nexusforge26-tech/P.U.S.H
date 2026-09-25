"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const KEY="push_admin_access_token";

export default function AuthGate({children}:{children:React.ReactNode}){
 const[ready,setReady]=useState(false);const[authed,setAuthed]=useState(false);const[error,setError]=useState("");
 useEffect(()=>{
   let cancelled=false;
   (async()=>{
     const {data:{session}}=await supabase.auth.getSession();
     if(!session){if(!cancelled)setReady(true);return}
     const r=await fetch("/api/admin/users",{headers:{Authorization:`Bearer ${session.access_token}`}});
     if(cancelled)return;
     if(r.ok){sessionStorage.setItem(KEY,session.access_token);setAuthed(true)}else{await supabase.auth.signOut();setError("هذا الحساب لا يملك صلاحيات الإدارة.");}
     setReady(true);
   })();
   // Supabase silently refreshes the access token in the background
   // (autoRefreshToken: true). Without this listener, the token cached in
   // sessionStorage at login time goes stale after ~1 hour and every admin
   // API call starts failing with 401 until the page is reloaded. Keep the
   // cached token in sync with the live session, and drop admin access if
   // the session ends.
   const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
     if(event==="SIGNED_OUT"||!session){sessionStorage.removeItem(KEY);setAuthed(false);return}
     if(sessionStorage.getItem(KEY))sessionStorage.setItem(KEY,session.access_token);
   });
   return ()=>{cancelled=true;subscription.unsubscribe()};
 },[]);
 if(!ready)return null;
 if(authed)return <>{children}</>;
 return <main className="admin-shell min-h-screen"><div className="mx-auto flex min-h-screen max-w-md items-center px-5"><div className="w-full rounded-[30px] border border-olive/10 bg-white p-7 text-center shadow-soft sm:p-9"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-olive text-2xl font-black text-parchment">P</div><p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-clay">PUSH · الإدارة</p><h1 className="mt-2 font-display text-3xl font-bold text-olive-dark">دخول الإدارة</h1><p className="mt-2 text-sm leading-7 text-ink/50">استخدم حساب Google المصرّح له. لا توجد كلمة مرور منفصلة للوحة الإدارة.</p><a href="/auth" className="mt-6 block w-full rounded-2xl bg-olive px-4 py-3.5 font-black text-parchment hover:bg-olive-dark">تسجيل الدخول مع Google</a>{error&&<p className="mt-3 rounded-2xl bg-clay/5 p-3 text-sm font-bold text-clay-dark">{error}</p>}</div></div></main>
}
export function adminToken(){return typeof window==="undefined"?"":sessionStorage.getItem(KEY)||""}
export async function logoutAdmin(){sessionStorage.removeItem(KEY);await supabase.auth.signOut();window.location.href="/admin"}
