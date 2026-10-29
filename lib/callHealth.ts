import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import type { TimetableLesson } from "./schoolBell";
import { classLabel, describeClassId, getClassOptions, gradeChoices, normalizeSectionLabel, sectionChoices } from "./classes";
import { db } from "./firebase";
import { tRakeezSchoolRef } from "./rakeezSchool";

export const OWNER_USERNAME = "1025774389";

export const CALL_ROLES = ["مدير", "وكيل", "مرشد", "معلم"] as const;
export type CallRole = (typeof CALL_ROLES)[number];

export function callGrades() {
  return gradeChoices();
}

export function sectionsForGrade(gradeId: string) {
  return sectionChoices(gradeId);
}

export interface HealthRecord {
  id: string;
  studentName: string;
  nationalId: string;
  gradeId: string;
  sectionId: string;
  classId: string;
  conditionTitle: string;
  parentPhone: string;
  studentId: string;
  sample: boolean;
}

export interface HealthRecordInput {
  studentName: string;
  nationalId: string;
  gradeId: string;
  sectionId: string;
  conditionTitle: string;
  parentPhone: string;
  studentId?: string;
  sample?: boolean;
}

export interface StaffCallProfile {
  id: string;
  fullName: string;
  role: string;
  callRole: CallRole;
  assignedClassIds: string[];
  phone: string;
}

export interface ClassAssignment {
  teacherId: string;
  teacherName: string;
  classId: string;
}

export interface StudentHint {
  id: string;
  studentName: string;
  parentPhone: string;
  classId: string;
  nationalId: string;
}

const UNRESTRICTED = new Set<CallRole>(["مدير", "وكيل", "مرشد"]);

export function sessionCallRole(username: string): CallRole {
  // الدخول الحالي حساب المالك فقط، ويُعامل كمدير ليظهر له النداء الصحي بلا شرط إسناد.
  if (username.trim() === OWNER_USERNAME) return "مدير";
  return "مدير";
}

export function isUnrestrictedRole(role: CallRole) {
  return UNRESTRICTED.has(role);
}

export function classKey(gradeId: string, sectionId: string) {
  return (
    getClassOptions().find((item) => item.gradeId === gradeId && (item.sectionKey === sectionId || item.sectionLabel === sectionId))?.id ??
    ""
  );
}

export function gradeLabel(gradeId: string) {
  return gradeChoices().find((grade) => grade.id === gradeId)?.label ?? gradeId;
}

export function sectionLabel(sectionId: string) {
  return (
    getClassOptions().find((item) => item.sectionKey === sectionId || item.sectionLabel === sectionId)?.sectionLabel ??
    normalizeSectionLabel(sectionId)
  );
}

export function gradeSectionLabel(gradeId: string, sectionId: string) {
  return `${gradeLabel(gradeId)} (${sectionLabel(sectionId)})`;
}

export function selectionFromClassId(classId: string) {
  const match = getClassOptions().find((item) => item.id === classId) ?? describeClassId(classId);
  if (!match) return null;
  return { gradeId: match.gradeId, sectionId: match.sectionKey };
}

export function recordClassKey(record: Pick<HealthRecord, "classId" | "gradeId" | "sectionId">) {
  if (record.classId) return record.classId;
  return classKey(record.gradeId, record.sectionId);
}

export function callPhrase(teacherName: string, gradeId: string, sectionId: string) {
  return `نداء للمعلم ${teacherName.trim()}، التوجه إلى ${gradeLabel(gradeId)} الفصل ${sectionLabel(sectionId)}.`;
}

/** يحوّل جوال المعلم إلى رابط اتصال مباشر. */
export function teacherTelHref(phone: string | null | undefined): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  let local = digits;
  if (local.startsWith("00966")) local = local.slice(5);
  else if (local.startsWith("966")) local = local.slice(3);
  if (local.startsWith("0")) local = local.slice(1);
  if (/^5\d{8}$/.test(local)) return `tel:+966${local}`;
  if (digits.length >= 9) return `tel:+${digits}`;
  return null;
}

