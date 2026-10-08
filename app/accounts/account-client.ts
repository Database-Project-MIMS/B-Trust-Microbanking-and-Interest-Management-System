export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: { code: string; message: string };
}

const NETWORK_ERROR = { code: "NETWORK_ERROR", message: "Unable to reach the server. Check your connection and try again." };

/** Calls an MIMS API route and returns the status and either data or the API's safe error. Never throws on HTTP errors. */
export async function accountRequest<T>(url: string, options?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, { ...options, cache: "no-store", credentials: "same-origin" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
  let body: { data?: T; error?: { code?: string; message?: string } } = {};
  try { body = await response.json(); } catch { /* non-JSON response: fall through to the generic error */ }
  if (response.ok) return { ok: true, status: response.status, data: body.data as T };
  return {
    ok: false,
    status: response.status,
    error: { code: body.error?.code ?? "REQUEST_FAILED", message: body.error?.message ?? "The request failed. Please try again." },
  };
}

/** Reads the CSRF token the server issued at sign-in. */
export function csrfToken(): string {
  const value = document.cookie.split(";").map(cookie => cookie.trim()).find(cookie => cookie.startsWith("mims_csrf="));
  return value ? decodeURIComponent(value.slice("mims_csrf=".length)) : "";
}
