import { doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { classLabel } from "./classes";
import { parseCsv, toCsv } from "./csv";
import { schoolToday, schoolWeekDates } from "./schoolDate";
import { tRakeezSchoolRef } from "./rakeezSchool";

export interface StudentInput {
  schoolId: string;
  studentName: string;
  parentPhone: string;
  classId: string;
}

export interface StaffInput {
  schoolId: string;
  fullName: string;
  role: "teacher" | "admin";
}

interface StudentRecord {
  id: string;
  studentName: string;
  parentPhone: string;
  classId: string;
}

interface StaffRecord {
  id: string;
  fullName: string;
  role: string;
}

const HEADER_FIELDS: Record<string, string> = {
  "اسم الطالب": "studentName",
  studentname: "studentName",
  "جوال ولي الأمر": "parentPhone",
  "جوال ولي الامر": "parentPhone",
  parentphone: "parentPhone",
  الفصل: "classId",
  classid: "classId",
  "اسم المعلم": "fullName",
  "اسم الموظف": "fullName",
  "اسم المعلم أو الإداري": "fullName",
  fullname: "fullName",
  الدور: "role",
  role: "role",
};

function headerKey(value: string) {
  const trimmed = value.replace(/^\uFEFF/, "").trim();
  return HEADER_FIELDS[trimmed] ?? HEADER_FIELDS[trimmed.toLowerCase()] ?? "";
}

function staffRole(value: string): "teacher" | "admin" {
  const normalized = value.trim();
  if (normalized === "admin" || normalized === "إداري" || normalized === "اداري") return "admin";
  return "teacher";
}

async function mapInChunks<T>(items: T[], size: number, task: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map((item) => task(item)));
  }
}

export async function addStudent(input: StudentInput) {
  const studentName = input.studentName.trim();
  const classId = input.classId.trim();
  if (!studentName) throw new Error("اكتب اسم الطالب.");
  if (!classId) throw new Error("اختر الفصل.");

  const { studentsRef } = tRakeezSchoolRef(input.schoolId);
  const studentRef = doc(studentsRef);
  await setDoc(studentRef, {
    studentName,
    parentPhone: input.parentPhone.trim(),
    classId,
  });
  return studentRef.id;
}

export async function listStaff(schoolId: string) {
  const { staffRef } = tRakeezSchoolRef(schoolId);
  const snap = await getDocs(staffRef);
  return snap.docs
    .map((item) => {
      const data = item.data();
      const subjects = Array.isArray(data.subjects) ? data.subjects.map((subject) => String(subject)) : [];
      return {
        id: item.id,
        fullName: String(data.fullName ?? ""),
        role: String(data.role ?? ""),
        scheduleOrder: Number(data.scheduleOrder ?? 0),
        subjects,
      };
    })
    .sort((a, b) => (a.scheduleOrder || 999) - (b.scheduleOrder || 999) || a.fullName.localeCompare(b.fullName, "ar"));
}

export async function addStaffMember(input: StaffInput) {
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("اكتب اسم المعلم أو الإداري.");

  const { staffRef } = tRakeezSchoolRef(input.schoolId);
  const staffDoc = doc(staffRef);
  await setDoc(staffDoc, {
    fullName,
    role: input.role,
  });
  return staffDoc.id;
}

export async function importSchoolCsv(schoolId: string, csvText: string) {
  const table = parseCsv(csvText);
  if (table.length < 2) throw new Error("الملف لا يحتوي صفوف بيانات.");

  const fields = table[0].map((header) => headerKey(header));
  if (!fields.some(Boolean)) {
    throw new Error("تعذر التعرف على أعمدة الملف. استخدم أعمدة اسم الطالب أو اسم المعلم.");
  }

  const { studentsRef, staffRef } = tRakeezSchoolRef(schoolId);
  const [studentSnap, staffSnap] = await Promise.all([getDocs(studentsRef), getDocs(staffRef)]);

  const students = new Map<string, string>();
  studentSnap.forEach((studentDoc) => {
    const data = studentDoc.data();
    students.set(`${String(data.classId ?? "")}::${String(data.studentName ?? "")}`, studentDoc.id);
  });

  const staff = new Map<string, string>();
  staffSnap.forEach((staffDoc) => {
    const data = staffDoc.data();
    staff.set(`${String(data.role ?? "")}::${String(data.fullName ?? "")}`, staffDoc.id);
  });

  const studentWrites: StudentRecord[] = [];
  const staffWrites: StaffRecord[] = [];
  let skipped = 0;

  table.slice(1).forEach((cells) => {
    const record: Record<string, string> = {};
    fields.forEach((field, index) => {
      if (field) record[field] = cells[index] ?? "";
    });

    if (record.studentName) {
      const studentName = record.studentName.trim();
      const classId = (record.classId || "").trim();
      if (!studentName || !classId) {
        skipped += 1;
        return;
      }
      const key = `${classId}::${studentName}`;
      const id = students.get(key) ?? doc(studentsRef).id;
      students.set(key, id);
      studentWrites.push({
        id,
        studentName,
        parentPhone: (record.parentPhone || "").trim(),
        classId,
      });
      return;
    }

    if (record.fullName) {
      const fullName = record.fullName.trim();
      if (!fullName) {
        skipped += 1;
        return;
      }
      const role = staffRole(record.role || "");
      const key = `${role}::${fullName}`;
      const id = staff.get(key) ?? doc(staffRef).id;
      staff.set(key, id);
      staffWrites.push({ id, fullName, role });
      return;
    }

    skipped += 1;
  });

  await mapInChunks(studentWrites, 20, async (student) => {
    await setDoc(
      doc(studentsRef, student.id),
      {
        studentName: student.studentName,
        parentPhone: student.parentPhone,
        classId: student.classId,
      },
      { merge: true }
    );
  });

  await mapInChunks(staffWrites, 20, async (member) => {
    await setDoc(
      doc(staffRef, member.id),
      {
        fullName: member.fullName,
        role: member.role,
      },
      { merge: true }
    );
  });

  return {
    students: studentWrites.length,
    staff: staffWrites.length,
    skipped,
  };
}