export function normalizeCallRole(value: unknown, staffRole: unknown): CallRole {
  const text = String(value ?? "").trim();
  if (CALL_ROLES.includes(text as CallRole)) return text as CallRole;
  if (staffRole === "teacher" || staffRole === "معلم") return "معلم";
  if (staffRole === "admin" || staffRole === "إداري") return "وكيل";
  return "معلم";
}

export function teacherAssignedKeys(
  teacherId: string,
  staffAssigned: string[],
  assignments: ClassAssignment[],
  teacherName = ""
) {
  const keys = new Set<string>();
  const name = teacherName.trim();
  staffAssigned.forEach((classId) => {
    if (classId) keys.add(classId);
  });
  assignments.forEach((assignment) => {
    const sameId = Boolean(teacherId) && assignment.teacherId === teacherId;
    const sameName = Boolean(name) && assignment.teacherName.trim() === name;
    if ((sameId || sameName) && assignment.classId) keys.add(assignment.classId);
  });
  return [...keys];
}

export function primaryTeacherForClass(
  classId: string,
  assignments: ClassAssignment[],
  staff: StaffCallProfile[]
) {
  const counts = new Map<string, { id: string; name: string; count: number }>();
  assignments
    .filter((assignment) => assignment.classId === classId)
    .forEach((assignment) => {
      const member = staff.find((item) => item.id && item.id === assignment.teacherId);
      const name = member?.fullName || assignment.teacherName.trim();
      const key = assignment.teacherId || name;
      if (!key || !name) return;
      const previous = counts.get(key);
      counts.set(key, { id: assignment.teacherId, name, count: (previous?.count ?? 0) + 1 });
    });
  const best = [...counts.values()].sort((left, right) => right.count - left.count)[0];
  if (!best) return null;
  const member =
    staff.find((item) => item.id === best.id) ?? staff.find((item) => item.fullName.trim() === best.name);
  return { name: best.name, phone: member?.phone ?? "" };
}

