import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/auth";

function extractYoutubeId(input:string):string|null {
 const trimmed=input.trim(); if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
 try { const u=new URL(trimmed); if(u.hostname.includes("youtu.be")) return u.pathname.slice(1).match(/^[\w-]{11}/)?.[0]??null;
 if(u.searchParams.get("v")) return u.searchParams.get("v"); return u.pathname.match(/\/(?:shorts|embed)\/([\w-]{11})/)?.[1]??null; } catch{return null}
}
export async function GET(req:NextRequest){
 const account=await getRequestUser(req); if(!account)return NextResponse.json({error:"يجب تسجيل الدخول"},{status:401});
 const {data,error}=await supabaseAdmin.from("submissions").select("id,title_ar,type,status,admin_note,created_at,reviewed_at,courses:course_id(name_ar,code)").eq("user_id",account.user.id).order("created_at",{ascending:false});
 if(error)return NextResponse.json({error:error.message},{status:500});
 const {data:published}=await supabaseAdmin.from("materials").select("id,title_ar,type,course_id,created_at,updated_at,courses:course_id(name_ar,code)").eq("created_by",account.user.id).order("created_at",{ascending:false});
 const {data:requests}=await supabaseAdmin.from("course_requests").select("id,name_ar,code,status,admin_note,created_at,reviewed_at,faculties:faculty_id(name_ar,universities:university_id(name_ar))").eq("user_id",account.user.id).order("created_at",{ascending:false});
 return NextResponse.json({submissions:data??[],published:published??[],courseRequests:requests??[]});
}
export async function POST(req:NextRequest){
 const account=await getRequestUser(req); if(!account)return NextResponse.json({error:"يجب تسجيل الدخول أولًا"},{status:401});
 const body=await req.json(); const {course_id,title_ar,description_ar,type,academic_year,semester,drive_link,youtube_input}=body;
 if(!course_id||!title_ar||!type)return NextResponse.json({error:"الحقول الأساسية ناقصة"},{status:400});
 const payload:any={user_id:account.user.id,course_id,title_ar,description_ar:description_ar||null,type,academic_year:academic_year||null,semester:semester||null,drive_link:null,youtube_id:null};
 if(type==="video"){const id=extractYoutubeId(String(youtube_input??""));if(!id)return NextResponse.json({error:"رابط YouTube غير صالح"},{status:400});payload.youtube_id=id}
 else {if(!drive_link?.trim())return NextResponse.json({error:"رابط Google Drive مطلوب"},{status:400});payload.drive_link=drive_link.trim()}
 const {data,error}=await supabaseAdmin.from("submissions").insert(payload).select().single();
 if(error)return NextResponse.json({error:error.message},{status:500});
 await supabaseAdmin.from("publication_logs").insert({actor_id:account.user.id,action:"material_submitted",submission_id:data.id,course_id,details:{title_ar}});
 return NextResponse.json({submission:data},{status:201});
}
export async function PATCH(req:NextRequest){
 const account=await getRequestUser(req); if(!account)return NextResponse.json({error:"يجب تسجيل الدخول"},{status:401});
 const {id,title_ar,description_ar}=await req.json();
 const {data:m,error}=await supabaseAdmin.from("materials").select("id,created_by,created_at").eq("id",id).maybeSingle();
 if(error||!m||m.created_by!==account.user.id)return NextResponse.json({error:"لا يمكنك تعديل هذه المادة."},{status:403});
 if(Date.now()-new Date(m.created_at).getTime()>6*60*60*1000)return NextResponse.json({error:"انتهت مهلة التعديل (6 ساعات). تواصل مع الإدارة."},{status:403});
 const {data,error:upErr}=await supabaseAdmin.from("materials").update({title_ar,description_ar:description_ar||null,updated_at:new Date().toISOString()}).eq("id",id).select().single();
 if(upErr)return NextResponse.json({error:upErr.message},{status:500});
 await supabaseAdmin.from("publication_logs").insert({actor_id:account.user.id,action:"material_updated",material_id:id,details:{title_ar}});
 return NextResponse.json({material:data});
}
export async function DELETE(req:NextRequest){
 const account=await getRequestUser(req); if(!account)return NextResponse.json({error:"يجب تسجيل الدخول"},{status:401});
 const id=new URL(req.url).searchParams.get("id"); if(!id)return NextResponse.json({error:"معرّف المادة مطلوب"},{status:400});
 const {data:m}=await supabaseAdmin.from("materials").select("id,created_by,created_at,course_id,title_ar").eq("id",id).maybeSingle();
 if(!m||m.created_by!==account.user.id)return NextResponse.json({error:"لا يمكنك حذف هذه المادة."},{status:403});
 if(Date.now()-new Date(m.created_at).getTime()>6*60*60*1000)return NextResponse.json({error:"انتهت مهلة الحذف (6 ساعات). تواصل مع الإدارة."},{status:403});
 const {error}=await supabaseAdmin.from("materials").delete().eq("id",id); if(error)return NextResponse.json({error:error.message},{status:500});
 await supabaseAdmin.from("publication_logs").insert({actor_id:account.user.id,action:"material_deleted",course_id:m.course_id,details:{title_ar:m.title_ar}});
 return NextResponse.json({ok:true});
}
