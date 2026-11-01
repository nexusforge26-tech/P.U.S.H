import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { isUserRole, roleLabel, type UserRole } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { rateLimit, sanitizeFilterTerm, serverError, tooManyRequests } from "@/lib/security";
import { createXlsxWorkbook, type WorkbookCell, type WorkbookSheet } from "@/lib/memberWorkbook.mjs";

export const runtime = "nodejs";

const PAGE_SIZE = 500;
const MEMBER_ID_BATCH_SIZE = 80;
const AUTH_PAGE_SIZE = 500;

type DataRow = Record<string, unknown>;
type QueryPage<T> = { data: T[] | null; error: { message: string } | null };
type ProfileRow = DataRow & {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
};

async function collectPages<T>(
  fetchPage: (from: number, to: number) => Promise<QueryPage<T>>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchForMembers(
  table: string,
  columns: string,
  memberColumn: string,
  memberIds: string[],
  orderColumn: string | null = "created_at"
): Promise<DataRow[]> {
  const rows: DataRow[] = [];
  for (let offset = 0; offset < memberIds.length; offset += MEMBER_ID_BATCH_SIZE) {
    const batch = memberIds.slice(offset, offset + MEMBER_ID_BATCH_SIZE);
    const pageRows = await collectPages<DataRow>(async (from, to) => {
      let query = supabaseAdmin.from(table).select(columns).in(memberColumn, batch);
      if (orderColumn) query = query.order(orderColumn, { ascending: false });
      const { data, error } = await query.range(from, to);
      return { data: (data ?? null) as DataRow[] | null, error };
    });
    rows.push(...pageRows);
  }
  return rows;
}

function asRecord(value: unknown): DataRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as DataRow;
}

function asText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function relation(value: unknown): DataRow | null {
  if (Array.isArray(value)) return asRecord(value[0]);
  return asRecord(value);
}

function dateCell(value: unknown): WorkbookCell {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : String(value);
}

function valueCell(value: unknown): WorkbookCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("، ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function normalizeDataRow(row: DataRow, omit: string[] = []): Record<string, WorkbookCell> {
  const excluded = new Set(omit);
  const normalized: Record<string, WorkbookCell> = {};
  for (const [key, value] of Object.entries(row)) {
    if (excluded.has(key)) continue;
    normalized[key] = key.endsWith("_at") ? dateCell(value) : valueCell(value);
  }
  return normalized;
}

function withMember(
  row: DataRow,
  memberId: string,
  profilesById: Map<string, ProfileRow>,
  omit: string[] = []
): Record<string, WorkbookCell> {
  const member = profilesById.get(memberId);
  return {
    member_id: memberId,
    member_name: member?.full_name ?? null,
    member_email: member?.email ?? null,
    ...normalizeDataRow(row, omit),
  };
}

function relatedRows(
  rows: DataRow[],
  memberColumn: string,
  profilesById: Map<string, ProfileRow>,
  transform: (row: DataRow) => DataRow = (row) => row
): Array<Record<string, WorkbookCell>> {
  return rows.map((raw) => {
    const memberId = asText(raw[memberColumn]) ?? "";
    return withMember(transform(raw), memberId, profilesById);
  });
}

function relationName(value: unknown): string | null {
  return asText(relation(value)?.name_ar);
}

function buildProfileRows(profiles: ProfileRow[]): Array<Record<string, WorkbookCell>> {
  return profiles.map((profile) => {
    const university = relation(profile.universities);
    const managedUniversity = relation(profile.managed_university);
    const role = isUserRole(profile.role) ? profile.role : "user";
    return {
      id: profile.id,
      email: profile.email ?? null,
      full_name: profile.full_name ?? null,
      avatar_url: valueCell(profile.avatar_url),
      role,
      role_label: roleLabel(role as UserRole, asText(managedUniversity?.name_ar) ?? undefined),
      phone: valueCell(profile.phone),
      whatsapp: valueCell(profile.whatsapp),
      university_id: valueCell(profile.university_id),
      university_name: asText(university?.name_ar),
      managed_university_id: valueCell(profile.managed_university_id),
      managed_university_name: asText(managedUniversity?.name_ar),
      profile_prompted_at: dateCell(profile.profile_prompted_at),
      created_at: dateCell(profile.created_at),
      updated_at: dateCell(profile.updated_at),
    };
  });
}

