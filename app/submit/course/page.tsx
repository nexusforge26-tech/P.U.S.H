"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getFaculties, getUniversities } from "@/lib/data";
import type { Faculty, University } from "@/lib/types";

const input="w-full rounded-2xl border border-olive/10 bg-[#fbfaf7] px-4 py-3 text-sm text-ink outline-none focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/10";

export default function SuggestCoursePage(){
 const [session,setSession]=useState<any>(null);
 const [universities,setUniversities]=useState<University[]>([]);
 const [faculties,setFaculties]=useState<Faculty[]>([]);
 const [universityId,setUniversityId]=useState("");
 const [facultyId,setFacultyId]=useState("");
 const [name,setName]=useState("");
 const [code,setCode]=useState("");
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState("");

 useEffect(()=>{(async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session){window.location.href="/auth";return}setSession(session);setUniversities(await getUniversities().catch(()=>[]))})()},[]);
 useEffect(()=>{if(!universityId){setFaculties([]);setFacultyId("");return}getFaculties(universityId).then(setFaculties).catch(()=>setFaculties([]))},[universityId]);

 async function save(e:React.FormEvent){
  e.preventDefault();
  if(!session)return;
  // رقم/رمز المساق إجباري دائمًا حتى يمكن البحث عنه لاحقًا.
  if(!code.trim()){setMsg("رقم المساق إجباري");return}
  if(!facultyId){setMsg("اختر الكلية أولًا");return}
  setBusy(true);setMsg("");
  const r=await fetch("/api/submissions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({kind:"course",suggested_course_name:name,suggested_course_code:code,suggested_faculty_id:facultyId})});
  const d=await r.json();setBusy(false);
  if(!r.ok){setMsg(d.error||"تعذر الإرسال");return}
  setMsg("تم إرسال اقتراح المساق بنجاح. سيظهر بعد موافقة المسؤولين.");setName("");setCode("");
 }

 return <main className="min-h-[70vh] bg-[#f7f5ef] px-5 py-10"><div className="mx-auto max-w-2xl">
  <div className="rounded-[32px] bg-olive p-7 text-parchment shadow-soft sm:p-9">
   <p className="text-xs font-black tracking-[.2em] text-gold-light">PUSH · CONTRIBUTION</p>
   <h1 className="mt-2 font-display text-4xl font-bold">اقتراح مساق جديد</h1>
   <p className="mt-3 text-sm leading-7 text-parchment/65">اقترح مساقًا غير موجود في القائمة. لن يظهر المساق للعامة حتى يوافق عليه المسؤولون.</p>
  </div>

  <form onSubmit={save} className="mt-7 rounded-[28px] border border-olive/10 bg-white p-6 shadow-card sm:p-8 space-y-3">
   <select required value={universityId} onChange={e=>setUniversityId(e.target.value)} className={input}>
    <option value="">اختر الجامعة</option>
    {universities.map(u=><option key={u.id} value={u.id}>{u.name_ar}</option>)}
   </select>
   <select required disabled={!universityId} value={facultyId} onChange={e=>setFacultyId(e.target.value)} className={input}>
    <option value="">اختر الكلية</option>
    {faculties.map(f=><option key={f.id} value={f.id}>{f.name_ar}</option>)}
   </select>
   <input required value={name} onChange={e=>setName(e.target.value)} placeholder="اسم المساق" className={input}/>
   <input required value={code} onChange={e=>setCode(e.target.value)} placeholder="رقم/رمز المساق (إجباري)" className={input}/>
   <button disabled={busy} className="w-full rounded-2xl bg-clay py-3.5 font-black text-parchment">{busy?"جارٍ الإرسال...":"إرسال الاقتراح للمراجعة"}</button>
   {msg&&<div className="rounded-2xl bg-olive/5 p-4 text-sm font-bold text-olive-dark">{msg}</div>}
  </form>
  <p className="mt-5 text-center text-sm text-ink/50">تريد إضافة محتوى لمساق موجود؟ <Link href="/submit" className="font-bold text-clay hover:underline">أضف مادة</Link></p>
 </div></main>
}
