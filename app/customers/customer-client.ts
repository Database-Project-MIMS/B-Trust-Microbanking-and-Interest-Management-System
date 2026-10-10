export async function customerRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "Customer request failed. Please try again.");
  return body.data as T;
}

export function csrfToken(): string {
  const value = document.cookie.split(";").map(cookie => cookie.trim()).find(cookie => cookie.startsWith("mims_csrf="));
  return value ? decodeURIComponent(value.slice("mims_csrf=".length)) : "";
}

export function displayDate(value: Date | string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", day: "2-digit", month: "short", year: "numeric" }).format(new Date(String(value)));
}

export function displayMoney(value: string): string {
  const [whole = "0", cents = "00"] = value.split(".");
  return `LKR ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents.padEnd(2, "0")}`;
}
