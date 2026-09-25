"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function AccountPage(){
 const [user,setUser]=useState<any>(null); const [profile,setProfile]=useState<any>(null); const [items,setItems]=useState<any[]>([]);
 useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){window.location.href="/auth";return}setUser(user);const {data:p}=await supabase.from("profiles").select("*").eq("id",user.id).maybeSingle();setProfile(p);const {data:{session}}=await supabase.auth.getSession();if(session){const r=await fetch("/api/submissions",{headers:{Authorization:`Bearer ${session.access_token}`}});if(r.ok)setItems((await r.json()).submissions||[])}})()},[]);
 async function logout(){await supabase.auth.signOut();window.location.href="/";}
 if(!user)return <main className="min-h-[70vh]"/>
 const roleLabel=profile?.role==="owner"?"المالك":profile?.role==="admin"?"المسؤول":"مستخدم عادي";
 const status:{[k:string]:string}={pending:"قيد المراجعة",approved:"تم القبول",rejected:"مرفوض"};
 return <main className="min-h-[70vh] bg-[#f7f5ef] px-5 py-10"><div className="mx-auto max-w-5xl">
   <div className="rounded-[32px] bg-olive p-7 text-parchment shadow-soft sm:p-9"><div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black tracking-[.2em] text-gold-light">PUSH · ACCOUNT</p><h1 className="mt-2 font-display text-4xl font-bold">{profile?.full_name||user.email}</h1><p className="mt-2 text-sm text-parchment/60">{user.email} · {roleLabel}</p></div><div className="flex gap-2"><Link href="/submit" className="rounded-2xl bg-gold px-5 py-3 font-black text-olive-dark">إرسال مادة</Link><button onClick={logout} className="rounded-2xl bg-white/10 px-5 py-3 font-black">تسجيل الخروج</button></div></div></div>
   <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-6 shadow-card"><h2 className="font-display text-2xl font-bold text-olive-dark">مساهماتي</h2><p className="mt-1 text-sm text-ink/50">كل مادة ترسلها تحتاج موافقة المسؤولين قبل ظهورها للعامة.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-right"><thead><tr className="border-b border-olive/10 text-xs font-black text-ink/40"><th className="p-3">العنوان</th><th className="p-3">المساق</th><th className="p-3">الحالة</th><th className="p-3">التاريخ</th></tr></thead><tbody>{items.map(x=><tr key={x.id} className="border-b border-olive/5"><td className="p-3 font-bold">{x.title_ar}</td><td className="p-3 text-sm">{x.courses?.name_ar||"—"}</td><td className="p-3"><span className="rounded-full bg-olive/7 px-3 py-1 text-xs font-black">{status[x.status]||x.status}</span>{x.status==="rejected"&&x.admin_note&&<p className="mt-1 max-w-xs text-xs leading-5 text-clay-dark">{x.admin_note}</p>}</td><td className="p-3 text-xs text-ink/45">{new Date(x.created_at).toLocaleDateString("ar")}</td></tr>)}</tbody></table>{!items.length&&<p className="p-10 text-center text-sm text-ink/40">لم ترسل أي مادة بعد.</p>}</div></section>
 </div></main>
}
