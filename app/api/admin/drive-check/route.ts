import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { checkDriveSetup } from "@/lib/googleDrive";

// فحص إعداد Google Drive للمسؤول العام فقط (يكشف بريد حساب الرفع، فلا يُعرض لمسؤول جامعة).
export async function GET(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (actor.scopeUniversityId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  return NextResponse.json(await checkDriveSetup());
}
