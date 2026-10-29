import { describeClassId } from "./classes";

export interface TimetableLesson {
  dayOfWeek: string;
  periodNumber: number;
  classId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
}

const SCHOOL_DAYS = new Set(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]);

function riyadhParts(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Riyadh",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return {
    weekday: parts.weekday ?? "",
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function seasonOf(month: number, day: number) {
  if (month === 8 && day >= 15) return "summer" as const;
  if (month === 9 || month === 10) return "summer" as const;
  if (month === 11 && day <= 7) return "summer" as const;
  return "winter" as const;
}

function periodWindows(grade: number, season: "summer" | "winter") {
  const breaks: Record<number, number> = grade <= 3 ? { 2: 20, 5: 15 } : { 3: 20, 5: 15 };
  let cursor = season === "summer" ? 7 * 60 : 7 * 60 + 30;
  const windows: Array<{ period: number; start: number; end: number }> = [];
  for (let period = 1; period <= 7; period += 1) {
    windows.push({ period, start: cursor, end: cursor + 45 });
    cursor += 45 + (breaks[period] ?? 0);
  }
  return windows;
}

export function currentPeriodForGrade(grade: number, date = new Date()) {
  if (grade < 1) return null;
  const clock = riyadhParts(date);
  if (!SCHOOL_DAYS.has(clock.weekday)) return null;
  const slot = periodWindows(grade, seasonOf(clock.month, clock.day)).find(
    (item) => clock.minutes >= item.start && clock.minutes < item.end
  );
  return slot?.period ?? null;
}

function gradeOfClass(classId: string) {
  return Number(describeClassId(classId)?.gradeId ?? 0);
}

export function teacherLessonsNow(
  teacher: { id: string; fullName: string },
  lessons: TimetableLesson[],
  date = new Date()
) {
  const clock = riyadhParts(date);
  const name = teacher.fullName.trim();
  return lessons.filter((lesson) => {
    if (lesson.dayOfWeek !== clock.weekday) return false;
    const sameTeacher =
      (teacher.id && lesson.teacherId === teacher.id) || (name && lesson.teacherName.trim() === name);
    if (!sameTeacher) return false;
    const grade = gradeOfClass(lesson.classId);
    return currentPeriodForGrade(grade, date) === lesson.periodNumber;
  });
}