function providerNames(user: DataRow): string {
  const names: string[] = [];
  const identities = Array.isArray(user.identities) ? user.identities : [];
  for (const identity of identities) {
    const provider = asText(asRecord(identity)?.provider);
    if (provider) names.push(provider);
  }
  const appMetadata = asRecord(user.app_metadata);
  const metadataProviders = Array.isArray(appMetadata?.providers) ? appMetadata.providers : [];
  for (const provider of metadataProviders) {
    if (typeof provider === "string") names.push(provider);
  }
  const singleProvider = asText(appMetadata?.provider);
  if (singleProvider) names.push(singleProvider);
  return [...new Set(names)].join(", ");
}

function buildAuthRows(profiles: ProfileRow[], authUsers: Map<string, DataRow>): Array<Record<string, WorkbookCell>> {
  return profiles.map((profile) => {
    const authUser = authUsers.get(profile.id) ?? {};
    return {
      member_id: profile.id,
      member_name: profile.full_name ?? null,
      member_email: profile.email ?? null,
      auth_email: valueCell(authUser.email),
      auth_phone: valueCell(authUser.phone),
      auth_created_at: dateCell(authUser.created_at),
      auth_updated_at: dateCell(authUser.updated_at),
      last_sign_in_at: dateCell(authUser.last_sign_in_at),
      email_confirmed_at: dateCell(authUser.email_confirmed_at ?? authUser.confirmed_at),
      phone_confirmed_at: dateCell(authUser.phone_confirmed_at),
      providers: providerNames(authUser),
      is_sso_user: typeof authUser.is_sso_user === "boolean" ? (authUser.is_sso_user ? "نعم" : "لا") : null,
      is_anonymous: typeof authUser.is_anonymous === "boolean" ? (authUser.is_anonymous ? "نعم" : "لا") : null,
    };
  });
}

async function fetchAuthUsers(memberIds: Set<string>): Promise<Map<string, DataRow>> {
  const users = new Map<string, DataRow>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE });
    if (error) throw new Error(error.message);
    const pageUsers = data.users as unknown as DataRow[];
    for (const user of pageUsers) {
      const id = asText(user.id);
      if (id && memberIds.has(id)) users.set(id, user);
    }
    if (pageUsers.length < AUTH_PAGE_SIZE) break;
  }
  return users;
}

function createSheet(
  name: string,
  title: string,
  subtitle: string,
  columns: Array<{ key: string; header: string; width?: number }>,
  rows: Array<Record<string, WorkbookCell>>
): WorkbookSheet {
  return { name, title, subtitle, columns, rows };
}

const MEMBER_COLUMNS = [
  { key: "id", header: "معرّف العضو", width: 38 },
  { key: "email", header: "البريد الإلكتروني", width: 34 },
  { key: "full_name", header: "الاسم الكامل", width: 28 },
  { key: "avatar_url", header: "رابط الصورة", width: 42 },
  { key: "role", header: "رمز الصلاحية", width: 16 },
  { key: "role_label", header: "الصلاحية", width: 24 },
  { key: "phone", header: "الهاتف", width: 20 },
  { key: "whatsapp", header: "واتساب", width: 20 },
  { key: "university_id", header: "معرّف الجامعة", width: 38 },
  { key: "university_name", header: "الجامعة", width: 28 },
  { key: "managed_university_id", header: "معرّف الجامعة المُدارة", width: 38 },
  { key: "managed_university_name", header: "الجامعة المُدارة", width: 28 },
  { key: "profile_prompted_at", header: "وقت طلب إكمال الملف", width: 22 },
  { key: "created_at", header: "تاريخ إنشاء الملف", width: 22 },
  { key: "updated_at", header: "آخر تحديث للملف", width: 22 },
];

const MEMBER_CONTEXT_COLUMNS = [
  { key: "member_id", header: "معرّف العضو", width: 38 },
  { key: "member_name", header: "اسم العضو", width: 26 },
  { key: "member_email", header: "بريد العضو", width: 32 },
];

