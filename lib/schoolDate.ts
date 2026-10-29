/** تاريخ اليوم بتوقيت الدمام (Asia/Riyadh)، وليس بتوقيت UTC. */
export function schoolToday(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** أحد إلى خميس للأسبوع الذي يقع فيه تاريخ الدمام. */
export function schoolWeekDates(date = new Date()) {
  const [year, month, day] = schoolToday(date).split("-").map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  const weekday = calendar.getUTCDay();
  const sunday = new Date(calendar);
  sunday.setUTCDate(calendar.getUTCDate() - weekday);

  return Array.from({ length: 5 }, (_, index) => {
    const current = new Date(sunday);
    current.setUTCDate(sunday.getUTCDate() + index);
    return current.toISOString().slice(0, 10);
  });
}
