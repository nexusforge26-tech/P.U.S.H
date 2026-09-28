"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AuthGate, { adminToken, logoutAdmin } from "../../../../../../AuthGate";
import { AdminShell, Modal } from "../../../../../../AdminShell";
import { MATERIAL_TYPE_LABELS, SEMESTER_LABELS, type Course, type Faculty, type Material, type MaterialType, type University } from "@/lib/types";
import DriveFileInput from "@/components/DriveFileInput";

const input="w-full rounded-2xl border border-olive/10 bg-[#fbfaf7] px-4 py-3 text-sm text-ink outline-none focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/10";

export default function CourseAdminPage(){return <AuthGate><CourseWorkspace/></AuthGate>}

function CourseWorkspace(){
 const {id,facultyId,courseId}=useParams<{id:string;facultyId:string;courseId:string}>();
 const password=adminToken();
 const [universities,setUniversities]=useState<University[]>([]);
 const [faculties,setFaculties]=useState<Faculty[]>([]);
 const [courses,setCourses]=useState<Course[]>([]);
 const [materials,setMaterials]=useState<Material[]>([]);
 const [loading,setLoading]=useState(true);
 const [modal,setModal]=useState<"add"|Material|null>(null);

 const uni=universities.find(u=>u.id===id);
 const faculty=faculties.find(f=>f.id===facultyId);
 const course=courses.find(c=>c.id===courseId);

 async function load(){
  setLoading(true);
  const [t,m]=await Promise.all([
   fetch("/api/admin/taxonomy",{headers:{Authorization:`Bearer ${password}`}}),
   fetch(`/api/admin/materials?course_id=${courseId}&pageSize=50`,{headers:{Authorization:`Bearer ${password}`}}),
  ]);
  if(t.ok){const d=await t.json();setUniversities(d.universities||[]);setFaculties(d.faculties||[]);setCourses(d.courses||[])}
  if(m.ok){const d=await m.json();setMaterials(d.items||[])}
  setLoading(false);
 }
 useEffect(()=>{load()},[courseId]);

 async function del(materialId:string){
  if(!confirm("حذف هذا المنشور؟"))return;
  const r=await fetch(`/api/admin/materials?id=${materialId}`,{method:"DELETE",headers:{Authorization:`Bearer ${password}`}});
  if(!r.ok){alert("تعذر الحذف");return}
  load();
 }

 return <AdminShell>
  <header className="rounded-[32px] bg-olive p-6 text-parchment shadow-soft sm:p-9">
   <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
    <div>
     <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-parchment/55">
      <Link href="/admin" className="hover:text-parchment">الجامعات</Link><span>/</span>
      <Link href={`/admin/universities/${id}`} className="hover:text-parchment">{uni?.name_ar||"..."}</Link><span>/</span>
      <Link href={`/admin/universities/${id}/faculties/${facultyId}`} className="hover:text-parchment">{faculty?.name_ar||"..."}</Link>
     </div>
     <div className="mt-5 text-xs font-black tracking-[0.2em] text-gold-light">المستوى 3 · المساق</div>
     <h1 className="mt-2 font-display text-4xl font-bold">{course?.name_ar||(loading?"...":"غير موجود")}</h1>
     <p className="mt-2 text-sm text-parchment/60">{course?.code?`رمز المساق: ${course.code}`:"بدون رمز"} · كل المنشورات (الملخصات، الامتحانات، الملفات، الفيديوهات) الخاصة بهذا المساق.</p>
    </div>
    <button onClick={logoutAdmin} className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-black ring-1 ring-white/10">تسجيل الخروج</button>
   </div>
  </header>

  <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
   <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div><p className="text-xs font-black tracking-[.16em] text-clay">المنشورات</p><h2 className="mt-1 font-display text-2xl font-bold text-olive-dark">{materials.length} منشور</h2></div>
    <button onClick={()=>setModal("add")} className="rounded-2xl bg-clay px-5 py-3 font-black text-parchment hover:bg-clay-dark">+ إضافة منشور لهذا المساق</button>
   </div>

   <div className="mt-5 overflow-x-auto">
    <table className="w-full min-w-[750px] text-right">
     <thead><tr className="border-b border-olive/10 text-xs font-black text-ink/40"><th className="p-3">المنشور</th><th className="p-3">النوع</th><th className="p-3">التحميلات</th><th className="p-3">إجراءات</th></tr></thead>
     <tbody>
      {materials.map(m=>
       <tr key={m.id} className="border-b border-olive/5">
        <td className="p-3 font-bold">{m.title_ar}</td>
        <td className="p-3 text-xs font-black">{MATERIAL_TYPE_LABELS[m.type]}</td>
        <td className="p-3 text-sm font-black">{m.downloads_count.toLocaleString("ar")}</td>
        <td className="p-3"><button onClick={()=>setModal(m)} className="ml-2 rounded-xl border border-olive/10 px-3 py-2 text-xs font-black">تعديل</button><button onClick={()=>del(m.id)} className="rounded-xl border border-clay/15 px-3 py-2 text-xs font-black text-clay-dark">حذف</button></td>
       </tr>
      )}
     </tbody>
    </table>
    {!loading&&!materials.length&&<p className="p-10 text-center text-sm text-ink/40">لا توجد منشورات في هذا المساق بعد.</p>}
   </div>
  </section>

  {modal&&<Modal title={modal==="add"?"إضافة منشور":"تعديل منشور"} onClose={()=>setModal(null)}>
   <MaterialForm courseId={courseId} existing={modal==="add"?undefined:modal} password={password} onSaved={()=>{setModal(null);load()}}/>
  </Modal>}
 </AdminShell>
}

