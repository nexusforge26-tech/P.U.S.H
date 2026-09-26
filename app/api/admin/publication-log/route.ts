import {NextRequest,NextResponse} from "next/server";
import {requireRole} from "@/lib/auth"; import {supabaseAdmin} from "@/lib/supabase/admin";
export async function GET(req:NextRequest){
 const actor=await requireRole(req,["admin","owner"]);if(!actor)return NextResponse.json({error:"غير مصرح"},{status:401});
 const {data,error}=await supabaseAdmin.from("publication_logs").select("id,action,details,created_at,profiles:actor_id(email,full_name),materials:material_id(title_ar),courses:course_id(name_ar,code)").order("created_at",{ascending:false}).limit(300);
 if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({logs:data??[]});
}
