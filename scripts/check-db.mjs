import { readFileSync } from "node:fs";
import { deleteApp, initializeApp } from "firebase/app";
import { collection, doc, getDoc, getDocs, getFirestore, limit, query } from "firebase/firestore";

const KNOWN_SCHOOLS = ["haroon_alrasheed", "alarqam_school"];
const EXPECTED_COLLECTIONS = [
  "staff",
  "students",
  "timetables",
  "assignments",
  "attendance",
  "tasks_and_homework",
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function safeError(error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  const message = error instanceof Error ? error.message : "تعذر الاتصال بقاعدة البيانات";
  return {
    code,
    message: message.replace(/AIza[\w-]+/g, "[redacted]").slice(0, 240),
  };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`المتغير ${name} غير مضبوط`);
  return value;
}

async function main() {
  loadEnv(new URL("../.env.local", import.meta.url));
  const app = initializeApp({
    apiKey: requireEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: requireEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: requireEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: requireEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requireEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: requireEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
  });
  const db = getFirestore(app);
  const schools = [];

  for (const schoolId of KNOWN_SCHOOLS) {
    const info = await getDoc(doc(db, "schools", schoolId));
    const collections = {};
    for (const name of EXPECTED_COLLECTIONS) {
      const snap = await getDocs(query(collection(db, "schools", schoolId, name), limit(1)));
      collections[name] = { ok: true, hasRecords: !snap.empty };
    }
    schools.push({ schoolId, infoExists: info.exists(), collections });
  }

  console.log(JSON.stringify({ ok: true, checkedAt: new Date().toISOString(), schools }, null, 2));
  await deleteApp(app).catch(() => {});
  process.exit(0);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, ...safeError(error) }, null, 2));
  process.exit(1);
});
