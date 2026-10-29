import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { deleteApp, initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";

const FIREBASE_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

function loadPublicEnv(file) {
  const text = readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!FIREBASE_KEYS.includes(key) || process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`المتغير ${name} غير مضبوط`);
  return value;
}

function hashPassword(password, salt) {
  return createHash("sha256").update(`${salt}:${password}`, "utf8").digest("hex");
}

function safeError(error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  const message = error instanceof Error ? error.message : "تعذر تهيئة حساب المالك";
  return {
    code,
    message: message.replace(/AIza[\w-]+/g, "[redacted]").slice(0, 240),
  };
}

async function main() {
  loadPublicEnv(new URL("../.env.local", import.meta.url));
  const username = requireEnv("OWNER_USERNAME").trim();
  const password = requireEnv("OWNER_PASSWORD");
  if (!username || !password) throw new Error("اسم المستخدم وكلمة المرور مطلوبان في بيئة التشغيل");

  const app = initializeApp({
    apiKey: requireEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: requireEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: requireEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: requireEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requireEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: requireEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
  });
  const db = getFirestore(app);
  const ownerRef = doc(db, "system", "owner");
  const existing = await getDoc(ownerRef);

  if (existing.exists()) {
    const currentName = String(existing.data().username ?? "");
    console.log(JSON.stringify({ ok: true, action: "exists", username: currentName }, null, 2));
    await deleteApp(app).catch(() => {});
    process.exit(0);
  }

  const passwordSalt = randomBytes(16).toString("hex");
  await setDoc(ownerRef, {
    username,
    passwordHash: hashPassword(password, passwordSalt),
    passwordSalt,
    role: "owner",
    updatedAt: new Date().toISOString(),
  });

  console.log(JSON.stringify({ ok: true, action: "created", username }, null, 2));
  await deleteApp(app).catch(() => {});
  process.exit(0);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, ...safeError(error) }, null, 2));
  process.exit(1);
});