async function loadStudents(schoolId: string) {
  const { studentsRef } = tRakeezSchoolRef(schoolId);
  const snapshot = await getDocs(studentsRef);
  const students: StudentRecord[] = [];
  snapshot.forEach((studentDoc) => {
    const data = studentDoc.data();
    students.push({
      id: studentDoc.id,
      studentName: String(data.studentName ?? ""),
      parentPhone: String(data.parentPhone ?? ""),
      classId: String(data.classId ?? ""),
    });
  });
  return students;
}

export async function buildNoorCsv(schoolId: string) {
  const today = schoolToday();
  const { attendanceRef } = tRakeezSchoolRef(schoolId);
  const [students, attendanceSnap] = await Promise.all([
    loadStudents(schoolId),
    getDocs(query(attendanceRef, where("date", "==", today))),
  ]);

  const absent = new Set<string>();
  attendanceSnap.forEach((record) => {
    const ids = record.data().absentStudents;
    if (Array.isArray(ids)) ids.forEach((id) => absent.add(String(id)));
  });

  const rows = students.map((student) => [
    student.studentName,
    student.parentPhone,
    student.classId,
    classLabel(student.classId),
    today,
    absent.has(student.id) ? "غائب" : "حاضر",
  ]);

  return toCsv(["اسم الطالب", "جوال ولي الأمر", "معرف الفصل", "الفصل", "التاريخ", "الحالة"], rows);
}

export async function buildBackupJson(schoolId: string) {
  const refs = tRakeezSchoolRef(schoolId);
  const [staffSnap, studentsSnap, timetablesSnap, assignmentsSnap, attendanceSnap, tasksSnap] = await Promise.all([
    getDocs(refs.staffRef),
    getDocs(refs.studentsRef),
    getDocs(refs.timetablesRef),
    getDocs(refs.assignmentsRef),
    getDocs(refs.attendanceRef),
    getDocs(refs.tasksRef),
  ]);

  const rows = (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) =>
    snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

  return JSON.stringify(
    {
      schoolId,
      exportedAt: new Date().toISOString(),
      staff: rows(staffSnap),
      students: rows(studentsSnap),
      timetables: rows(timetablesSnap),
      assignments: rows(assignmentsSnap),
      attendance: rows(attendanceSnap),
      tasks_and_homework: rows(tasksSnap),
    },
    null,
    2
  );
}

export async function buildPrintReport(schoolId: string, reportType: "attendance" | "tasks" | "system") {
  const refs = tRakeezSchoolRef(schoolId);

  if (reportType === "attendance") {
    const week = new Set(schoolWeekDates());
    const [students, attendanceSnap] = await Promise.all([loadStudents(schoolId), getDocs(refs.attendanceRef)]);
    const names = new Map(students.map((student) => [student.id, student.studentName]));
    const rows: string[][] = [];

    attendanceSnap.forEach((record) => {
      const data = record.data();
      const date = String(data.date ?? "");
      if (!week.has(date)) return;
      const ids = Array.isArray(data.absentStudents) ? data.absentStudents.map(String) : [];
      if (ids.length === 0) {
        rows.push([date, classLabel(String(data.classId ?? "")), "لا يوجد غياب مرصود"]);
        return;
      }
      ids.forEach((id) => {
        rows.push([date, classLabel(String(data.classId ?? "")), names.get(id) || id]);
      });
    });

    rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1], "ar"));
    return {
      title: "تقرير غياب الأسبوع",
      headers: ["التاريخ", "الفصل", "الطالب الغائب"],
      rows,
    };
  }

  if (reportType === "tasks") {
    const snapshot = await getDocs(refs.tasksRef);
    const rows: string[][] = [];
    snapshot.forEach((taskDoc) => {
      const data = taskDoc.data();
      rows.push([
        String(data.title ?? ""),
        classLabel(String(data.targetClass ?? "")),
        String(data.dueDate ?? ""),
        data.status === "completed" ? "مكتمل" : "نشط",
      ]);
    });
    return {
      title: "ملخص إنجاز الواجبات",
      headers: ["الواجب", "الفصل", "موعد التسليم", "الحالة"],
      rows,
    };
  }

  const [studentsSnap, staffSnap, tasksSnap, attendanceSnap] = await Promise.all([
    getDocs(refs.studentsRef),
    getDocs(refs.staffRef),
    getDocs(refs.tasksRef),
    getDocs(refs.attendanceRef),
  ]);

  return {
    title: "تقرير استهلاك رَكيز",
    headers: ["البند", "العدد"],
    rows: [
      ["الطلاب", String(studentsSnap.size)],
      ["الكادر", String(staffSnap.size)],
      ["الواجبات", String(tasksSnap.size)],
      ["سجلات الغياب", String(attendanceSnap.size)],
    ],
  };
}
