import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import JSZip from "jszip";
import { createXlsxWorkbook } from "../lib/memberWorkbook.mjs";

const fixedDate = new Date("2026-10-31T14:30:00.000Z");

test("builds an Arabic right-to-left XLSX workbook with frozen headers and filters", async () => {
  const buffer = await createXlsxWorkbook(
    [
      {
        name: "الملف الشخصي",
        title: "تصدير PUSH & بيانات الأعضاء",
        subtitle: "سجل تجريبي",
        columns: [
          { key: "full_name", header: "الاسم", width: 28 },
          { key: "created_at", header: "تاريخ التسجيل", width: 22 },
        ],
        rows: [{ full_name: "عضو تجريبي", created_at: fixedDate }],
      },
    ],
    fixedDate
  );

  const zip = await JSZip.loadAsync(buffer);
  assert.ok(zip.file("[Content_Types].xml"));
  assert.ok(zip.file("xl/workbook.xml"));
  assert.ok(zip.file("xl/styles.xml"));
  assert.ok(zip.file("xl/worksheets/sheet1.xml"));

  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const worksheetXml = await zip.file("xl/worksheets/sheet1.xml").async("string");
  assert.match(workbookXml, /name="الملف الشخصي"/);
  assert.match(worksheetXml, /rightToLeft="1"/);
  assert.match(worksheetXml, /pane ySplit="4"/);
  assert.match(worksheetXml, /autoFilter ref="A4:B5"/);
  assert.match(worksheetXml, /&amp;/);
  assert.match(worksheetXml, /عضو تجريبي/);
  assert.match(worksheetXml, /<c r="B5" s="6" t="n">/);
});

test("writes formula-looking member data only as escaped inline text", async () => {
  const buffer = await createXlsxWorkbook(
    [
      {
        name: "حساب",
        title: "تصدير",
        columns: [{ key: "value", header: "قيمة" }],
        rows: [{ value: '=HYPERLINK("https://unsafe.invalid","افتح") <test>' }],
      },
    ],
    fixedDate
  );
  const zip = await JSZip.loadAsync(buffer);
  const worksheetXml = await zip.file("xl/worksheets/sheet1.xml").async("string");

  assert.match(worksheetXml, /t="inlineStr"><is><t xml:space="preserve">=HYPERLINK/);
  assert.match(worksheetXml, /&quot;https:\/\/unsafe.invalid&quot;/);
  assert.match(worksheetXml, /&lt;test&gt;/);
  assert.doesNotMatch(worksheetXml, /<f(?:\s|>)/i);
});

test("protects comprehensive export behind global roles and covers member-linked records", async () => {
  const route = await readFile(new URL("../app/api/admin/users/export/route.ts", import.meta.url), "utf8");
  const ui = await readFile(new URL("../app/admin/components/MembersTab.tsx", import.meta.url), "utf8");

  assert.match(route, /requireRole\(req, \["admin", "owner"\]\)/);
  for (const table of [
    "profiles",
    "submissions",
    "doctor_submissions",
    "materials",
    "doctors",
    "material_reports",
    "material_votes",
    "favorite_courses",
    "notifications",
    "upload_log",
    "activity_log",
  ]) {
    assert.match(route, new RegExp(`\\"${table}\\"`));
  }
  assert.match(route, /members_exported/);
  assert.match(ui, /confirm\(warning\)/);
  assert.match(ui, /api\/admin\/users\/export/);
  assert.doesNotMatch(route, /reporter_ip_hash|encrypted_password|refresh_token|access_token/);
});
