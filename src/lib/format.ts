export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAYS_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

export function hourLabel(h: number): string {
  if (h < 0) return "—";
  const ap = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ap}`;
}

export function hourRange(h: number): string {
  if (h < 0) return "—";
  return `${hourLabel(h)}–${hourLabel((h + 1) % 24)}`;
}
