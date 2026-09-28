"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AuthGate, { adminToken, logoutAdmin } from "../../AuthGate";
import { AdminShell, Modal } from "../../AdminShell";
import type { Faculty, University } from "@/lib/types";

const input="w-full rounded-2xl border border-olive/10 bg-[#fbfaf7] px-4 py-3 text-sm text-ink outline-none focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/10";

export default function UniversityAdminPage(){return <AuthGate><UniversityWorkspace/></AuthGate>}

function UniversityWorkspace(){
 const {id}=useParams<{id:string}>();
 const password=adminToken();
 const [universities,setUniversities]=useState<University[]>([]);
 const [faculties,setFaculties]=useState<Faculty[]>([]);
 const [loading,setLoading]=useState(true);
 const [showAdd,setShowAdd]=useState(false);
 const [name,setName]=useState("");
 const [busy,setBusy]=useState(false);
 const [editing,setEditing]=useState<Faculty|null>(null);
 const [editName,setEditName]=useState("");

 const uni=universities.find(u=>u.id===id);

 async function load(){
  setLoading(true);
  const r=await fetch("/api/admin/taxonomy",{headers:{Authorization:`Bearer ${password}`}});
  if(r.ok){const d=await r.json();setUniversities(d.universities||[]);setFaculties((d.faculties||[]).filter((f:Faculty)=>f.university_id===id))}
  setLoading(false);
 }
 useEffect(()=>{load()},[id]);

 async function addFaculty(){
  if(!name.trim())return;
  setBusy(true);
  const r=await fetch("/api/admin/taxonomy",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${password}`},body:JSON.stringify({kind:"faculty",name_ar:name.trim(),university_id:id})});
  const d=await r.json();setBusy(false);
  if(!r.ok){alert(d.error||"تعذر الإضافة");return}
  setName("");setShowAdd(false);load();
 }
 function openEdit(f:Faculty,e:React.MouseEvent){e.preventDefault();e.stopPropagation();setEditing(f);setEditName(f.name_ar)}
 async function saveEdit(){
  if(!editing||!editName.trim())return;
  const r=await fetch("/api/admin/taxonomy",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${password}`},body:JSON.stringify({kind:"faculty",id:editing.id,name_ar:editName.trim()})});
  const d=await r.json();
  if(!r.ok){alert(d.error||"تعذر حفظ التعديل");return}
  setEditing(null);load();
 }
 async function del(facultyId:string,e:React.MouseEvent){
  e.preventDefault();e.stopPropagation();
  if(!confirm("سيتم حذف كل مساقات ومواد هذه الكلية أيضًا. هل أنت متأكد؟"))return;
  const r=await fetch(`/api/admin/taxonomy?id=${facultyId}&kind=faculty`,{method:"DELETE",headers:{Authorization:`Bearer ${password}`}});
  if(!r.ok){const d=await r.json();alert(d.error||"تعذر الحذف");return}
  load();
 }

 return <AdminShell>
  <header className="rounded-[32px] bg-olive p-6 text-parchment shadow-soft sm:p-9">
   <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
    <div>
     <Link href="/admin" className="text-sm font-bold text-parchment/55 hover:text-parchment">← كل الجامعات</Link>
     <div className="mt-5 text-xs font-black tracking-[0.2em] text-gold-light">المستوى 1 · الجامعة</div>
     <h1 className="mt-2 font-display text-4xl font-bold">{uni?.name_ar||(loading?"...":"غير موجودة")}</h1>
     <p className="mt-2 text-sm text-parchment/60">اضغط على كلية للدخول إلى مساقاتها.</p>
    </div>
    <button onClick={logoutAdmin} className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-black ring-1 ring-white/10">تسجيل الخروج</button>
   </div>
  </header>

  <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
   <div className="flex items-center justify-between">
    <div><p className="text-xs font-black tracking-[.16em] text-clay">الكليات</p><h2 className="mt-1 font-display text-2xl font-bold text-olive-dark">{faculties.length} كلية</h2></div>
    <button onClick={()=>setShowAdd(true)} className="rounded-2xl bg-clay px-5 py-3 font-black text-parchment hover:bg-clay-dark">+ إضافة كلية</button>
   </div>

   <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {faculties.map(f=>
     <Link key={f.id} href={`/admin/universities/${id}/faculties/${f.id}`} className="group rounded-[24px] border border-olive/10 bg-[#fbfaf7] p-5 transition hover:-translate-y-1 hover:border-gold/40 hover:shadow-soft">
      <div className="flex items-start justify-between">
       <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-olive/7 text-lg text-olive-dark">◧</span>
       <span className="flex items-center gap-3">
        <button onClick={e=>openEdit(f,e)} className="text-xs font-black text-ink/40 opacity-0 transition hover:text-olive-dark group-hover:opacity-100">تعديل</button>
        <button onClick={e=>del(f.id,e)} className="text-xs font-black text-clay-dark opacity-0 transition group-hover:opacity-100">حذف</button>
       </span>
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-olive-dark">{f.name_ar}</h3>
      <p className="mt-2 text-xs font-black text-clay opacity-0 transition group-hover:opacity-100">فتح مساقات الكلية ←</p>
     </Link>
    )}
    {!loading&&!faculties.length&&<div className="sm:col-span-2 lg:col-span-3 rounded-[24px] border border-dashed border-olive/15 p-10 text-center text-sm text-ink/45">لا توجد كليات مضافة بعد.</div>}
   </div>
  </section>

  {showAdd&&<Modal title="إضافة كلية" onClose={()=>setShowAdd(false)}>
   <input autoFocus value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addFaculty()}} placeholder="اسم الكلية" className={input}/>
   <div className="mt-4 flex gap-2">
    <button onClick={addFaculty} disabled={busy} className="flex-1 rounded-2xl bg-olive px-4 py-3 font-black text-parchment">{busy?"جارٍ الإضافة...":"إضافة الكلية"}</button>
    <button onClick={()=>setShowAdd(false)} className="rounded-2xl border border-olive/10 px-4 py-3 font-black">إلغاء</button>
   </div>
  </Modal>}
  {editing&&<Modal title="تعديل اسم الكلية" onClose={()=>setEditing(null)}>
   <input autoFocus value={editName} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveEdit()}} placeholder="اسم الكلية" className={input}/>
   <div className="mt-4 flex gap-2">
    <button onClick={saveEdit} className="flex-1 rounded-2xl bg-olive px-4 py-3 font-black text-parchment">حفظ التعديل</button>
    <button onClick={()=>setEditing(null)} className="rounded-2xl border border-olive/10 px-4 py-3 font-black">إلغاء</button>
   </div>
  </Modal>}
 </AdminShell>
}
