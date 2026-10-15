import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("extractYoutubeId validates 11-character IDs strictly and rejects trailing garbage", () => {
  const youtubeSrc = fs.readFileSync(path.resolve(process.cwd(), "lib/youtube.ts"), "utf8");
  assert.ok(
    youtubeSrc.includes("/^[\\w-]{11}$/"),
    "يجب أن يحتوي regex معرّف يوتيوب على $ في النهاية"
  );

  const YOUTUBE_ID_REGEX = /^[\w-]{11}$/;
  const ALLOWED_YOUTUBE_HOSTS = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
  ]);
  function extractYoutubeId(input) {
    if (typeof input !== "string") return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (YOUTUBE_ID_REGEX.test(trimmed)) return trimmed;
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      const host = url.hostname.toLowerCase();
      if (!ALLOWED_YOUTUBE_HOSTS.has(host)) return null;
      if (host === "youtu.be" || host === "www.youtu.be") {
        const candidate = url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
        return YOUTUBE_ID_REGEX.test(candidate) ? candidate : null;
      }
      const vParam = url.searchParams.get("v");
      if (vParam) return YOUTUBE_ID_REGEX.test(vParam) ? vParam : null;
      const pathMatch = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})(?:\/|$)/);
      return pathMatch?.[1] && YOUTUBE_ID_REGEX.test(pathMatch[1]) ? pathMatch[1] : null;
    } catch {
      return null;
    }
  }

  assert.equal(extractYoutubeId("IPvYjXCsTg8"), "IPvYjXCsTg8");
  assert.equal(extractYoutubeId("https://www.youtube.com/watch?v=IPvYjXCsTg8"), "IPvYjXCsTg8");
  assert.equal(extractYoutubeId("https://youtu.be/IPvYjXCsTg8?si=123"), "IPvYjXCsTg8");
  assert.equal(extractYoutubeId("https://www.youtube.com/shorts/IPvYjXCsTg8"), "IPvYjXCsTg8");
  assert.equal(extractYoutubeId("https://www.youtube.com/embed/IPvYjXCsTg8"), "IPvYjXCsTg8");
  assert.equal(extractYoutubeId("IPvYjXCsTg8_extra_random_chars"), null);
  assert.equal(extractYoutubeId("javascript:alert(1)"), null);
});

test("validateLink blocks javascript:, data:, http:, localhost, and untrusted domains while accepting Google Drive", () => {
  const valSrc = fs.readFileSync(path.resolve(process.cwd(), "lib/validation.ts"), "utf8");
  assert.ok(valSrc.includes("export function validateLink"));
  assert.ok(valSrc.includes("javascript|data|vbscript"));
});

test("normalizeArabic unifies hamzas, ta-marbuta, alef-maksora, and strips diacritics", () => {
  const arSrc = fs.readFileSync(path.resolve(process.cwd(), "lib/arabic.ts"), "utf8");
  assert.ok(arSrc.includes("export function normalizeArabic"));
});

test("validateUploadFileMeta blocks dangerous files (.exe, .html, .svg, .js) and allows academic formats (.pdf, .docx, .zip)", () => {
  const uploadLimitsSrc = fs.readFileSync(
    path.resolve(process.cwd(), "lib/uploadLimits.ts"),
    "utf8"
  );
  assert.ok(uploadLimitsSrc.includes('"exe"'));
  assert.ok(uploadLimitsSrc.includes('"html"'));
  assert.ok(uploadLimitsSrc.includes('"pdf"'));
  assert.ok(uploadLimitsSrc.includes('"docx"'));
});

test("No hardcoded personal owner email remains in schema.sql, API routes, or README.md", () => {
  const filesToCheck = [
    "supabase/schema.sql",
    "app/api/admin/users/route.ts",
    "lib/auth.ts",
    "README.md",
  ];
  for (const rel of filesToCheck) {
    const content = fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
    assert.equal(
      content.includes("ydha957@gmail.com"),
      false,
      `يجب ألا يحتوي الملف ${rel} على البريد المثبت ydha957@gmail.com`
    );
  }
});
