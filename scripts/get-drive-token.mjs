// يُشغَّل مرة واحدة على جهاز المؤسس للحصول على GOOGLE_OAUTH_REFRESH_TOKEN.
//   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... node scripts/get-drive-token.mjs
// ثم افتح الرابط الذي يظهر، سجّل الدخول بحساب المؤسس ووافق، وانسخ الرمز المطبوع.
import http from "http";
import { google } from "googleapis";

const id = process.env.GOOGLE_OAUTH_CLIENT_ID, secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
if (!id || !secret) { console.error("اضبط GOOGLE_OAUTH_CLIENT_ID و GOOGLE_OAUTH_CLIENT_SECRET أولًا"); process.exit(1); }

const redirect = "http://localhost:53682/callback";
const oauth = new google.auth.OAuth2(id, secret, redirect);
const url = oauth.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: ["https://www.googleapis.com/auth/drive"] });
console.log("\nافتح هذا الرابط بحساب المؤسس:\n\n" + url + "\n");

http.createServer(async (req, res) => {
  const u = new URL(req.url, redirect);
  if (u.pathname !== "/callback") { res.end(); return; }
  try {
    const { tokens } = await oauth.getToken(u.searchParams.get("code"));
    res.end("تم. ارجع إلى الطرفية.");
    console.log(tokens.refresh_token ? "\nGOOGLE_OAUTH_REFRESH_TOKEN=" + tokens.refresh_token + "\n" : "\nلم يصل refresh token. ألغِ وصول التطبيق من myaccount.google.com/permissions ثم أعد المحاولة.\n");
  } catch (e) { res.end("فشل"); console.error(e.message); }
  process.exit(0);
}).listen(53682);
