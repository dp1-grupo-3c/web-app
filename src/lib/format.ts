const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" → Date local (sin desfase de zona horaria). */
export function parseISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export const addMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000);
export const addDays = (d: Date, days: number) => addMinutes(d, days * 1440);

/** dd/mm/aaaa */
export const formatDate = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
export const formatWeekdayDate = (d: Date) => `${WEEKDAYS[d.getDay()]} ${formatDate(d)}`;
export const formatTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** 2205 → "1 d 12:45" */
export const formatElapsed = (minutes: number) =>
  `${Math.floor(minutes / 1440)} d ${pad2(Math.floor((minutes % 1440) / 60))}:${pad2(minutes % 60)}`;

/** 902 → "15:02" */
export const formatClock = (seconds: number) => `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`;

/** 197 → "3:17 h" */
export const formatHours = (minutes: number) => `${Math.floor(minutes / 60)}:${pad2(Math.round(minutes % 60))} h`;

/** 170 → "2 h 50 min"; 42 → "42 min" */
export const formatDuration = (minutes: number) =>
  minutes >= 60 ? `${Math.floor(minutes / 60)} h ${pad2(minutes % 60)} min` : `${minutes} min`;

export const formatNumber = (n: number) => n.toLocaleString("en-US");
export const formatMoney = (n: number) =>
  `S/ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const formatPercent = (rate: number) => `${Math.round(rate * 100)} %`;
export const formatCoord = (c: { x: number; y: number }) => `(${c.x}, ${c.y})`;

/** Marca de simulación → "Día 4 · 14:20" y fecha absoluta "15/11/2026 a las 14:20". */
export function formatSimStamp(stamp: { day: number; time: string }, startDate: string) {
  const date = addDays(parseISODate(startDate), stamp.day - 1);
  return { day: `Día ${stamp.day} · ${stamp.time}`, date: `${formatDate(date)} a las ${stamp.time}` };
}
