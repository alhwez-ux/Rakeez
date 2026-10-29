import { readFileSync } from "node:fs";
import { deleteApp, initializeApp } from "firebase/app";
import { collection, doc, getDocs, getFirestore, writeBatch } from "firebase/firestore";

const SCHOOL_ID = "haroon_alrasheed";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const SUBJECTS = {
  D: "الدراسات الإسلامية",
  L: "لغتي",
  P: "التربية البدنية",
  H: "المهارات الحياتية",
  F: "التربية الفنية",
  C: "العلوم",
  M: "الرياضيات",
  E: "اللغة الإنجليزية",
  A: "الدراسات الاجتماعية",
  R: "المهارات الرقمية",
};
const TEACHERS = [
  "عبدالله الشهراني",
  "علي ظافر",
  "سعد مبارك",
  "سعد السرحاني",
  "أحمد عسيري أبو سند",
  "علي علان القرني",
  "علي خلف",
  "علي مرعي",
  "فيصل القرني",
  "محمد شتوي",
  "محمد طه",
  "موسى يحيى",
  "وليد البسامي",
  "خالد المشهوري",
  "عبدالرحمن الأسمري",
  "فهد الروقي",
  "عبدالله المالكي",
  "عبدالعزيز الشغيبي",
  "محمد الفيفي",
  "زايد آل شرقه",
  "عبدالعزيز عسيري",
  "عبدالله الغامدي",
  "عايض فردان",
  "عبدالمجيد العمري",
  "حسن غرامه",
  "سلطان العمري",
  "محمد عيد",
  "علي الشهري أبو رياض",
  "عايض البقمي",
  "محمد آل عواض",
  "خالد دحمان",
  "عبدالله يعقوب",
  "عبدالله بن عيسى",
  "محمد البارقي",
  "رجا علي",
  "سلطان عايض",
];

function loadEnv(file) {
  const text = readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function classId(grade, section) {
  return `class_${grade}${section}`;
}

function parseCell(token) {
  const value = token.trim();
  if (!value) return null;
  const match = value.match(/^([A-Z])([1-6])([a-d])$/);
  if (!match) throw new Error(`خلية غير مفهومة: ${value}`);
  const subjectName = SUBJECTS[match[1]];
  if (!subjectName) throw new Error(`مادة غير معروفة: ${value}`);
  return { subjectName, classId: classId(match[2], match[3]) };
}

export function parseGrid(text) {
  const slots = [];
  const loads = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("|");
    const order = Number(parts[0]);
    if (!order || parts.length !== 6) throw new Error(`سطر المعلم ${parts[0]} غير مكتمل`);
    const teacherName = TEACHERS[order - 1];
    if (!teacherName) throw new Error(`لا يوجد معلم للرقم ${order}`);
    let count = 0;
    parts.slice(1).forEach((dayCells, dayIndex) => {
      const cells = dayCells.split(",");
      if (cells.length !== 7) throw new Error(`المعلم ${order} اليوم ${DAYS[dayIndex]} فيه ${cells.length} حصص`);
      cells.forEach((cell, periodIndex) => {
        const parsed = parseCell(cell);
        if (!parsed) return;
        count += 1;
        slots.push({
          scheduleOrder: order,
          teacherName,
          dayOfWeek: DAYS[dayIndex],
          periodNumber: periodIndex + 1,
          classId: parsed.classId,
          subjectName: parsed.subjectName,
        });
      });
    });
    loads.push({ order, teacherName, count });
  }
  return { slots, loads };
}

function conflicts(slots) {
  const byClass = new Map();
  const byTeacher = new Map();
  for (const slot of slots) {
    const classKey = `${slot.dayOfWeek}_${slot.periodNumber}_${slot.classId}`;
    const teacherKey = `${slot.teacherName}_${slot.dayOfWeek}_${slot.periodNumber}`;
    byClass.set(classKey, [...(byClass.get(classKey) ?? []), slot]);
    byTeacher.set(teacherKey, [...(byTeacher.get(teacherKey) ?? []), slot]);
  }
  return {
    classClashes: [...byClass.values()].filter((group) => group.length > 1),
    teacherClashes: [...byTeacher.values()].filter((group) => group.length > 1),
  };
}

async function commitInChunks(db, ops) {
  const size = 400;
  for (let index = 0; index < ops.length; index += size) {
    const batch = writeBatch(db);
    ops.slice(index, index + size).forEach((op) => op(batch));
    await batch.commit();
  }
}

