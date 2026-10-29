import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

function readEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`المتغير ${name} غير مضبوط. أضفه في .env.local أو في إعدادات Vercel.`);
  }
  return value;
}

// الوصول يجب أن يكون بالاسم المباشر حتى يضمّن Next القيم في حزمة المتصفح.
// قاعدة Firestore تُنشأ في منطقة الدمام me-central2 من Firebase Console.
// عميل المتصفح يتصل بقاعدة المشروع الافتراضية ولا يحدد المنطقة بنفسه.
const firebaseConfig = {
  apiKey: readEnv("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: readEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: readEnv(
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  ),
  appId: readEnv("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
};

// التأكد من عدم تهيئة التطبيق أكثر من مرة لتفادي الأخطاء
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
