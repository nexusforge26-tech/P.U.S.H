import { supabase } from "@/lib/supabase/client";

export async function getFreshAccessToken(): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  } catch {
    return "";
  }
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await getFreshAccessToken();
  const headers = new Headers(init.headers ?? {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, {
    ...init,
    headers,
  });
}
