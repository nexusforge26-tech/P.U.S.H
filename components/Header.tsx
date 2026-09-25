"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const NAV_LINKS=[{href:"/",label:"الرئيسية"},{href:"/browse",label:"المكتبة"},{href:"/browse?type=video",label:"فيديوهات"}];

export default function Header(){
  const[open,setOpen]=useState(false);
  const[user,setUser]=useState<any>(null);
  const[isStaff,setIsStaff]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    async function loadRole(u:any){
      if(!u){if(!cancelled)setIsStaff(false);return}
      const {data:p}=await supabase.from("profiles").select("role").eq("id",u.id).maybeSingle();
      if(!cancelled)setIsStaff(p?.role==="admin"||p?.role==="owner");
    }
    supabase.auth.getUser().then(({data})=>{setUser(data.user);loadRole(data.user)});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{setUser(s?.user??null);loadRole(s?.user??null)});
    return ()=>{cancelled=true;subscription.unsubscribe()};
  },[]);
  async function logout(){await supabase.auth.signOut();setUser(null);}
  return <header className="sticky top-0 z-50 border-b border-emerald-950/10 bg-[#f7f5ef]/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
      <Link href="/" className="flex items-center gap-3" onClick={()=>setOpen(false)}>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-olive text-parchment shadow-card"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7 12 3l8 4-8 4Z"/><path d="M6 9v6l6 3 6-3V9"/><path d="M20 8v7" strokeLinecap="round"/></svg></span>
        <span dir="ltr" className="font-display text-2xl font-bold tracking-[.16em] text-olive-dark">PUSH</span>
        <span className="hidden border-r border-olive/15 pr-3 text-xs leading-5 text-ink/55 sm:inline">مركز المعرفة الطلابية<br/>للجامعات الفلسطينية</span>
      </Link>
      <nav className="hidden items-center gap-1 md:flex">{NAV_LINKS.map(l=><Link key={l.href} href={l.href} className="rounded-full px-4 py-2 text-sm font-medium text-ink/65 transition hover:bg-olive/7 hover:text-olive-dark">{l.label}</Link>)}</nav>
      <div className="flex items-center gap-2">
        {user ? <>
          {isStaff&&<Link href="/admin" className="hidden rounded-full border border-clay/30 bg-clay/10 px-4 py-2.5 text-sm font-bold text-clay-dark hover:bg-clay/20 sm:inline-flex">لوحة الإدارة</Link>}
          <Link href="/submit" className="hidden rounded-full border border-olive/15 bg-white/60 px-4 py-2.5 text-sm font-bold text-olive-dark hover:bg-white sm:inline-flex">أضف مادة</Link>
          <Link href="/account" className="hidden rounded-full bg-olive px-4 py-2.5 text-sm font-bold text-parchment shadow-card sm:inline-flex">حسابي</Link>
        </> : <Link href="/auth" className="hidden rounded-full bg-olive px-5 py-2.5 text-sm font-bold text-parchment shadow-card sm:inline-flex">تسجيل الدخول</Link>}
        <Link href="/browse" className="hidden rounded-full bg-clay px-5 py-2.5 text-sm font-bold text-parchment shadow-card transition hover:-translate-y-0.5 sm:inline-flex">ابدأ البحث</Link>
        <button aria-label={open?"إغلاق القائمة":"فتح القائمة"} aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-olive/15 bg-white/60 text-olive-dark md:hidden"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">{open?<path d="M6 6l12 12M18 6 6 18"/>:<path d="M4 7h16M4 12h16M4 17h16"/>}</svg></button>
      </div>
    </div>
    {open&&<nav className="border-t border-olive/10 bg-[#f7f5ef] px-4 py-4 md:hidden"><div className="mx-auto flex max-w-7xl flex-col gap-1">
      {NAV_LINKS.map(l=><Link key={l.href} href={l.href} onClick={()=>setOpen(false)} className="rounded-2xl px-4 py-3 font-medium hover:bg-olive/5">{l.label}</Link>)}
      {user ? <>{isStaff&&<Link href="/admin" onClick={()=>setOpen(false)} className="rounded-2xl bg-clay/10 px-4 py-3 font-bold text-clay-dark hover:bg-clay/20">لوحة الإدارة</Link>}<Link href="/submit" onClick={()=>setOpen(false)} className="rounded-2xl px-4 py-3 font-bold hover:bg-olive/5">إضافة مادة</Link><Link href="/account" onClick={()=>setOpen(false)} className="rounded-2xl px-4 py-3 font-bold hover:bg-olive/5">حسابي</Link><button onClick={logout} className="rounded-2xl bg-clay px-4 py-3 font-bold text-parchment">تسجيل الخروج</button></> : <Link href="/auth" onClick={()=>setOpen(false)} className="mt-2 rounded-2xl bg-olive px-4 py-3 text-center font-bold text-parchment">تسجيل الدخول</Link>}
      <Link href="/browse" onClick={()=>setOpen(false)} className="rounded-2xl border border-olive/10 px-4 py-3 text-center font-bold">ابدأ البحث</Link>
    </div></nav>}
  </header>
}
