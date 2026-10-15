/**
 * يجعل كل الملفات داخل مجلد المستودع (GOOGLE_DRIVE_FOLDER_ID) بما فيها المجلدات الفرعية
 * قابلة للعرض لأي شخص لديه الرابط (anyone / reader)، بغض النظر عن حجم الملف.
 * لا يغيّر صلاحيات المجلدات نفسها، ولا يحذف أو ينقل أي شيء.
 *
 * مكانه في المشروع: scripts/make-drive-public.mjs
 *
 * التشغيل (جرّب أولًا بدون تعديل فعلي):
 *   DRY_RUN=1 node --env-file=.env.local scripts/make-drive-public.mjs
 * ثم التنفيذ الفعلي:
 *   node --env-file=.env.local scripts/make-drive-public.mjs
 *
 * يحتاج Node 20 أو أحدث (node --env-file).
 */

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const DRY_RUN = process.env.DRY_RUN === "1";
const CONCURRENCY = 5;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !ROOT_FOLDER_ID) {
  console.error(
    "يرجى ضبط GOOGLE_OAUTH_CLIENT_ID و GOOGLE_OAUTH_CLIENT_SECRET و GOOGLE_OAUTH_REFRESH_TOKEN و GOOGLE_DRIVE_FOLDER_ID"
  );
  process.exit(1);
}

let accessToken = "";
let tokenExpiresAt = 0;

async function getToken() {
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) return accessToken;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`فشل الحصول على access token: ${JSON.stringify(data)}`);
  }
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in ?? 3500) * 1000;
  return accessToken;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function driveFetch(url, options = {}, attempt = 0) {
  const token = await getToken();
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });
  if ((res.status === 429 || res.status >= 500 || res.status === 403) && attempt < 5) {
    // 403 قد يكون rateLimitExceeded؛ نعيد المحاولة مع تأخير تصاعدي
    const body = await res.clone().text();
    if (res.status !== 403 || /rateLimit|userRateLimit|quota/i.test(body)) {
      await sleep(1000 * 2 ** attempt);
      return driveFetch(url, options, attempt + 1);
    }
  }
  return res;
}

async function listChildren(folderId) {
  const items = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "nextPageToken,files(id,name,mimeType,permissions(type,role))",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`);
    if (!res.ok) throw new Error(`فشل سرد المجلد ${folderId}: ${res.status} ${await res.text()}`);
    const data = await res.json();
    items.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return items;
}

async function collectFiles(rootId) {
  const files = [];
  const queue = [rootId];
  while (queue.length) {
    const folderId = queue.shift();
    const children = await listChildren(folderId);
    for (const item of children) {
      if (item.mimeType === "application/vnd.google-apps.folder") queue.push(item.id);
      else files.push(item);
    }
    console.log(`… تم مسح مجلد (${children.length} عنصر)، الملفات حتى الآن: ${files.length}`);
  }
  return files;
}

function alreadyPublic(file) {
  return (file.permissions || []).some((p) => p.type === "anyone");
}

async function makePublic(file) {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/permissions?supportsAllDrives=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }
  );
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

async function main() {
  console.log(DRY_RUN ? "وضع التجربة (لن يُعدَّل شيء)\n" : "وضع التنفيذ الفعلي\n");
  const files = await collectFiles(ROOT_FOLDER_ID);
  const todo = files.filter((f) => !alreadyPublic(f));
  console.log(`\nإجمالي الملفات: ${files.length} | عامة مسبقًا: ${files.length - todo.length} | تحتاج تعديل: ${todo.length}\n`);

  if (DRY_RUN) {
    todo.slice(0, 20).forEach((f) => console.log(" -", f.name));
    if (todo.length > 20) console.log(` … و ${todo.length - 20} ملفًا آخر`);
    return;
  }

  let done = 0;
  const failed = [];
  let index = 0;

  async function worker() {
    while (index < todo.length) {
      const file = todo[index++];
      try {
        await makePublic(file);
        done++;
        if (done % 25 === 0 || done === todo.length) console.log(`تم ${done}/${todo.length}`);
      } catch (err) {
        failed.push({ name: file.name, id: file.id, error: String(err.message || err) });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\nانتهى. نجح: ${done} | فشل: ${failed.length}`);
  if (failed.length) {
    console.log("الملفات التي فشلت:");
    failed.forEach((f) => console.log(` - ${f.name} (${f.id}): ${f.error.slice(0, 200)}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
