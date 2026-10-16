import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// نحوّل lib/roles.ts (دوال نقية) إلى JS مؤقت ونختبر الكود الحقيقي.
async function loadRoles() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "push-roles-"));
  const src = fs.readFileSync(path.resolve(process.cwd(), "lib/roles.ts"), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  fs.writeFileSync(path.join(dir, "roles.mjs"), out);
  return import(pathToFileURL(path.join(dir, "roles.mjs")).href);
}

const UNI_A = "aaaaaaaa-0000-4000-8000-000000000001";
const UNI_B = "bbbbbbbb-0000-4000-8000-000000000002";

test("getStaffScope: owner/admin = كل الجامعات، مسؤول الجامعة = جامعته فقط", async () => {
  const { getStaffScope } = await loadRoles();
  assert.deepEqual(getStaffScope({ role: "owner" }), { allowed: true, universityId: null });
  assert.deepEqual(getStaffScope({ role: "admin" }), { allowed: true, universityId: null });
  assert.deepEqual(getStaffScope({ role: "uni_admin", managed_university_id: UNI_A }), {
    allowed: true,
    universityId: UNI_A,
  });
});

test("getStaffScope: مسؤول جامعة بلا جامعة مرتبطة أو مستخدم عادي = بلا صلاحية", async () => {
  const { getStaffScope } = await loadRoles();
  assert.equal(getStaffScope({ role: "uni_admin", managed_university_id: null }).allowed, false);
  assert.equal(getStaffScope({ role: "user" }).allowed, false);
});

test("isUniversityInScope", async () => {
  const { isUniversityInScope } = await loadRoles();
  assert.equal(isUniversityInScope(null, UNI_B), true);
  assert.equal(isUniversityInScope(UNI_A, UNI_A), true);
  assert.equal(isUniversityInScope(UNI_A, UNI_B), false);
  assert.equal(isUniversityInScope(UNI_A, null), false);
});

test("canManageTarget: المالك على الجميع، المسؤول العادي عدا المالك، مسؤول الجامعة لا أحد", async () => {
  const { canManageTarget, ALL_ROLES } = await loadRoles();
  for (const t of ALL_ROLES) assert.equal(canManageTarget("owner", t), true);
  assert.equal(canManageTarget("admin", "owner"), false);
  for (const t of ["user", "uni_admin", "admin"]) assert.equal(canManageTarget("admin", t), true);
  for (const t of ALL_ROLES) assert.equal(canManageTarget("uni_admin", t), false);
  for (const t of ALL_ROLES) assert.equal(canManageTarget("user", t), false);
});

const base = { actorId: "a", targetId: "t", targetEmail: "x@x.com", ownerEnv: "boss@x.com" };

test("validateRoleChange: مسؤول الجامعة لا يعدّل أي أحد", async () => {
  const { validateRoleChange } = await loadRoles();
  for (const targetRole of ["user", "uni_admin", "admin", "owner"]) {
    const r = validateRoleChange({ ...base, actorRole: "uni_admin", targetRole, newRole: "user" });
    assert.equal(r.allowed, false, `uni_admin -> ${targetRole}`);
  }
  // ولا يستطيع ترقية أحد إلى مسؤول
  assert.equal(
    validateRoleChange({ ...base, actorRole: "uni_admin", targetRole: "user", newRole: "admin" }).allowed,
    false
  );
});

test("validateRoleChange: المسؤول العادي لا صلاحية له على المالك ولا يرقّي إلى مالك", async () => {
  const { validateRoleChange } = await loadRoles();
  assert.equal(
    validateRoleChange({ ...base, actorRole: "admin", targetRole: "owner", newRole: "user" }).allowed,
    false
  );
  assert.equal(
    validateRoleChange({ ...base, actorRole: "admin", targetRole: "user", newRole: "owner" }).allowed,
    false
  );
  assert.equal(
    validateRoleChange({ ...base, actorRole: "admin", targetRole: "user", newRole: "uni_admin" }).allowed,
    true
  );
  assert.equal(
    validateRoleChange({ ...base, actorRole: "admin", targetRole: "uni_admin", newRole: "user" }).allowed,
    true
  );
});

test("validateRoleChange: المالك يعدّل الجميع (عدا خفض نفسه أو المالك الأساسي)", async () => {
  const { validateRoleChange } = await loadRoles();
  for (const targetRole of ["user", "uni_admin", "admin"]) {
    assert.equal(
      validateRoleChange({ ...base, actorRole: "owner", targetRole, newRole: "admin" }).allowed,
      true
    );
  }
  assert.equal(
    validateRoleChange({ ...base, actorRole: "owner", targetRole: "admin", newRole: "owner" }).allowed,
    true
  );
  assert.equal(
    validateRoleChange({ ...base, actorRole: "owner", targetId: "a", targetRole: "owner", newRole: "admin" })
      .allowed,
    false
  );
  assert.equal(
    validateRoleChange({
      ...base,
      actorRole: "owner",
      targetEmail: "boss@x.com",
      targetRole: "owner",
      newRole: "user",
    }).allowed,
    false
  );
});

test("validateRoleChange: دور غير معروف مرفوض", async () => {
  const { validateRoleChange } = await loadRoles();
  assert.equal(
    validateRoleChange({ ...base, actorRole: "owner", targetRole: "user", newRole: "superuser" }).allowed,
    false
  );
});

test("validateUserDeletion", async () => {
  const { validateUserDeletion } = await loadRoles();
  // مسؤول الجامعة لا يحذف أحدًا
  for (const targetRole of ["user", "uni_admin", "admin", "owner"]) {
    assert.equal(validateUserDeletion({ ...base, actorRole: "uni_admin", targetRole }).allowed, false);
  }
  // المسؤول العادي يحذف المستخدمين فقط؛ حذف المسؤولين للمالك
  assert.equal(validateUserDeletion({ ...base, actorRole: "admin", targetRole: "user" }).allowed, true);
  assert.equal(validateUserDeletion({ ...base, actorRole: "admin", targetRole: "uni_admin" }).allowed, false);
  assert.equal(validateUserDeletion({ ...base, actorRole: "admin", targetRole: "admin" }).allowed, false);
  assert.equal(validateUserDeletion({ ...base, actorRole: "owner", targetRole: "uni_admin" }).allowed, true);
  // لا أحد يحذف المالك
  assert.equal(validateUserDeletion({ ...base, actorRole: "owner", targetRole: "owner" }).allowed, false);
});

test("roleLabel يعرض اسم الجامعة لمسؤول الجامعة", async () => {
  const { roleLabel } = await loadRoles();
  assert.equal(roleLabel("uni_admin", "جامعة النجاح"), "مسؤول (جامعة النجاح)");
  assert.equal(roleLabel("admin"), "مسؤول");
  assert.equal(roleLabel("owner"), "مالك");
});