function normalizeSpoken(input: string) {
  return input
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\u0621-\u064Aa-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const SPOKEN_GRADES: Record<string, string> = {
  اول: "1",
  اولي: "1",
  الاول: "1",
  واحد: "1",
  "1": "1",
  ثاني: "2",
  الثاني: "2",
  ثانيه: "2",
  اثنين: "2",
  "2": "2",
  ثالث: "3",
  الثالث: "3",
  ثالثه: "3",
  ثلاثه: "3",
  "3": "3",
  رابع: "4",
  الرابع: "4",
  رابعه: "4",
  "4": "4",
  خامس: "5",
  الخامس: "5",
  خامسه: "5",
  "5": "5",
  سادس: "6",
  السادس: "6",
  سادسه: "6",
  "6": "6",
};

const SPOKEN_SECTIONS: Record<string, string> = {
  ا: "أ",
  الف: "أ",
  a: "أ",
  "1": "أ",
  ب: "ب",
  باء: "ب",
  b: "ب",
  "2": "ب",
  ج: "ج",
  جيم: "ج",
  c: "ج",
  "3": "ج",
  د: "د",
  دال: "د",
  d: "د",
  "4": "د",
};

export function matchSpokenGradeSection(query: string) {
  const normalized = normalizeSpoken(query);
  if (!normalized) return null;
  const tokens = normalized.split(" ").filter(Boolean);
  let gradeId = "";
  let sectionLabel = "";
  tokens.forEach((token) => {
    const stripped = token.replace(/^ال/, "");
    if (!gradeId && SPOKEN_GRADES[stripped]) {
      gradeId = SPOKEN_GRADES[stripped];
      return;
    }
    if (!sectionLabel && SPOKEN_SECTIONS[stripped]) sectionLabel = SPOKEN_SECTIONS[stripped];
  });
  if (!gradeId || !sectionLabel) return null;
  const option = getClassOptions().find((item) => item.gradeId === gradeId && item.sectionLabel === sectionLabel);
  if (!option) return null;
  return { gradeId: option.gradeId, sectionId: option.sectionKey, classId: option.id, label: option.label };
}

export function matchSpokenTeacher(query: string, staff: StaffCallProfile[]) {
  const normalizedQuery = normalizeSpoken(query);
  if (!normalizedQuery) return null;
  const queryTokens = normalizedQuery.split(" ").filter((token) => token.length > 1);
  const ranked = staff
    .map((member) => {
      const normalizedName = normalizeSpoken(member.fullName);
      if (!normalizedName) return { member, score: 0 };
      const nameTokens = normalizedName.split(" ").filter((token) => token.length > 1);
      let score = 0;
      if (normalizedName === normalizedQuery) score = 100;
      else if (normalizedName.startsWith(normalizedQuery)) score = 92;
      else if (normalizedName.includes(normalizedQuery)) score = 84;
      else if (queryTokens.length > 0) {
        const hits = queryTokens.filter((token) =>
          nameTokens.some((nameToken) => nameToken === token || nameToken.includes(token) || token.includes(nameToken))
        ).length;
        score = Math.round((hits / queryTokens.length) * 78);
      }
      return { member, score };
    })
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  return best && best.score >= 70 ? best.member : null;
}

export interface HealthGrant {
  staffId: string;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export type CallNameVisibility = "all" | "assigned" | "none";

export interface HealthAccess {
  view: boolean;
  add: boolean;
  edit: boolean;
  remove: boolean;
  manageGrants: boolean;
  callNames: CallNameVisibility;
}

export function healthAccess(
  role: CallRole,
  grant?: Pick<HealthGrant, "canAdd" | "canEdit" | "canDelete"> | null
): HealthAccess {
  const canAdd = grant?.canAdd === true;
  const canEdit = grant?.canEdit === true;
  const canDelete = grant?.canDelete === true;
  if (role === "مدير") {
    return { view: true, add: true, edit: true, remove: true, manageGrants: true, callNames: "all" };
  }
  if (role === "وكيل") {
    return { view: true, add: canAdd, edit: canEdit, remove: canDelete, manageGrants: false, callNames: "all" };
  }
  if (role === "مرشد") {
    return { view: true, add: true, edit: true, remove: canDelete, manageGrants: false, callNames: "all" };
  }
  if (role === "معلم") {
    return {
      view: canAdd || canEdit || canDelete,
      add: canAdd,
      edit: canEdit,
      remove: canDelete,
      manageGrants: false,
      callNames: "assigned",
    };
  }
  return {
    view: canAdd || canEdit || canDelete,
    add: canAdd,
    edit: canEdit,
    remove: canDelete,
    manageGrants: false,
    callNames: "none",
  };
}

export function visibleHealthRecords(input: {
  records: HealthRecord[];
  gradeId: string;
  sectionId: string;
  callNames: CallNameVisibility;
  assignedKeys: string[];
}) {
  if (input.callNames === "none") return [];
  const key = classKey(input.gradeId, input.sectionId);
  const matching = input.records.filter((record) => recordClassKey(record) === key);
  if (input.callNames === "all") return matching;
  if (!input.assignedKeys.includes(key)) return [];
  return matching;
}

export function groupHealthRecords(records: HealthRecord[]) {
  const groups = new Map<string, HealthRecord[]>();
  records.forEach((record) => {
    const title = record.conditionTitle.trim() || "بدون عنوان";
    groups.set(title, [...(groups.get(title) ?? []), record]);
  });
  return [...groups.entries()]
    .sort((left, right) => left[0].localeCompare(right[0], "ar"))
    .map(([title, rows]) => ({
      title,
      rows: [...rows].sort((left, right) => left.studentName.localeCompare(right.studentName, "ar")),
    }));
}

function healthCollection(schoolId: string) {
  const id = schoolId.trim();
  if (!id || id.includes("/")) throw new Error("معرّف المدرسة غير صالح");
  return collection(db, "schools", id, "healthRecords");
}

function asHealthRecord(id: string, data: Record<string, unknown>): HealthRecord {
  return {
    id,
    studentName: String(data.studentName ?? "").trim(),
    nationalId: String(data.nationalId ?? "").trim(),
    gradeId: String(data.gradeId ?? "").trim(),
    sectionId: String(data.sectionId ?? "").trim(),
    classId: String(data.classId ?? "").trim(),
    conditionTitle: String(data.conditionTitle ?? "").trim(),
    parentPhone: String(data.parentPhone ?? "").trim(),
    studentId: String(data.studentId ?? "").trim(),
    sample: data.sample === true,
  };
}

export async function listHealthRecords(schoolId: string) {
  const snapshot = await getDocs(healthCollection(schoolId));
  const records: HealthRecord[] = [];
  snapshot.forEach((item) => {
    records.push(asHealthRecord(item.id, item.data()));
  });
  return records;
}

export async function saveHealthRecord(schoolId: string, input: HealthRecordInput, recordId?: string) {
  const studentName = input.studentName.trim();
  const nationalId = input.nationalId.trim();
  const conditionTitle = input.conditionTitle.trim();
  const parentPhone = input.parentPhone.trim();
  const gradeId = input.gradeId.trim();
  const sectionId = input.sectionId.trim();
  if (!studentName) throw new Error("اكتب اسم الطالب.");
  if (!nationalId) throw new Error("اكتب السجل المدني.");
  if (!gradeId || !sectionId) throw new Error("اختر الصف والفصل.");
  if (!conditionTitle) throw new Error("اكتب عنوان الحالة الصحية.");
  if (!parentPhone) throw new Error("اكتب جوال ولي الأمر.");

  const records = healthCollection(schoolId);
  const recordRef = recordId ? doc(records, recordId) : doc(records);
  const classId = classKey(gradeId, sectionId);
  const storedClassId = classId.includes(":") ? "" : classId;
  await setDoc(
    recordRef,
    {
      studentName,
      nationalId,
      gradeId,
      sectionId,
      classId: storedClassId,
      conditionTitle,
      parentPhone,
      studentId: (input.studentId ?? "").trim(),
      sample: input.sample === true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  return recordRef.id;
}

export async function deleteHealthRecord(schoolId: string, recordId: string) {
  await deleteDoc(doc(healthCollection(schoolId), recordId));
}

function grantsCollection(schoolId: string) {
  const id = schoolId.trim();
  if (!id || id.includes("/")) throw new Error("معرّف المدرسة غير صالح");
  return collection(db, "schools", id, "healthGrants");
}

export async function listHealthGrants(schoolId: string) {
  const snapshot = await getDocs(grantsCollection(schoolId));
  const grants: HealthGrant[] = [];
  snapshot.forEach((item) => {
    const data = item.data();
    grants.push({
      staffId: item.id,
      canAdd: data.canAdd === true,
      canEdit: data.canEdit === true,
      canDelete: data.canDelete === true,
    });
  });
  return grants;
}

export async function saveHealthGrant(schoolId: string, grant: HealthGrant) {
  await setDoc(doc(grantsCollection(schoolId), grant.staffId), {
    canAdd: grant.canAdd === true,
    canEdit: grant.canEdit === true,
    canDelete: grant.canDelete === true,
    updatedAt: new Date().toISOString(),
  });
}

export async function listStaffForCall(schoolId: string) {
  const { staffRef } = tRakeezSchoolRef(schoolId);
  const snapshot = await getDocs(staffRef);
  const staff: StaffCallProfile[] = [];
  snapshot.forEach((item) => {
    const data = item.data();
    const assigned = Array.isArray(data.assignedClassIds) ? data.assignedClassIds.map(String) : [];
    staff.push({
      id: item.id,
      fullName: String(data.fullName ?? "").trim(),
      role: String(data.role ?? ""),
      callRole: normalizeCallRole(data.callRole, data.role),
      assignedClassIds: assigned.filter(Boolean),
      phone: String(data.phone ?? data.mobile ?? "").trim(),
    });
  });
  staff.sort((left, right) => left.fullName.localeCompare(right.fullName, "ar"));
  return staff;
}

export async function saveStaffCallProfile(
  schoolId: string,
  staffId: string,
  input: { callRole: CallRole; assignedClassIds: string[]; phone: string }
) {
  const { staffRef } = tRakeezSchoolRef(schoolId);
  await setDoc(
    doc(staffRef, staffId),
    {
      callRole: input.callRole,
      assignedClassIds: [...new Set(input.assignedClassIds.filter(Boolean))],
      phone: input.phone.trim(),
    },
    { merge: true }
  );
}

export async function addCallTeacher(schoolId: string, fullName: string, callRole: CallRole = "معلم") {
  const name = fullName.trim();
  if (!name) throw new Error("اكتب اسم الموظف.");
  const { staffRef } = tRakeezSchoolRef(schoolId);
  const staffDoc = doc(staffRef);
  await setDoc(staffDoc, {
    fullName: name,
    role: callRole === "معلم" ? "teacher" : "admin",
    callRole,
    assignedClassIds: [],
  });
  return staffDoc.id;
}

export async function listTimetableLessons(schoolId: string) {
  const { timetablesRef } = tRakeezSchoolRef(schoolId);
  const snapshot = await getDocs(timetablesRef);
  const lessons: TimetableLesson[] = [];
  snapshot.forEach((item) => {
    const data = item.data();
    const periodNumber = Number(data.periodNumber ?? 0);
    const classId = String(data.classId ?? "").trim();
    const dayOfWeek = String(data.dayOfWeek ?? "").trim();
    if (!dayOfWeek || !periodNumber || !classId) return;
    lessons.push({
      dayOfWeek,
      periodNumber,
      classId,
      subjectName: String(data.subjectName ?? "").trim(),
      teacherId: String(data.teacherId ?? "").trim(),
      teacherName: String(data.teacherName ?? "").trim(),
    });
  });
  return lessons;
}

export async function listClassAssignments(schoolId: string) {
  const { assignmentsRef, timetablesRef } = tRakeezSchoolRef(schoolId);
  const [assignmentsSnap, timetableSnap] = await Promise.all([getDocs(assignmentsRef), getDocs(timetablesRef)]);
  const rows: ClassAssignment[] = [];
  assignmentsSnap.forEach((item) => {
    const data = item.data();
    rows.push({
      teacherId: String(data.teacherId ?? ""),
      teacherName: String(data.teacherName ?? data.fullName ?? "").trim(),
      classId: String(data.classId ?? ""),
    });
  });
  timetableSnap.forEach((item) => {
    const data = item.data();
    rows.push({
      teacherId: String(data.teacherId ?? ""),
      teacherName: String(data.teacherName ?? "").trim(),
      classId: String(data.classId ?? ""),
    });
  });
  return rows.filter((row) => row.classId && (row.teacherId || row.teacherName));
}

export async function listStudentHints(schoolId: string) {
  const { studentsRef } = tRakeezSchoolRef(schoolId);
  const snapshot = await getDocs(studentsRef);
  const students: StudentHint[] = [];
  snapshot.forEach((item) => {
    const data = item.data();
    students.push({
      id: item.id,
      studentName: String(data.studentName ?? "").trim(),
      parentPhone: String(data.parentPhone ?? "").trim(),
      classId: String(data.classId ?? "").trim(),
      nationalId: String(data.nationalId ?? data.civilId ?? "").trim(),
    });
  });
  students.sort((left, right) => left.studentName.localeCompare(right.studentName, "ar"));
  return students;
}

export function classOptionLabel(classId: string) {
  return classLabel(classId);
}

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function speakArabic(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    throw new Error("المتصفح لا يدعم النطق الصوتي.");
  }
  const synth = window.speechSynthesis;
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    utterance.rate = 0.92;
    const voice = synth.getVoices().find((item) => item.lang.toLowerCase().startsWith("ar"));
    if (voice) utterance.voice = voice;
    activeUtterance = utterance;
    synth.speak(utterance);
  };

  if (synth.getVoices().length > 0) {
    start();
    return;
  }

  const onVoices = () => {
    synth.removeEventListener("voiceschanged", onVoices);
    start();
  };
  synth.addEventListener("voiceschanged", onVoices);
  window.setTimeout(() => {
    synth.removeEventListener("voiceschanged", onVoices);
    start();
  }, 300);
}
