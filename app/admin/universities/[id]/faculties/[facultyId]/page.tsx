"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AuthGate, { adminToken, logoutAdmin } from "../../../../AuthGate";
import { AdminShell, Modal } from "../../../../AdminShell";
import type { Course, Faculty, University } from "@/lib/types";

const input="w-full rounded-2xl border border-olive/10 bg-[#fbfaf7] px-4 py-3 text-sm text-ink outline-none focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/10";

export default function FacultyAdminPage(){return <AuthGate><FacultyWorkspace/></AuthGate>}

function FacultyWorkspace(){
 const {id,facultyId}=useParams<{id:string;facultyId:string}>();
 const password=adminToken();
 const [universities,setUniversities]=useState<University[]>([]);
 const [faculties,setFaculties]=useState<Faculty[]>([]);
 const [courses,setCourses]=useState<Course[]>([]);
 const [loading,setLoading]=useState(true);
 const [showAdd,setShowAdd]=useState(false);
 const [editing,setEditing]=useState<Course|null>(null);

 const uni=universities.find(u=>u.id===id);
 const faculty=faculties.find(f=>f.id===facultyId);

 async function load(){
  setLoading(true);
  const r=await fetch("/api/admin/taxonomy",{headers:{Authorization:`Bearer ${password}`}});
  if(r.ok){const d=await r.json();setUniversities(d.universities||[]);setFaculties(d.faculties||[]);setCourses((d.courses||[]).filter((c:Course)=>c.faculty_id===facultyId))}
  setLoading(false);
 }
 useEffect(()=>{load()},[facultyId]);

 async function addCourse(v:{name:string;code:string}){
  if(!v.code?.trim())return alert("رمز المساق إجباري");
  const r=await fetch("/api/admin/taxonomy",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${password}`},body:JSON.stringify({kind:"course",name_ar:v.name,code:v.code,faculty_id:facultyId})});
  const d=await r.json();
  if(!r.ok){alert(d.error||"تعذر الإضافة");return}
  setShowAdd(false);load();
 }
 async function saveEdit(v:{name:string;code:string}){
  if(!editing)return;
  if(!v.code?.trim())return alert("رمز المساق إجباري");
  const r=await fetch("/api/admin/taxonomy",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${password}`},body:JSON.stringify({kind:"course",id:editing.id,name_ar:v.name,code:v.code})});
  const d=await r.json();
  if(!r.ok){alert(d.error||"تعذر حفظ التعديل");return}
  setEditing(null);load();
 }
 async function del(courseId:string,e:React.MouseEvent){
  e.preventDefault();e.stopPropagation();
  if(!confirm("سيتم حذف كل منشورات هذا المساق أيضًا. هل أنت متأكد؟"))return;
  const r=await fetch(`/api/admin/taxonomy?id=${courseId}&kind=course`,{method:"DELETE",headers:{Authorization:`Bearer ${password}`}});
  if(!r.ok){const d=await r.json();alert(d.error||"تعذر الحذف");return}
  load();
 }
 function openEdit(c:Course,e:React.MouseEvent){e.preventDefault();e.stopPropagation();setEditing(c)}

 return <AdminShell>
  <header className="rounded-[32px] bg-olive p-6 text-parchment shadow-soft sm:p-9">
   <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
    <div>
     <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-parchment/55">
      <Link href="/admin" className="hover:text-parchment">الجامعات</Link><span>/</span>
      <Link href={`/admin/universities/${id}`} className="hover:text-parchment">{uni?.name_ar||"..."}</Link>
     </div>
     <div className="mt-5 text-xs font-black tracking-[0.2em] text-gold-light">المستوى 2 · الكلية</div>
     <h1 className="mt-2 font-display text-4xl font-bold">{faculty?.name_ar||(loading?"...":"غير موجودة")}</h1>
     <p className="mt-2 text-sm text-parchment/60">اضغط على مساق للدخول إلى منشوراته.</p>
    </div>
    <button onClick={logoutAdmin} className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-black ring-1 ring-white/10">تسجيل الخروج</button>
   </div>
  </header>

  <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
   <div className="flex items-center justify-between">
    <div><p className="text-xs font-black tracking-[.16em] text-clay">المساقات</p><h2 className="mt-1 font-display text-2xl font-bold text-olive-dark">{courses.length} مساق</h2></div>
    <button onClick={()=>setShowAdd(true)} className="rounded-2xl bg-clay px-5 py-3 font-black text-parchment hover:bg-clay-dark">+ إضافة مساق</button>
   </div>

   <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {courses.map(c=>
     <Link key={c.id} href={`/admin/universities/${id}/faculties/${facultyId}/courses/${c.id}`} className="group rounded-[24px] border border-olive/10 bg-[#fbfaf7] p-5 transition hover:-translate-y-1 hover:border-gold/40 hover:shadow-soft">
      <div className="flex items-start justify-between">
       <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-olive/7 text-lg text-olive-dark">▤</span>
       <span className="flex items-center gap-3">
        <button onClick={e=>openEdit(c,e)} className="rounded-lg border border-olive/10 px-2.5 py-1 text-xs font-black text-ink/55 transition hover:text-olive-dark">تعديل</button>
        <button onClick={e=>del(c.id,e)} className="rounded-lg border border-clay/15 px-2.5 py-1 text-xs font-black text-clay-dark">حذف</button>
       </span>
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-olive-dark">{c.name_ar}</h3>
      <p className="mt-1 text-xs font-black text-ink/40">{c.code||"بدون رمز"}</p>
      <p className="mt-2 text-xs font-black text-clay opacity-0 transition group-hover:opacity-100">فتح منشورات المساق ←</p>
     </Link>
    )}
    {!loading&&!courses.length&&<div className="sm:col-span-2 lg:col-span-3 rounded-[24px] border border-dashed border-olive/15 p-10 text-center text-sm text-ink/45">لا توجد مساقات مضافة بعد.</div>}
   </div>
  </section>

  {showAdd&&<Modal title="إضافة مساق" onClose={()=>setShowAdd(false)}><CourseForm onSubmit={addCourse}/></Modal>}
  {editing&&<Modal title="تعديل المساق" onClose={()=>setEditing(null)}><CourseForm initial={editing} onSubmit={saveEdit}/></Modal>}
 </AdminShell>
}

function CourseForm({initial,onSubmit}:{initial?:Course;onSubmit:(v:{name:string;code:string})=>void}){
 const [name,setName]=useState(initial?.name_ar||"");
 const [code,setCode]=useState(initial?.code||"");
 return <form onSubmit={e=>{e.preventDefault();onSubmit({name,code})}} className="space-y-3">
  <input required value={name} onChange={e=>setName(e.target.value)} placeholder="اسم المساق" className={input}/>
  {/* رمز/رقم المساق إجباري دائمًا حتى تعمل خاصية البحث برقم المساق. */}
  <input required value={code} onChange={e=>setCode(e.target.value)} placeholder="رمز/رقم المساق (إجباري)" className={input}/>
  <button className="w-full rounded-2xl bg-olive py-3 font-black text-parchment">حفظ</button>
 </form>
}
