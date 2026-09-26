import {NextRequest,NextResponse} from "next/server";
import {supabaseAdmin} from "@/lib/supabase/admin";
import {getRequestUser,requireRole} from "@/lib/auth";
export async function GET(req:NextRequest){
 const actor=await requireRole(req,["admin","owner"]); if(!actor)return NextResponse.json({error:"غير مصرح"},{status:401});
 const status=new URL(req.url).searchParams.get("status")||"pending";
 let q=supabaseAdmin.from("course_requests").select("id,user_id,faculty_id,name_ar,code,status,admin_note,created_at,reviewed_at,profiles:user_id(email,full_name),faculties:faculty_id(name_ar,universities:university_id(name_ar))").order("created_at",{ascending:false});
 if(status!=="all")q=q.eq("status",status);
 const {data,error}=await q;if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({requests:data??[]});
}
export async function POST(req:NextRequest){
 const account=await getRequestUser(req);if(!account)return NextResponse.json({error:"يجب تسجيل الدخول"},{status:401});
 const {faculty_id,name_ar,code}=await req.json();if(!faculty_id||!name_ar?.trim()||!code?.trim())return NextResponse.json({error:"اسم المساق ورقمه والكلية حقول إجبارية."},{status:400});
 const {data,error}=await supabaseAdmin.from("course_requests").insert({user_id:account.user.id,faculty_id,name_ar:name_ar.trim(),code:code.trim()}).select().single();
 if(error)return NextResponse.json({error:error.message},{status:500});
 await supabaseAdmin.from("publication_logs").insert({actor_id:account.user.id,action:"course_requested",details:{request_id:data.id,name_ar:data.name_ar,code:data.code,faculty_id}});
 return NextResponse.json({request:data},{status:201});
}
export async function PATCH(req:NextRequest){
 const actor=await requireRole(req,["admin","owner"]);if(!actor)return NextResponse.json({error:"غير مصرح"},{status:401});
 const {id,action,admin_note}=await req.json();if(!id||!["approve","reject"].includes(action))return NextResponse.json({error:"طلب غير صالح"},{status:400});
 const {data:r,error}=await supabaseAdmin.from("course_requests").select("*").eq("id",id).single();if(error||!r)return NextResponse.json({error:"الطلب غير موجود"},{status:404});
 if(r.status!=="pending")return NextResponse.json({error:"تمت مراجعة الطلب مسبقًا"},{status:409});
 if(action==="approve"){
  const {data:c,error:ce}=await supabaseAdmin.from("courses").insert({faculty_id:r.faculty_id,name_ar:r.name_ar,code:r.code}).select().single();
  if(ce)return NextResponse.json({error:ce.message},{status:500});
  await supabaseAdmin.from("publication_logs").insert({actor_id:actor.user.id,action:"course_created",course_id:c.id,details:{source_request:r.id,contributor_id:r.user_id,name_ar:r.name_ar,code:r.code}});
 }
 const {data, error:ue}=await supabaseAdmin.from("course_requests").update({status:action==="approve"?"approved":"rejected",admin_note:admin_note||null,reviewed_by:actor.user.id,reviewed_at:new Date().toISOString()}).eq("id",id).select().single();
 if(ue)return NextResponse.json({error:ue.message},{status:500});return NextResponse.json({request:data});
}