function MaterialForm({courseId,password,onSaved,existing}:{courseId:string;password:string;onSaved:()=>void;existing?:Material}){
 const [title,setTitle]=useState(existing?.title_ar||"");
 const [desc,setDesc]=useState(existing?.description_ar||"");
 const [type,setType]=useState<MaterialType>(existing?.type||"exam");
 const [year,setYear]=useState(existing?.academic_year||"");
 const [sem,setSem]=useState(existing?.semester||"");
 const [link,setLink]=useState(existing?.drive_link||existing?.youtube_id||"");
 const [featured,setFeatured]=useState(existing?.is_featured||false);
 const [busy,setBusy]=useState(false);

 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);
  const r=await fetch("/api/admin/materials",{method:existing?"PATCH":"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${password}`},body:JSON.stringify({id:existing?.id,course_id:courseId,title_ar:title,description_ar:desc,type,academic_year:year,semester:sem,drive_link:type==="video"?"":link,youtube_input:type==="video"?link:"",is_featured:featured})});
  const d=await r.json();setBusy(false);
  if(!r.ok){alert(d.error||"تعذر الحفظ");return}
  onSaved();
 }

 return <form onSubmit={save} className="space-y-3">
  <input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="عنوان المادة" className={input}/>
  <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} placeholder="وصف اختياري" className={`${input} resize-none`}/>
  <div className="grid gap-3 sm:grid-cols-2">
   <select value={type} onChange={e=>setType(e.target.value as MaterialType)} className={input}>{Object.entries(MATERIAL_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
   <select value={sem} onChange={e=>setSem(e.target.value)} className={input}><option value="">الفصل</option>{Object.entries(SEMESTER_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
  </div>
  <input value={year} onChange={e=>setYear(e.target.value)} placeholder="العام الدراسي" className={input}/>
  {type==="video"
   ?<input required value={link} onChange={e=>setLink(e.target.value)} placeholder="رابط YouTube" className={input}/>
   :<DriveFileInput token={password} courseId={courseId} currentLink={link} onUploaded={l=>setLink(l)}/>}
  <label className="flex gap-3 rounded-2xl border border-olive/10 p-3"><input type="checkbox" checked={featured} onChange={e=>setFeatured(e.target.checked)}/><span className="text-sm font-bold">مادة مميزة</span></label>
  <button disabled={busy||!link} className="w-full rounded-2xl bg-clay py-3.5 font-black text-parchment">{busy?"جارٍ الحفظ...":existing?"حفظ التعديلات":"إضافة المنشور"}</button>
 </form>
}
