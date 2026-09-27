"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { MATERIAL_TYPE_LABELS, SELF_EDIT_WINDOW_HOURS, type Material, type MaterialType } from "@/lib/types";

const input="w-full rounded-2xl border border-olive/10 bg-[#fbfaf7] px-4 py-3 text-sm text-ink outline-none focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/10";

export default function AccountPage(){
 const [user,setUser]=useState<any>(null); const [profile,setProfile]=useState<any>(null); const [items,setItems]=useState<any[]>([]);
 const [session,setSession]=useState<any>(null); const [myMaterials,setMyMaterials]=useState<(Material&{editable:boolean})[]>([]); const [editing,setEditing]=useState<(Material&{editable:boolean})|null>(null);

 async function loadMine(token:string){
  const r=await fetch("/api/materials/mine",{headers:{Authorization:`Bearer ${token}`}});
  if(r.ok)setMyMaterials((await r.json()).items||[]);
 }

 useEffect(()=>{(async()=>{
  const {data:{user}}=await supabase.auth.getUser();if(!user){window.location.href="/auth";return}
  setUser(user);
  const {data:p}=await supabase.from("profiles").select("*").eq("id",user.id).maybeSingle();setProfile(p);
  const {data:{session}}=await supabase.auth.getSession();
  if(session){
   setSession(session);
   const r=await fetch("/api/submissions",{headers:{Authorization:`Bearer ${session.access_token}`}});
   if(r.ok)setItems((await r.json()).submissions||[]);
   loadMine(session.access_token);
  }
 })()},[]);

 async function del(id:string){
  if(!session)return;
  if(!confirm("حذف هذا المنشور؟"))return;
  const r=await fetch(`/api/materials/mine?id=${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${session.access_token}`}});
  const d=await r.json();
  if(!r.ok){alert(d.error||"تعذر الحذف");return}
  loadMine(session.access_token);
 }

 async function logout(){await supabase.auth.signOut();window.location.href="/";}
 if(!user)return <main className="min-h-[70vh]"/>
 const roleLabel=profile?.role==="owner"?"المالك":profile?.role==="admin"?"المسؤول":"مستخدم عادي";
 const status:{[k:string]:string}={pending:"قيد المراجعة",approved:"تم القبول",rejected:"مرفوض"};

 return <main className="min-h-[70vh] bg-[#f7f5ef] px-5 py-10"><div className="mx-auto max-w-5xl">
   <div className="rounded-[32px] bg-olive p-7 text-parchment shadow-soft sm:p-9"><div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black tracking-[.2em] text-gold-light">PUSH · ACCOUNT</p><h1 className="mt-2 font-display text-4xl font-bold">{profile?.full_name||user.email}</h1><p className="mt-2 text-sm text-parchment/60">{user.email} · {roleLabel}</p></div><div className="flex gap-2"><Link href="/submit" className="rounded-2xl bg-gold px-5 py-3 font-black text-olive-dark">إرسال مادة</Link><button onClick={logout} className="rounded-2xl bg-white/10 px-5 py-3 font-black">تسجيل الخروج</button></div></div></div>

   <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-6 shadow-card">
    <h2 className="font-display text-2xl font-bold text-olive-dark">منشوراتي</h2>
    <p className="mt-1 text-sm text-ink/50">يمكنك تعديل أو حذف ما نشرته خلال {SELF_EDIT_WINDOW_HOURS} ساعات من نشره فقط. بعد ذلك تواصل مع الإدارة.</p>
    <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-right"><thead><tr className="border-b border-olive/10 text-xs font-black text-ink/40"><th className="p-3">العنوان</th><th className="p-3">المساق</th><th className="p-3">النوع</th><th className="p-3">تاريخ النشر</th><th className="p-3">إجراءات</th></tr></thead><tbody>
     {myMaterials.map(m=><tr key={m.id} className="border-b border-olive/5">
      <td className="p-3 font-bold">{m.title_ar}</td>
      <td className="p-3 text-sm">{m.course_name||"—"}</td>
      <td className="p-3 text-xs font-black">{MATERIAL_TYPE_LABELS[m.type]}</td>
      <td className="p-3 text-xs text-ink/45">{new Date(m.created_at).toLocaleString("ar")}</td>
      <td className="p-3">
       {m.editable
        ? <><button onClick={()=>setEditing(m)} className="ml-2 rounded-xl border border-olive/10 px-3 py-2 text-xs font-black">تعديل</button><button onClick={()=>del(m.id)} className="rounded-xl border border-clay/15 px-3 py-2 text-xs font-black text-clay-dark">حذف</button></>
        : <span className="text-xs font-bold text-ink/35" title="انتهت مهلة التعديل، تواصل مع الإدارة">انتهت المهلة</span>}
      </td>
     </tr>)}
    </tbody></table>{!myMaterials.length&&<p className="p-10 text-center text-sm text-ink/40">لم تُنشر أي مادة باسمك بعد.</p>}</div>
   </section>

   <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-6 shadow-card"><h2 className="font-display text-2xl font-bold text-olive-dark">مساهماتي</h2><p className="mt-1 text-sm text-ink/50">كل مادة أو مساق ترسله يحتاج موافقة المسؤولين قبل ظهوره للعامة.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-right"><thead><tr className="border-b border-olive/10 text-xs font-black text-ink/40"><th className="p-3">العنوان</th><th className="p-3">النوع</th><th className="p-3">الحالة</th><th className="p-3">التاريخ</th></tr></thead><tbody>{items.map(x=><tr key={x.id} className="border-b border-olive/5"><td className="p-3 font-bold">{x.kind==="course"?x.suggested_course_name:x.title_ar}<div className="mt-1 text-xs font-normal text-ink/40">{x.kind==="course"?`اقتراح مساق · ${x.suggested_course_code} · ${x.suggested_faculties?.name_ar||""}`:x.courses?.name_ar||"—"}</div></td><td className="p-3 text-sm">{x.kind==="course"?"مساق جديد":MATERIAL_TYPE_LABELS[x.type as MaterialType]||"—"}</td><td className="p-3"><span className="rounded-full bg-olive/7 px-3 py-1 text-xs font-black">{status[x.status]||x.status}</span>{x.status==="rejected"&&x.admin_note&&<p className="mt-1 max-w-xs text-xs leading-5 text-clay-dark">{x.admin_note}</p>}</td><td className="p-3 text-xs text-ink/45">{new Date(x.created_at).toLocaleDateString("ar")}</td></tr>)}</tbody></table>{!items.length&&<p className="p-10 text-center text-sm text-ink/40">لم ترسل أي مساهمة بعد.</p>}</div></section>
 </div>

 {editing&&<EditModal material={editing} token={session?.access_token} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);loadMine(session.access_token)}}/>}
 </main>
}

