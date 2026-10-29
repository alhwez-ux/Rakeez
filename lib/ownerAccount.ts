import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const SESSION_KEY = "rakeez-owner-session";

export interface OwnerAccount {
  username: string;
  passwordHash: string;
  passwordSalt: string;
}

function ownerRef() {
  return doc(db, "system", "owner");
}

export async function hashPassword(password: string, salt: string) {
  const encoded = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hashesMatch(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function asOwner(data: Record<string, unknown> | undefined): OwnerAccount | null {
  if (!data) return null;
  const username = String(data.username ?? "").trim();
  const passwordHash = String(data.passwordHash ?? "");
  const passwordSalt = String(data.passwordSalt ?? "");
  if (!username || !passwordHash || !passwordSalt) return null;
  return { username, passwordHash, passwordSalt };
}

export async function getOwnerAccount() {
  const snapshot = await getDoc(ownerRef());
  if (!snapshot.exists()) return null;
  return asOwner(snapshot.data());
}

export async function verifyOwnerLogin(username: string, password: string) {
  const account = await getOwnerAccount();
  if (!account || !password) return false;
  if (account.username !== username.trim()) return false;
  const hash = await hashPassword(password, account.passwordSalt);
  return hashesMatch(hash, account.passwordHash);
}

export async function updateOwnerAccount(input: {
  currentPassword: string;
  username: string;
  newPassword?: string;
}) {
  const username = input.username.trim();
  const nextPassword = input.newPassword ?? "";
  if (!username) throw new Error("اكتب اسم المستخدم.");
  if (!input.currentPassword) throw new Error("أدخل كلمة المرور الحالية.");

  const account = await getOwnerAccount();
  if (!account) throw new Error("حساب المالك غير موجود. أعد تهيئة السجل ثم أعد المحاولة.");

  const currentHash = await hashPassword(input.currentPassword, account.passwordSalt);
  if (!hashesMatch(currentHash, account.passwordHash)) {
    throw new Error("كلمة المرور الحالية غير صحيحة.");
  }

  const passwordSalt = nextPassword ? crypto.randomUUID().replace(/-/g, "") : account.passwordSalt;
  const passwordHash = nextPassword ? await hashPassword(nextPassword, passwordSalt) : account.passwordHash;

  await setDoc(
    ownerRef(),
    {
      username,
      passwordHash,
      passwordSalt,
      role: "owner",
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return username;
}

export function saveOwnerSession(username: string) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: username.trim(), at: Date.now() }));
}

export function readOwnerSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { username?: string };
    const username = String(parsed.username ?? "").trim();
    return username || null;
  } catch {
    return null;
  }
}

export function clearOwnerSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
