/** تاريخ اليوم بتوقيت الدمام (Asia/Riyadh)، وليس بتوقيت UTC. */
export function schoolToday(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
