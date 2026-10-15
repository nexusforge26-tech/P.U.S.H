/**
 * استخراج معرّف فيديو YouTube المكوّن من 11 محرفًا بدقة وأمان.
 */
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

export function extractYoutubeId(input: string): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    const host = url.hostname.toLowerCase();
    if (!ALLOWED_YOUTUBE_HOSTS.has(host)) {
      return null;
    }

    if (host === "youtu.be" || host === "www.youtu.be") {
      const candidate = url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
      return YOUTUBE_ID_REGEX.test(candidate) ? candidate : null;
    }

    const vParam = url.searchParams.get("v");
    if (vParam) {
      return YOUTUBE_ID_REGEX.test(vParam) ? vParam : null;
    }

    const pathMatch = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})(?:\/|$)/);
    if (pathMatch?.[1] && YOUTUBE_ID_REGEX.test(pathMatch[1])) {
      return pathMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

export function youtubeThumb(youtubeId: string): string {
  return `https://img.youtube.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`;
}
