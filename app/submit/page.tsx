"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { MATERIAL_TYPE_LABELS, SEMESTER_LABELS } from "@/lib/types";

const input="w-full rounded-2xl border border-olive/10 bg-[#fbfaf7] px-4 py-3 text-sm text-ink outline-none focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/10";
export default function SubmitPage(){
 const [session,setSession]=useState<any>(null);const[courses,setCourses]=useState<any[]>([]);const[course,setCourse]=useState("");const[title,setTitle]=useState("");const[desc,setDesc]=useState("");const[type,setType]=useState<any>("exam");const[year,setYear]=useState("");const[sem,setSem]=useState("");const[link,setLink]=useState("");const[busy,setBusy]=useState(false);const[msg,setMsg]=useState("");
 useEffect(()=>{(async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session){window.location.href="/auth";return}setSession(session);const {data}=await supabase.from("courses").select("id,name_ar,code,faculties(name_ar,universities(name_ar))").order("name_ar");setCourses(data||[])})()},[]);
 async function save(e:any){e.preventDefault();if(!session)return;setBusy(true);setMsg("");const r=await fetch("/api/submissions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({course_id:course,title_ar:title,description_ar:desc,type,academic_year:year,semester:sem,drive_link:type==="video"?"":link,youtube_input:type==="video"?link:""})});const d=await r.json();setBusy(false);if(!r.ok){setMsg(d.error||"تعذر الإرسال");return}setMsg("تم إرسال المادة بنجاح. ستظهر بعد موافقة المسؤولين.");setTitle("");setDesc("");setLink("");}
 return <main className="min-h-[70vh] bg-[#f7f5ef] px-5 py-10"><div className="mx-auto max-w-2xl"><div className="rounded-[32px] bg-olive p-7 text-parchment shadow-soft sm:p-9"><p className="text-xs font-black tracking-[.2em] text-gold-light">PUSH · CONTRIBUTION</p><h1 className="mt-2 font-display text-4xl font-bold">إضافة مادة جديدة</h1><p className="mt-3 text-sm leading-7 text-parchment/65">يمكنك المساهمة بالمحتوى، لكن لن يتم نشره حتى تتم مراجعته والموافقة عليه.</p></div>
 <form onSubmit={save} className="mt-7 rounded-[28px] border border-olive/10 bg-white p-6 shadow-card sm:p-8 space-y-3">
 <select required value={course} onChange={e=>setCourse(e.target.value)} className={input}><option value="">اختر المساق</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name_ar}{c.code?` · ${c.code}`:""} — {c.faculties?.name_ar}</option>)}</select>
 <input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="عنوان المادة" className={input}/><textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} placeholder="وصف اختياري" className={`${input} resize-none`}/>
 <div className="grid gap-3 sm:grid-cols-2"><select value={type} onChange={e=>setType(e.target.value)} className={input}>{Object.entries(MATERIAL_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select value={sem} onChange={e=>setSem(e.target.value)} className={input}><option value="">الفصل</option>{Object.entries(SEMESTER_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
 <input value={year} onChange={e=>setYear(e.target.value)} placeholder="العام الدراسي (اختياري)" className={input}/><input required value={link} onChange={e=>setLink(e.target.value)} placeholder={type==="video"?"رابط YouTube":"رابط Google Drive"} className={input}/>
 <button disabled={busy} className="w-full rounded-2xl bg-clay py-3.5 font-black text-parchment">{busy?"جارٍ الإرسال...":"إرسال للمراجعة"}</button>{msg&&<div className="rounded-2xl bg-olive/5 p-4 text-sm font-bold text-olive-dark">{msg}</div>}
 </form></div></main>
}
