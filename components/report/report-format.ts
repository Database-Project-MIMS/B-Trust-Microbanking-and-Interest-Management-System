/** Formats exact signed decimal strings without floating-point arithmetic. */
export function reportMoney(value: unknown): string {
  if (value === null || value === undefined || value === "UNRESOLVED") return "Unresolved";
  const text = String(value);
  if (!/^-?\d+(\.\d+)?$/.test(text)) return "—";
  const negative = text.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? text.slice(1) : text).split(".");
  return (negative ? "−" : "") + "LKR " + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + fraction.padEnd(2, "0").slice(0, 2);
}