function EditModal({material,token,onClose,onSaved}:{material:Material&{editable:boolean};token:string;onClose:()=>void;onSaved:()=>void}){
 const [title,setTitle]=useState(material.title_ar);
 const [desc,setDesc]=useState(material.description_ar||"");
 const [link,setLink]=useState(material.drive_link||material.youtube_id||"");
 const [year,setYear]=useState(material.academic_year||"");
 const [sem,setSem]=useState(material.semester||"");
 const [busy,setBusy]=useState(false);
 const [err,setErr]=useState("");

 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setErr("");
  const r=await fetch("/api/materials/mine",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({id:material.id,title_ar:title,description_ar:desc,academic_year:year,semester:sem,drive_link:material.type==="video"?undefined:link,youtube_input:material.type==="video"?link:undefined})});
  const d=await r.json();setBusy(false);
  if(!r.ok){setErr(d.error||"تعذر الحفظ");return}
  onSaved();
 }

 return <div className="fixed inset-0 z-50 flex items-center justify-center bg-olive/35 p-5 backdrop-blur-sm"><div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-soft"><div className="flex items-center justify-between"><h3 className="font-display text-2xl font-bold text-olive-dark">تعديل منشور</h3><button onClick={onClose} className="rounded-xl px-3 py-2 text-ink/40">✕</button></div>
  <form onSubmit={save} className="mt-5 space-y-3">
   <input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="عنوان المادة" className={input}/>
   <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} placeholder="وصف اختياري" className={`${input} resize-none`}/>
   <input value={year} onChange={e=>setYear(e.target.value)} placeholder="العام الدراسي" className={input}/>
   <input value={sem} onChange={e=>setSem(e.target.value)} placeholder="الفصل الدراسي" className={input}/>
   <input required value={link} onChange={e=>setLink(e.target.value)} placeholder={material.type==="video"?"رابط YouTube":"رابط Google Drive"} className={input}/>
   <button disabled={busy} className="w-full rounded-2xl bg-olive py-3 font-black text-parchment">{busy?"جارٍ الحفظ...":"حفظ التعديلات"}</button>
   {err&&<div className="rounded-2xl bg-clay/5 p-3 text-sm font-bold text-clay-dark">{err}</div>}
  </form>
 </div></div>
}
