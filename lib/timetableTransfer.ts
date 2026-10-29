import { doc, getDocs, writeBatch } from "firebase/firestore";
import { resolveClassId, SUBJECT_SHORT } from "./classes";
import { parseCsv } from "./csv";
import { db } from "./firebase";
import { tRakeezSchoolRef } from "./rakeezSchool";

export interface TransferSlot {
  id: string;
  dayOfWeek: string;
  periodNumber: number;
  classId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
}

export interface ArchiveRecord {
  id: string;
  label: string;
  savedAt: string;
  slots: TransferSlot[];
}

const DAY_KEYS: Record<string, string> = {
  الأحد: "Sunday",
  الاحد: "Sunday",
  sunday: "Sunday",
  الإثنين: "Monday",
  الاثنين: "Monday",
  monday: "Monday",
  الثلاثاء: "Tuesday",
  tuesday: "Tuesday",
  الأربعاء: "Wednesday",
  الاربعاء: "Wednesday",
  wednesday: "Wednesday",
  الخميس: "Thursday",
  thursday: "Thursday",
};

function fullSubject(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (SUBJECT_SHORT[trimmed]) return trimmed;
  const match = Object.entries(SUBJECT_SHORT).find(([, short]) => short === trimmed);
  return match?.[0] ?? trimmed;
}

export function classIdFromToken(value: string) {
  return resolveClassId(value);
}

export function parseTimetableCsv(
  text: string,
  teachers: { id: string; fullName: string }[]
) {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error("الملف لا يحتوي صفوف جدول.");
  const headers = table[0].map((header) => header.trim());
  const index = (names: string[]) => headers.findIndex((header) => names.includes(header));
  const dayIndex = index(["اليوم", "day"]);
  const periodIndex = index(["الحصة", "period"]);
  const classIndex = index(["الفصل", "الصف", "class"]);
  const subjectIndex = index(["المادة", "subject"]);
  const teacherIndex = index(["المعلم", "teacher"]);
  if (dayIndex < 0 || periodIndex < 0 || classIndex < 0 || subjectIndex < 0 || teacherIndex < 0) {
    throw new Error("استخدم الأعمدة: اليوم، الحصة، الفصل، المادة، المعلم.");
  }

  const slots: TransferSlot[] = [];
  let skipped = 0;
  table.slice(1).forEach((row, rowIndex) => {
    const dayOfWeek = DAY_KEYS[(row[dayIndex] ?? "").trim().toLowerCase()] || DAY_KEYS[(row[dayIndex] ?? "").trim()];
    const periodNumber = Number(row[periodIndex]);
    const classId = classIdFromToken(row[classIndex] ?? "");
    const subjectName = fullSubject(row[subjectIndex] ?? "");
    const teacherName = (row[teacherIndex] ?? "").trim();
    if (!dayOfWeek || !periodNumber || !classId || !subjectName || !teacherName) {
      if (row.some((cell) => cell.trim())) skipped += 1;
      return;
    }
    const teacher = teachers.find((item) => item.fullName.trim() === teacherName);
    slots.push({
      id: `${dayOfWeek}_${periodNumber}_${classId}_row${rowIndex + 2}`,
      dayOfWeek,
      periodNumber,
      classId,
      subjectName,
      teacherId: teacher?.id ?? "",
      teacherName,
    });
  });
  return { slots, skipped };
}

function archiveSlots(data: unknown): TransferSlot[] {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    const slot = item as Partial<TransferSlot>;
    return {
      id: String(slot.id ?? ""),
      dayOfWeek: String(slot.dayOfWeek ?? ""),
      periodNumber: Number(slot.periodNumber ?? 0),
      classId: String(slot.classId ?? ""),
      subjectName: String(slot.subjectName ?? ""),
      teacherId: String(slot.teacherId ?? ""),
      teacherName: String(slot.teacherName ?? ""),
    };
  });
}

export async function listTimetableArchives(schoolId: string) {
  const { timetableArchiveRef } = tRakeezSchoolRef(schoolId);
  const snap = await getDocs(timetableArchiveRef);
  const records: ArchiveRecord[] = [];
  snap.forEach((item) => {
    const data = item.data();
    records.push({
      id: item.id,
      label: String(data.label ?? "جدول مؤرشف"),
      savedAt: String(data.savedAt ?? ""),
      slots: archiveSlots(data.slots),
    });
  });
  return records.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function saveTimetableArchive(schoolId: string, slots: TransferSlot[], label: string) {
  const { timetableArchiveRef } = tRakeezSchoolRef(schoolId);
  const archiveRef = doc(timetableArchiveRef);
  const savedAt = new Date().toISOString();
  const batch = writeBatch(db);
  batch.set(archiveRef, {
    label,
    savedAt,
    slots: slots.map((slot) => ({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      periodNumber: slot.periodNumber,
      classId: slot.classId,
      subjectName: slot.subjectName,
      teacherId: slot.teacherId,
      teacherName: slot.teacherName,
    })),
  });
  await batch.commit();
  return { id: archiveRef.id, label, savedAt, slots };
}

async function commitOps(ops: ((batch: ReturnType<typeof writeBatch>) => void)[]) {
  const size = 400;
  for (let index = 0; index < ops.length; index += size) {
    const batch = writeBatch(db);
    ops.slice(index, index + size).forEach((op) => op(batch));
    await batch.commit();
  }
}

export async function savePrimaryTimetable(schoolId: string, slots: TransferSlot[]) {
  const { timetablesRef } = tRakeezSchoolRef(schoolId);
  const existing = await getDocs(timetablesRef);
  const keep = new Set(slots.map((slot) => slot.id));
  const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
  existing.forEach((item) => {
    if (!keep.has(item.id)) ops.push((batch) => batch.delete(item.ref));
  });
  slots.forEach((slot) => {
    if (!slot.subjectName.trim() && !slot.teacherId) return;
    ops.push((batch) =>
      batch.set(doc(timetablesRef, slot.id), {
        dayOfWeek: slot.dayOfWeek,
        periodNumber: slot.periodNumber,
        classId: slot.classId,
        subjectName: slot.subjectName,
        teacherId: slot.teacherId,
      })
    );
  });
  await commitOps(ops);
}