async function main() {
  const grid = readFileSync(new URL("../data/haroon-grid.txt", import.meta.url), "utf8");
  const { slots, loads } = parseGrid(grid);
  const clash = conflicts(slots);
  const checkOnly = process.argv.includes("--check");
  const summary = {
    teachers: loads.length,
    slots: slots.length,
    classClashes: clash.classClashes.length,
    teacherClashes: clash.teacherClashes.length,
    loads: loads.map((item) => item.count),
  };
  if (checkOnly) {
    console.log(JSON.stringify(summary, null, 2));
    if (clash.classClashes.length || clash.teacherClashes.length) {
      const sample = [...clash.classClashes, ...clash.teacherClashes].slice(0, 8).map((group) =>
        group.map((slot) => `${slot.teacherName} ${slot.dayOfWeek} ${slot.periodNumber} ${slot.classId} ${slot.subjectName}`).join(" || ")
      );
      console.log(JSON.stringify({ sample }, null, 2));
    }
    return;
  }

  loadEnv(new URL("../.env.local", import.meta.url));
  const app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  const db = getFirestore(app);
  const staffRef = collection(db, "schools", SCHOOL_ID, "staff");
  const timetablesRef = collection(db, "schools", SCHOOL_ID, "timetables");
  const assignmentsRef = collection(db, "schools", SCHOOL_ID, "assignments");

  const staffSnap = await getDocs(staffRef);
  const byName = new Map();
  staffSnap.forEach((item) => {
    const data = item.data();
    if (String(data.role ?? "") === "teacher") byName.set(String(data.fullName ?? "").trim(), item.id);
  });

  const teacherIds = new Map();
  const staffOps = [];
  for (const load of loads) {
    const subjects = [...new Set(slots.filter((slot) => slot.scheduleOrder === load.order).map((slot) => slot.subjectName))];
    const existing = byName.get(load.teacherName);
    const id = existing || doc(staffRef).id;
    teacherIds.set(load.teacherName, id);
    const ref = doc(staffRef, id);
    staffOps.push((batch) =>
      batch.set(
        ref,
        { fullName: load.teacherName, role: "teacher", scheduleOrder: load.order, subjects },
        { merge: true }
      )
    );
  }

  const assignmentMap = new Map();
  for (const slot of slots) {
    const key = `${slot.teacherName}|${slot.classId}|${slot.subjectName}`;
    assignmentMap.set(key, (assignmentMap.get(key) ?? 0) + 1);
  }

  const oldTimetables = await getDocs(timetablesRef);
  const oldAssignments = await getDocs(assignmentsRef);
  const deleteOps = [];
  oldTimetables.forEach((item) => deleteOps.push((batch) => batch.delete(item.ref)));
  oldAssignments.forEach((item) => deleteOps.push((batch) => batch.delete(item.ref)));

  const writeOps = [];
  for (const slot of slots) {
    const id = `${slot.dayOfWeek}_${slot.periodNumber}_t${slot.scheduleOrder}`;
    writeOps.push((batch) =>
      batch.set(doc(timetablesRef, id), {
        dayOfWeek: slot.dayOfWeek,
        periodNumber: slot.periodNumber,
        classId: slot.classId,
        subjectName: slot.subjectName,
        teacherId: teacherIds.get(slot.teacherName),
      })
    );
  }
  for (const [key, weeklyPeriods] of assignmentMap) {
    const [teacherName, classIdValue, subjectName] = key.split("|");
    const ref = doc(assignmentsRef);
    writeOps.push((batch) =>
      batch.set(ref, {
        teacherId: teacherIds.get(teacherName),
        classId: classIdValue,
        subjectName,
        weeklyPeriods,
      })
    );
  }

  await commitInChunks(db, [...deleteOps, ...staffOps, ...writeOps]);
  console.log(
    JSON.stringify(
      {
        schoolId: SCHOOL_ID,
        teachers: loads.length,
        slots: slots.length,
        assignments: assignmentMap.size,
        deletedTimetableDocs: oldTimetables.size,
        deletedAssignmentDocs: oldAssignments.size,
        classClashes: clash.classClashes.length,
        teacherClashes: clash.teacherClashes.length,
      },
      null,
      2
    )
  );
  await deleteApp(app).catch(() => {});
}

const invoked = process.argv[1] && process.argv[1].includes("import-haroon-timetable");
if (invoked) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "فشل الاستيراد";
    console.error(message.replace(/AIza[\w-]+/g, "[redacted]"));
    process.exit(1);
  });
}
