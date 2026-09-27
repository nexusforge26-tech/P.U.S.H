"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallback(){
 const router=useRouter();
 useEffect(()=>{let done=false;const go=async()=>{const {data:{session}}=await supabase.auth.getSession();if(session&&!done){done=true;router.replace("/")}};go();const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{if(s&&!done){done=true;router.replace("/")}});return()=>subscription.unsubscribe()},[router]);
 return <main className="min-h-[70vh] grid place-items-center bg-[#f7f5ef]"><div className="rounded-2xl bg-white px-6 py-5 shadow-card text-sm font-bold text-olive-dark">جارٍ إكمال تسجيل الدخول...</div></main>
}