export async function GET(req: NextRequest) {
  const actor = await requireRole(req, ["admin", "owner"]);
  if (!actor) {
    return NextResponse.json(
      { error: "التصدير الشامل متاح للمالك والمسؤول العام فقط." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const limit = rateLimit(`members-export:${actor.user.id}`, 3, 5 * 60 * 1000);
  if (!limit.ok) {
    return tooManyRequests(limit.retryAfterSec, "تم بلوغ حد التصدير المؤقت. حاول لاحقًا.");
  }

  const { searchParams } = new URL(req.url);
  const rawQuery = searchParams.get("q")?.trim() ?? "";
  const safeQuery = sanitizeFilterTerm(rawQuery, 100);
  const rawRole = searchParams.get("role")?.trim() ?? "";
  const roleFilter = isUserRole(rawRole) ? rawRole : "";

  try {
    const profileColumns =
      "id,email,full_name,avatar_url,role,phone,whatsapp,university_id,managed_university_id,profile_prompted_at,created_at,updated_at,universities:university_id(name_ar),managed_university:managed_university_id(name_ar)";
    const profiles = await collectPages<ProfileRow>(async (from, to) => {
      let query = supabaseAdmin.from("profiles").select(profileColumns).order("created_at", { ascending: false });
      if (roleFilter) query = query.eq("role", roleFilter);
      if (safeQuery) {
        query = query.or(
          `full_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%,whatsapp.ilike.%${safeQuery}%`
        );
      }
      const { data, error } = await query.range(from, to);
      return { data: (data ?? null) as ProfileRow[] | null, error };
    });

    const profileIds = profiles.map((profile) => profile.id);
    const profileIdSet = new Set(profileIds);
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

    const [
      authUsers,
      submissions,
      doctorSubmissions,
      materials,
      doctors,
      reports,
      votes,
      favorites,
      notifications,
      uploadLogs,
      actorLogs,
      targetLogs,
    ] = await Promise.all([
      profileIds.length ? fetchAuthUsers(profileIdSet) : Promise.resolve(new Map<string, DataRow>()),
      fetchForMembers(
        "submissions",
        "id,user_id,submitter_name,submitter_email,kind,course_id,target_material_id,title_ar,description_ar,type,academic_year,semester,drive_link,youtube_id,file_size,mime_type,page_count,suggested_course_name,suggested_course_code,suggested_university_id,status,admin_note,reviewed_by,reviewed_at,created_at,courses:course_id(name_ar,code,university_id,universities:university_id(name_ar)),target_material:target_material_id(title_ar),suggested_universities:suggested_university_id(name_ar)",
        "user_id",
        profileIds
      ),
      fetchForMembers(
        "doctor_submissions",
        "id,user_id,submitter_name,submitter_email,kind,target_doctor_id,full_name,email,office_location,university_id,courses,status,admin_note,reviewed_by,reviewed_at,created_at,universities:university_id(name_ar),target_doctor:target_doctor_id(full_name,email)",
        "user_id",
        profileIds
      ),
      fetchForMembers(
        "materials",
        "id,course_id,title_ar,description_ar,type,academic_year,semester,drive_link,youtube_id,is_featured,is_verified,downloads_count,helpful_count,file_size,mime_type,page_count,search_text,created_by,created_at,courses:course_id(name_ar,code,university_id,universities:university_id(name_ar))",
        "created_by",
        profileIds
      ),
      fetchForMembers(
        "doctors",
        "id,full_name,email,office_location,university_id,courses,created_by,created_at,updated_at,universities:university_id(name_ar)",
        "created_by",
        profileIds
      ),
      fetchForMembers(
        "material_reports",
        "id,material_id,user_id,reporter_email,reason,details,status,resolved_by,resolved_at,created_at,materials:material_id(title_ar,courses:course_id(name_ar,university_id,universities:university_id(name_ar)))",
        "user_id",
        profileIds
      ),
      fetchForMembers(
        "material_votes",
        "material_id,user_id,created_at,materials:material_id(title_ar,courses:course_id(name_ar))",
        "user_id",
        profileIds
      ),
      fetchForMembers(
        "favorite_courses",
        "user_id,course_id,created_at,courses:course_id(name_ar,code,university_id,universities:university_id(name_ar))",
        "user_id",
        profileIds
      ),
      fetchForMembers("notifications", "id,user_id,title,message,link,is_read,created_at", "user_id", profileIds),
      fetchForMembers("upload_log", "id,user_id,file_name,file_size,created_at", "user_id", profileIds),
      fetchForMembers(
        "activity_log",
        "id,actor_id,actor_name,actor_email,action,target_type,target_id,title_ar,course_id,university_id,created_at",
        "actor_id",
        profileIds
      ),
      fetchForMembers(
        "activity_log",
        "id,actor_id,actor_name,actor_email,action,target_type,target_id,title_ar,course_id,university_id,created_at",
        "target_id",
        profileIds
      ),
    ]);

    const activityById = new Map<string, DataRow>();
    for (const row of [...actorLogs, ...targetLogs]) {
      const id = asText(row.id);
      if (id) activityById.set(id, row);
    }
    const activityRows = [...activityById.values()].map((row) => {
      const relatedIds = [asText(row.actor_id), asText(row.target_id)].filter(
        (id): id is string => Boolean(id && profilesById.has(id))
      );
      const uniqueRelatedIds = [...new Set(relatedIds)];
      const names = uniqueRelatedIds
        .map((id) => profilesById.get(id)?.full_name)
        .filter((name): name is string => Boolean(name));
      const emails = uniqueRelatedIds
        .map((id) => profilesById.get(id)?.email)
        .filter((email): email is string => Boolean(email));
      return {
        related_member_ids: uniqueRelatedIds.join(", "),
        related_member_names: names.join("، "),
        related_member_emails: emails.join(", "),
        ...normalizeDataRow(row),
      };
    });

    const flattenSubmission = (row: DataRow): DataRow => {
      const course = relation(row.courses);
      const courseUniversity = relation(course?.universities);
      const suggestedUniversity = relation(row.suggested_universities);
      const targetMaterial = relation(row.target_material);
      const { courses, suggested_universities, target_material, ...rest } = row;
      return {
        ...rest,
        course_name: course?.name_ar ?? null,
        course_code: course?.code ?? null,
        course_university_id: course?.university_id ?? null,
        course_university_name: courseUniversity?.name_ar ?? null,
        suggested_university_name: suggestedUniversity?.name_ar ?? null,
        target_material_title: targetMaterial?.title_ar ?? null,
      };
    };
    const flattenDoctorSubmission = (row: DataRow): DataRow => {
      const university = relation(row.universities);
      const doctor = relation(row.target_doctor);
      const { universities, target_doctor, ...rest } = row;
      return {
        ...rest,
        university_name: university?.name_ar ?? null,
        target_doctor_name: doctor?.full_name ?? null,
        target_doctor_email: doctor?.email ?? null,
      };
    };
    const flattenMaterial = (row: DataRow): DataRow => {
      const course = relation(row.courses);
      const university = relation(course?.universities);
      const { courses, ...rest } = row;
      return {
        ...rest,
        course_name: course?.name_ar ?? null,
        course_code: course?.code ?? null,
        university_id: course?.university_id ?? null,
        university_name: university?.name_ar ?? null,
      };
    };
    const flattenDoctor = (row: DataRow): DataRow => {
      const university = relation(row.universities);
      const { universities, ...rest } = row;
      return { ...rest, university_name: university?.name_ar ?? null };
    };
    const flattenReport = (row: DataRow): DataRow => {
      const material = relation(row.materials);
      const course = relation(material?.courses);
      const university = relation(course?.universities);
      const { materials, ...rest } = row;
      return {
        ...rest,
        material_title: material?.title_ar ?? null,
        course_name: course?.name_ar ?? null,
        university_name: university?.name_ar ?? null,
      };
    };
    const flattenVote = (row: DataRow): DataRow => {
      const material = relation(row.materials);
      const course = relation(material?.courses);
      const { materials, ...rest } = row;
      return { ...rest, material_title: material?.title_ar ?? null, course_name: course?.name_ar ?? null };
    };
    const flattenFavorite = (row: DataRow): DataRow => {
      const course = relation(row.courses);
      const university = relation(course?.universities);
      const { courses, ...rest } = row;
      return {
        ...rest,
        course_name: course?.name_ar ?? null,
        course_code: course?.code ?? null,
        university_id: course?.university_id ?? null,
        university_name: university?.name_ar ?? null,
      };
    };

    const submissionRows = relatedRows(submissions, "user_id", profilesById, flattenSubmission);
    const doctorSubmissionRows = relatedRows(doctorSubmissions, "user_id", profilesById, flattenDoctorSubmission);
    const materialRows = relatedRows(materials, "created_by", profilesById, flattenMaterial);
    const doctorRows = relatedRows(doctors, "created_by", profilesById, flattenDoctor);
    const reportRows = relatedRows(reports, "user_id", profilesById, flattenReport);
    const voteRows = relatedRows(votes, "user_id", profilesById, flattenVote);
    const favoriteRows = relatedRows(favorites, "user_id", profilesById, flattenFavorite);
    const notificationRows = relatedRows(notifications, "user_id", profilesById);
    const uploadRows = relatedRows(uploadLogs, "user_id", profilesById);

    const profileRows = buildProfileRows(profiles);
    const authRows = buildAuthRows(profiles, authUsers);
    const dataset = [
      { name: "الملف الشخصي", rows: profileRows },
      { name: "حساب المصادقة", rows: authRows },
      { name: "المساهمات", rows: submissionRows },
      { name: "اقتراحات الدكاترة", rows: doctorSubmissionRows },
      { name: "المواد المضافة", rows: materialRows },
      { name: "الدكاترة المضافون", rows: doctorRows },
      { name: "البلاغات", rows: reportRows },
      { name: "التصويتات المفيدة", rows: voteRows },
      { name: "المساقات المفضلة", rows: favoriteRows },
      { name: "الإشعارات", rows: notificationRows },
      { name: "سجلات الرفع", rows: uploadRows },
      { name: "سجل النشاط", rows: activityRows },
    ];

    const summaryRows = dataset.map((item) => ({ data_type: item.name, record_count: item.rows.length }));
    const summaryNote =
      "يشمل بيانات الحساب والسجلات المرتبطة به في المنصة. لا يتضمن كلمات المرور أو رموز الجلسات/الدخول أو مفاتيح الأسرار أو بصمات IP.";
    const sheets: WorkbookSheet[] = [
      createSheet(
        "ملخص التصدير",
        "تصدير شامل لبيانات أعضاء PUSH",
        `${profiles.length.toLocaleString("ar")} حسابًا · ${summaryNote}`,
        [
          { key: "data_type", header: "فئة البيانات", width: 32 },
          { key: "record_count", header: "عدد السجلات", width: 18 },
        ],
        summaryRows
      ),
      createSheet("الملف الشخصي", "الملف الشخصي للأعضاء", summaryNote, MEMBER_COLUMNS, profileRows),
      createSheet(
        "حساب المصادقة",
        "بيانات حساب المصادقة الآمنة",
        "بيانات وصفية للحساب فقط؛ لا تُصدّر كلمات مرور أو رموزًا أو بيانات جلسات.",
        [
          ...MEMBER_CONTEXT_COLUMNS,
          { key: "auth_email", header: "البريد في نظام الدخول", width: 34 },
          { key: "auth_phone", header: "الهاتف في نظام الدخول", width: 20 },
          { key: "auth_created_at", header: "إنشاء حساب الدخول", width: 22 },
          { key: "auth_updated_at", header: "تحديث حساب الدخول", width: 22 },
          { key: "last_sign_in_at", header: "آخر تسجيل دخول", width: 22 },
          { key: "email_confirmed_at", header: "تأكيد البريد", width: 22 },
          { key: "phone_confirmed_at", header: "تأكيد الهاتف", width: 22 },
          { key: "providers", header: "مزودات الدخول", width: 20 },
          { key: "is_sso_user", header: "دخول موحد SSO", width: 18 },
          { key: "is_anonymous", header: "حساب مجهول", width: 16 },
        ],
        authRows
      ),
      createSheet(
        "المساهمات",
        "مساهمات الأعضاء ومراجعتها",
        summaryNote,
        [
          ...MEMBER_CONTEXT_COLUMNS,
          { key: "id", header: "معرّف المساهمة", width: 38 },
          { key: "user_id", header: "معرّف الحساب", width: 38 },
          { key: "submitter_name", header: "اسم المرسل", width: 24 },
          { key: "submitter_email", header: "بريد المرسل", width: 32 },
          { key: "kind", header: "نوع المساهمة", width: 18 },
          { key: "course_id", header: "معرّف المساق", width: 38 },
          { key: "course_name", header: "المساق", width: 28 },
          { key: "course_code", header: "رمز المساق", width: 16 },
          { key: "course_university_id", header: "معرّف الجامعة", width: 38 },
          { key: "course_university_name", header: "الجامعة", width: 26 },
          { key: "target_material_id", header: "معرّف المادة المستهدفة", width: 38 },
          { key: "target_material_title", header: "عنوان المادة المستهدفة", width: 32 },
          { key: "title_ar", header: "العنوان", width: 36 },
          { key: "description_ar", header: "الوصف", width: 44 },
          { key: "type", header: "تصنيف المادة", width: 16 },
          { key: "academic_year", header: "السنة الأكاديمية", width: 18 },
          { key: "semester", header: "الفصل", width: 16 },
          { key: "drive_link", header: "رابط الملف", width: 42 },
          { key: "youtube_id", header: "معرّف YouTube", width: 24 },
          { key: "file_size", header: "حجم الملف بالبايت", width: 20 },
          { key: "mime_type", header: "نوع الملف", width: 24 },
          { key: "page_count", header: "عدد الصفحات", width: 16 },
          { key: "suggested_course_name", header: "اسم المساق المقترح", width: 30 },
          { key: "suggested_course_code", header: "رمز المساق المقترح", width: 22 },
          { key: "suggested_university_id", header: "معرّف الجامعة المقترحة", width: 38 },
          { key: "suggested_university_name", header: "الجامعة المقترحة", width: 28 },
          { key: "status", header: "حالة المراجعة", width: 18 },
          { key: "admin_note", header: "ملاحظة الإدارة", width: 40 },
          { key: "reviewed_by", header: "معرّف المراجع", width: 38 },
          { key: "reviewed_at", header: "وقت المراجعة", width: 22 },
          { key: "created_at", header: "تاريخ الإرسال", width: 22 },
        ],
        submissionRows
      ),
      createSheet(
        "اقتراحات الدكاترة",
        "اقتراحات وتعديلات بيانات الدكاترة",
        summaryNote,
        [
          ...MEMBER_CONTEXT_COLUMNS,
          { key: "id", header: "معرّف الاقتراح", width: 38 },
          { key: "user_id", header: "معرّف الحساب", width: 38 },
          { key: "submitter_name", header: "اسم المرسل", width: 24 },
          { key: "submitter_email", header: "بريد المرسل", width: 32 },
          { key: "kind", header: "نوع الطلب", width: 16 },
          { key: "target_doctor_id", header: "معرّف الدكتور المستهدف", width: 38 },
          { key: "target_doctor_name", header: "الدكتور المستهدف", width: 28 },
          { key: "target_doctor_email", header: "بريد الدكتور المستهدف", width: 32 },
          { key: "full_name", header: "اسم الدكتور المقترح", width: 28 },
          { key: "email", header: "البريد الأكاديمي", width: 32 },
          { key: "office_location", header: "المكتب", width: 28 },
          { key: "university_id", header: "معرّف الجامعة", width: 38 },
          { key: "university_name", header: "الجامعة", width: 28 },
          { key: "courses", header: "المساقات", width: 40 },
          { key: "status", header: "حالة المراجعة", width: 18 },
          { key: "admin_note", header: "ملاحظة الإدارة", width: 40 },
          { key: "reviewed_by", header: "معرّف المراجع", width: 38 },
          { key: "reviewed_at", header: "وقت المراجعة", width: 22 },
          { key: "created_at", header: "تاريخ الإرسال", width: 22 },
        ],
        doctorSubmissionRows
      ),
      createSheet(
        "المواد المضافة",
        "المواد التي أضافها الأعضاء",
        summaryNote,
        [
          ...MEMBER_CONTEXT_COLUMNS,
          { key: "id", header: "معرّف المادة", width: 38 },
          { key: "created_by", header: "معرّف الناشر", width: 38 },
          { key: "course_id", header: "معرّف المساق", width: 38 },
          { key: "course_name", header: "المساق", width: 28 },
          { key: "course_code", header: "رمز المساق", width: 16 },
          { key: "university_id", header: "معرّف الجامعة", width: 38 },
          { key: "university_name", header: "الجامعة", width: 28 },
          { key: "title_ar", header: "العنوان", width: 34 },
          { key: "description_ar", header: "الوصف", width: 44 },
          { key: "type", header: "النوع", width: 16 },
          { key: "academic_year", header: "السنة الأكاديمية", width: 18 },
          { key: "semester", header: "الفصل", width: 16 },
          { key: "drive_link", header: "رابط الملف", width: 42 },
          { key: "youtube_id", header: "معرّف YouTube", width: 24 },
          { key: "is_featured", header: "مميزة", width: 12 },
          { key: "is_verified", header: "موثقة", width: 12 },
          { key: "downloads_count", header: "عدد التنزيلات", width: 18 },
          { key: "helpful_count", header: "عدد التقييمات المفيدة", width: 20 },
          { key: "file_size", header: "حجم الملف بالبايت", width: 20 },
          { key: "mime_type", header: "نوع الملف", width: 24 },
          { key: "page_count", header: "عدد الصفحات", width: 16 },
          { key: "search_text", header: "نص البحث المشتق", width: 44 },
          { key: "created_at", header: "تاريخ الإضافة", width: 22 },
        ],
        materialRows
      ),
      createSheet(
        "الدكاترة المضافون",
        "الدكاترة الذين أضافهم الأعضاء",
        summaryNote,
        [
          ...MEMBER_CONTEXT_COLUMNS,
          { key: "id", header: "معرّف الدكتور", width: 38 },
          { key: "created_by", header: "معرّف المُضيف", width: 38 },
          { key: "full_name", header: "الاسم الكامل", width: 28 },
          { key: "email", header: "البريد الأكاديمي", width: 32 },
          { key: "office_location", header: "المكتب", width: 28 },
          { key: "university_id", header: "معرّف الجامعة", width: 38 },
          { key: "university_name", header: "الجامعة", width: 28 },
          { key: "courses", header: "المساقات", width: 40 },
          { key: "created_at", header: "تاريخ الإضافة", width: 22 },
          { key: "updated_at", header: "آخر تحديث", width: 22 },
        ],
        doctorRows
      ),
      createSheet(
        "البلاغات",
        "البلاغات التي قدمها الأعضاء",
        `${summaryNote} لا يتضمن هذا الملف بصمة عنوان IP المستخدمة لمكافحة الإساءة.`,
        [
          ...MEMBER_CONTEXT_COLUMNS,
          { key: "id", header: "معرّف البلاغ", width: 38 },
          { key: "user_id", header: "معرّف الحساب", width: 38 },
          { key: "material_id", header: "معرّف المادة", width: 38 },
          { key: "material_title", header: "المادة المبلّغ عنها", width: 34 },
          { key: "course_name", header: "المساق", width: 28 },
          { key: "university_name", header: "الجامعة", width: 28 },
          { key: "reporter_email", header: "بريد المبلّغ", width: 32 },
          { key: "reason", header: "سبب البلاغ", width: 20 },
          { key: "details", header: "التفاصيل", width: 44 },
          { key: "status", header: "الحالة", width: 16 },
          { key: "resolved_by", header: "معرّف المعالج", width: 38 },
          { key: "resolved_at", header: "وقت المعالجة", width: 22 },
          { key: "created_at", header: "تاريخ البلاغ", width: 22 },
        ],
        reportRows
      ),
      createSheet(
        "التصويتات المفيدة",
        "تصويتات الأعضاء على المواد",
        summaryNote,
        [
          ...MEMBER_CONTEXT_COLUMNS,
          { key: "user_id", header: "معرّف الحساب", width: 38 },
          { key: "material_id", header: "معرّف المادة", width: 38 },
          { key: "material_title", header: "المادة", width: 34 },
          { key: "course_name", header: "المساق", width: 28 },
          { key: "created_at", header: "تاريخ التصويت", width: 22 },
        ],
        voteRows
      ),
      createSheet(
        "المساقات المفضلة",
        "المساقات التي حفظها الأعضاء كمفضلة",
        summaryNote,
        [
          ...MEMBER_CONTEXT_COLUMNS,
          { key: "user_id", header: "معرّف الحساب", width: 38 },
          { key: "course_id", header: "معرّف المساق", width: 38 },
          { key: "course_name", header: "المساق", width: 30 },
          { key: "course_code", header: "رمز المساق", width: 18 },
          { key: "university_id", header: "معرّف الجامعة", width: 38 },
          { key: "university_name", header: "الجامعة", width: 28 },
          { key: "created_at", header: "تاريخ الحفظ", width: 22 },
        ],
        favoriteRows
      ),
      createSheet(
        "الإشعارات",
        "إشعارات الأعضاء",
        summaryNote,
        [
          ...MEMBER_CONTEXT_COLUMNS,
          { key: "id", header: "معرّف الإشعار", width: 38 },
          { key: "user_id", header: "معرّف الحساب", width: 38 },
          { key: "title", header: "العنوان", width: 34 },
          { key: "message", header: "الرسالة", width: 48 },
          { key: "link", header: "الرابط", width: 42 },
          { key: "is_read", header: "مقروء", width: 12 },
          { key: "created_at", header: "تاريخ الإشعار", width: 22 },
        ],
        notificationRows
      ),
      createSheet(
        "سجلات الرفع",
        "سجل الملفات التي رفعها الأعضاء",
        summaryNote,
        [
          ...MEMBER_CONTEXT_COLUMNS,
          { key: "id", header: "معرّف السجل", width: 38 },
          { key: "user_id", header: "معرّف الحساب", width: 38 },
          { key: "file_name", header: "اسم الملف", width: 42 },
          { key: "file_size", header: "حجم الملف بالبايت", width: 20 },
          { key: "created_at", header: "تاريخ الرفع", width: 22 },
        ],
        uploadRows
      ),
      createSheet(
        "سجل النشاط",
        "سجل النشاط الإداري المرتبط بالأعضاء",
        summaryNote,
        [
          { key: "related_member_ids", header: "معرّف/معرّفات العضو", width: 42 },
          { key: "related_member_names", header: "اسم/أسماء العضو", width: 32 },
          { key: "related_member_emails", header: "بريد/عناوين العضو", width: 40 },
          { key: "id", header: "معرّف الحدث", width: 38 },
          { key: "actor_id", header: "معرّف الفاعل", width: 38 },
          { key: "actor_name", header: "اسم الفاعل", width: 28 },
          { key: "actor_email", header: "بريد الفاعل", width: 34 },
          { key: "action", header: "رمز العملية", width: 26 },
          { key: "target_type", header: "نوع الهدف", width: 20 },
          { key: "target_id", header: "معرّف الهدف", width: 38 },
          { key: "title_ar", header: "وصف الحدث", width: 44 },
          { key: "course_id", header: "معرّف المساق", width: 38 },
          { key: "university_id", header: "معرّف الجامعة", width: 38 },
          { key: "created_at", header: "تاريخ الحدث", width: 22 },
        ],
        activityRows
      ),
    ];

    const totalRelatedRecords = dataset.reduce((total, item) => total + item.rows.length, 0);
    await logActivity({
      actor,
      action: "members_exported",
      target_type: "member_export",
      title_ar: `تصدير Excel شامل: ${profiles.length} حساب و${totalRelatedRecords} سجل مرتبط`,
    });

    const workbook = await createXlsxWorkbook(sheets);
    const fileName = `PUSH-members-full-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const responseBody = new Uint8Array(workbook.byteLength);
    responseBody.set(workbook);
    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
        "Content-Length": String(workbook.byteLength),
        "Cache-Control": "no-store, max-age=0",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    return serverError(error, "تعذر إعداد ملف Excel الشامل. حاول مرة أخرى.");
  }
}
