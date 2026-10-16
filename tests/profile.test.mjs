import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// نحوّل ملفات TypeScript المشتركة (phone.ts و profile.ts) إلى JS مؤقتًا ونختبر الكود الحقيقي
// بدل إعادة كتابته داخل الاختبار.
async function loadLib() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "push-profile-"));
  for (const name of ["phone", "profile"]) {
    const src = fs.readFileSync(path.resolve(process.cwd(), `lib/${name}.ts`), "utf8");
    const out = ts
      .transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
      })
      .outputText.replace(/from "\.\/phone"/g, 'from "./phone.mjs"');
    fs.writeFileSync(path.join(dir, `${name}.mjs`), out);
  }
  const phone = await import(pathToFileURL(path.join(dir, "phone.mjs")).href);
  const profile = await import(pathToFileURL(path.join(dir, "profile.mjs")).href);
  return { phone, profile };
}

const UNI = "3f2b8c1e-4d5a-4b6c-8e7f-9a0b1c2d3e4f";

test("normalizePhone builds E.164 from dial code + local number", async () => {
  const { phone } = await loadLib();
  assert.deepEqual(phone.normalizePhone("970", "599123456"), {
    valid: true, e164: "+970599123456", dial: "970", local: "599123456",
  });
  // صفر بادئ ومسافات وشرطات
  assert.equal(phone.normalizePhone("970", "0599 123-456").e164, "+970599123456");
  // أرقام عربية
  assert.equal(phone.normalizePhone("970", "٠٥٩٩١٢٣٤٥٦").e164, "+970599123456");
  // رقم كامل بصيغة دولية يتجاوز القائمة المنسدلة
  assert.equal(phone.normalizePhone("962", "+970599123456").e164, "+970599123456");
  assert.equal(phone.normalizePhone("962", "00970599123456").e164, "+970599123456");
  // دولة أخرى
  assert.equal(phone.normalizePhone("962", "791234567").e164, "+962791234567");
});

test("normalizePhone rejects empty, non-numeric, too short/long and unknown dial codes", async () => {
  const { phone } = await loadLib();
  assert.equal(phone.normalizePhone("970", "").valid, false);
  assert.equal(phone.normalizePhone("970", "abc12345").valid, false);
  assert.equal(phone.normalizePhone("970", "12345").valid, false);
  assert.equal(phone.normalizePhone("970", "5991234567890").valid, false);
  assert.equal(phone.normalizePhone("999", "599123456").valid, false);
  assert.equal(phone.normalizePhone("962", "+99912345678").valid, false);
});

test("splitE164 and isValidStoredPhone round-trip stored values", async () => {
  const { phone } = await loadLib();
  assert.deepEqual(phone.splitE164("+970599123456"), { dial: "970", local: "599123456" });
  assert.deepEqual(phone.splitE164("+12025550123"), { dial: "1", local: "2025550123" });
  assert.deepEqual(phone.splitE164(null), { dial: "970", local: "" });
  assert.equal(phone.isValidStoredPhone("+970599123456"), true);
  assert.equal(phone.isValidStoredPhone("0599123456"), false);
  assert.equal(phone.isValidStoredPhone("+970"), false);
  assert.equal(phone.isValidStoredPhone(null), false);
  assert.equal(phone.whatsappLink("+970599123456"), "https://wa.me/970599123456");
  assert.equal(phone.whatsappLink("bad"), null);
});

test("isProfileComplete requires name, phone, whatsapp and university together", async () => {
  const { profile } = await loadLib();
  const full = { full_name: "أحمد", phone: "+970599123456", whatsapp: "+970599123456", university_id: UNI };
  assert.equal(profile.isProfileComplete(full), true);
  assert.equal(profile.isProfileComplete(null), false);
  assert.equal(profile.isProfileComplete({ ...full, full_name: "  " }), false);
  assert.equal(profile.isProfileComplete({ ...full, full_name: null }), false);
  assert.equal(profile.isProfileComplete({ ...full, phone: null }), false);
  assert.equal(profile.isProfileComplete({ ...full, whatsapp: "" }), false);
  assert.equal(profile.isProfileComplete({ ...full, university_id: null }), false);
  // حساب قديم: لديه اسم من Google فقط
  assert.equal(profile.isProfileComplete({ full_name: "Ahmad", phone: null, whatsapp: null, university_id: null }), false);
});

test("validateProfileInput returns per-field errors and canonical values", async () => {
  const { profile } = await loadLib();

  const bad = profile.validateProfileInput({});
  assert.equal(bad.valid, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ["full_name", "phone", "university_id", "whatsapp"]);

  const noPlus = profile.validateProfileInput({
    full_name: "سارة", phone: "0599123456", whatsapp: "+970599123456", university_id: UNI,
  });
  assert.equal(noPlus.valid, false);
  assert.ok(noPlus.errors.phone);

  const badUni = profile.validateProfileInput({
    full_name: "سارة", phone: "+970599123456", whatsapp: "+970599123456", university_id: "not-a-uuid",
  });
  assert.equal(badUni.valid, false);
  assert.ok(badUni.errors.university_id);

  const ok = profile.validateProfileInput({
    full_name: "  أحمد   كامل  ", phone: "+970 599 123 456", whatsapp: "+962791234567", university_id: UNI,
  });
  assert.equal(ok.valid, true);
  assert.deepEqual(ok.values, {
    full_name: "أحمد كامل",
    phone: "+970599123456",
    whatsapp: "+962791234567",
    university_id: UNI,
  });
});

test("write routes are guarded server-side and the gate cannot be dismissed", () => {
  const read = (p) => fs.readFileSync(path.resolve(process.cwd(), p), "utf8");
  for (const route of [
    "app/api/submissions/route.ts",
    "app/api/doctor-submissions/route.ts",
    "app/api/upload/drive/initiate/route.ts",
    "app/api/upload/drive/finalize/route.ts",
    "app/api/materials/mine/route.ts",
  ]) {
    assert.ok(read(route).includes("rejectIfProfileIncomplete(account.profile)"), `${route} must enforce completed profile`);
  }
  // /api/me و /api/profile يجب ألا يُحجبا، وإلا لا يستطيع المستخدم إكمال بياناته
  assert.ok(!read("app/api/me/route.ts").includes("rejectIfProfileIncomplete"));
  assert.ok(!read("app/api/profile/route.ts").includes("rejectIfProfileIncomplete"));

  // نتجاهل التعليقات حتى لا تُحتسب كلمات مثل Escape الواردة في الشرح
  const gate = read("components/ProfileGate.tsx").replace(/\/\/.*$/gm, "");
  assert.ok(!/Escape|onKeyDown|data-dismiss|onClose/.test(gate), "gate must not have a dismiss handler");
  assert.ok(gate.includes('setAttribute("inert"'));
});
