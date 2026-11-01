import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
const uploadInput = read("components/DriveFileInput.tsx");
const submissionsApi = read("app/api/submissions/route.ts");
const accountApi = read("app/api/materials/mine/route.ts");
const drive = read("lib/googleDrive.ts");
const submitPage = read("app/submit/page.tsx");
const terms = read("app/terms/page.tsx");

test("shared file control uploads files and no longer accepts pasted links", () => {
  assert.match(uploadInput, /type="file"/);
  assert.match(uploadInput, /\/api\/upload\/drive\/initiate/);
  assert.match(uploadInput, /\/api\/upload\/drive\/finalize/);
  assert.doesNotMatch(uploadInput, /type="url"|handlePasteChange|\bpasted\b|الصق رابط/);
});

test("new non-video submissions require an uploaded file in the dedicated Drive folder", () => {
  assert.match(drive, /export async function isDriveFileInUploadFolder/);
  assert.match(submissionsApi, /!linkCheck\.isDrive \|\| !linkCheck\.driveFileId/);
  assert.match(submissionsApi, /isDriveFileInUploadFolder\(linkCheck\.driveFileId\)/);
});

test("self-service file replacement requires an upload-folder file", () => {
  assert.match(accountApi, /isDriveFileInUploadFolder\(linkCheck\.driveFileId\)/);
});

test("video submissions retain their dedicated YouTube link field and policy disclosure", () => {
  assert.match(submitPage, /placeholder="رابط YouTube \(/);
  assert.match(terms, /رابط YouTube فقط لمساهمات الفيديو/);
});
