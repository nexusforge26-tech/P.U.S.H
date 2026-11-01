import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const src = fs.readFileSync(path.resolve(process.cwd(), "lib/googleDrive.ts"), "utf8");
const uploadRoute = fs.readFileSync(path.resolve(process.cwd(), "app/api/upload/drive/initiate/route.ts"), "utf8");
const admin = fs.readFileSync(path.resolve(process.cwd(), "app/admin/components/OverviewTab.tsx"), "utf8");
const env = fs.readFileSync(path.resolve(process.cwd(), ".env.example"), "utf8");

test("OAuth and service-account token caches/accessors are isolated; legacy accessor prefers service account", () => {
  assert.match(src, /cachedOAuthToken/);
  assert.match(src, /cachedServiceAccountToken/);
  assert.match(src, /getOAuthDriveAccessToken/);
  assert.match(src, /getServiceAccountDriveAccessToken/);
  assert.match(src, /if \(process\.env\.GOOGLE_SERVICE_ACCOUNT_EMAIL && process\.env\.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY\) return getServiceAccountDriveAccessToken\(\)/);
});

test("new resumable upload requires OAuth and the dedicated upload parent", () => {
  const begin = src.indexOf("export async function initiateDriveResumableUpload");
  const end = src.indexOf("export async function finalizeDriveUpload", begin);
  const body = src.slice(begin, end);
  assert.match(body, /GOOGLE_DRIVE_UPLOAD_FOLDER_ID/);
  assert.match(body, /getOAuthDriveAccessToken\(\)/);
  assert.match(body, /parents: \[folderId\]/);
  assert.doesNotMatch(body, /GOOGLE_DRIVE_FOLDER_ID/);
});

test("finalization uses new upload folder and keeps legacy fallback only when unset", () => {
  assert.match(src, /GOOGLE_DRIVE_UPLOAD_FOLDER_ID \|\| process\.env\.GOOGLE_DRIVE_FOLDER_ID/);
  assert.match(src, /existing\.parents\?\.includes\(folderId\)/);
});

test("delete fails closed on absent metadata/parents and permits only configured legacy or upload folder", () => {
  assert.match(src, /\[process\.env\.GOOGLE_DRIVE_FOLDER_ID, process\.env\.GOOGLE_DRIVE_UPLOAD_FOLDER_ID\]/);
  assert.match(src, /if \(!metaRes\.ok\) return false/);
  assert.match(src, /!Array\.isArray\(meta\.parents\)/);
  assert.match(src, /meta\.parents\.some\(\(parent\) => allowedParents\.includes\(parent\)\)/);
});

test("upload preflight probes OAuth-owned upload folder, quota unavailable is not a blocking zero quota", () => {
  assert.match(src, /const token = await getOAuthDriveAccessToken\(\)/);
  assert.match(src, /uploadFolder = process\.env\.GOOGLE_DRIVE_UPLOAD_FOLDER_ID/);
  assert.match(src, /unavailableReason: "drive_file_scope"/);
  assert.match(uploadRoute, /if \(quota\?\.limit && quota\.usage \+ fileSize > quota\.limit\)/);
  assert.match(admin, /لا يمكن قياس حصة المالك بأمان عبر صلاحية drive\.file/);
});

test("diagnostics/docs explain split identities, folder sharing, and avoid exposing credentials", () => {
  assert.match(src, /"split"/);
  assert.match(admin, /وضع منفصل: حساب الخدمة للقراءة والإدارة \+ OAuth للرفع/);
  assert.match(env, /GOOGLE_DRIVE_UPLOAD_FOLDER_ID/);
  assert.match(env, /drive\.file/);
  assert.match(env, /بصلاحية Editor/);
});
