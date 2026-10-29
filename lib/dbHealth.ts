import { collection, doc, getDoc, getDocs, limit, query } from "firebase/firestore";
import { db } from "./firebase";

export const KNOWN_SCHOOLS = ["haroon_alrasheed", "alarqam_school"] as const;

export const EXPECTED_COLLECTIONS = [
  "staff",
  "students",
  "timetables",
  "assignments",
  "attendance",
  "tasks_and_homework",
] as const;

export function publicDbError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "unknown";
  const message = error instanceof Error ? error.message : "تعذر الاتصال بقاعدة البيانات";
  return {
    code,
    message: message.replace(/AIza[\w-]+/g, "[redacted]").slice(0, 240),
  };
}

export async function checkDatabaseConnection() {
  const schools = [];

  for (const schoolId of KNOWN_SCHOOLS) {
    const info = await getDoc(doc(db, "schools", schoolId));
    const collections: Record<string, { ok: true; hasRecords: boolean }> = {};

    for (const name of EXPECTED_COLLECTIONS) {
      const snap = await getDocs(query(collection(db, "schools", schoolId, name), limit(1)));
      collections[name] = { ok: true, hasRecords: !snap.empty };
    }

    schools.push({
      schoolId,
      infoExists: info.exists(),
      collections,
    });
  }

  return {
    ok: true as const,
    checkedAt: new Date().toISOString(),
    schools,
  };
}
