"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RakeezDashboard from "@/components/RakeezDashboard";
import { readOwnerSession } from "@/lib/ownerAccount";

function DashboardContent() {
  const params = useSearchParams();
  const router = useRouter();
  const schoolId = params.get("schoolId") ?? "";
  const [ownerUsername, setOwnerUsername] = useState("");

  useEffect(() => {
    const sessionUser = readOwnerSession();
    if (!sessionUser) {
      router.replace("/");
      return;
    }
    setOwnerUsername(sessionUser);
  }, [router]);

  if (!ownerUsername) {
    return (
      <main className="min-h-screen grid place-items-center text-slate-600" dir="rtl">
        جاري التحقق من الدخول...
      </main>
    );
  }

  if (!schoolId) {
    return (
      <main className="min-h-screen grid place-items-center p-6" dir="rtl">
        <p className="text-slate-600 text-sm">اختر المدرسة من صفحة الدخول للوصول إلى لوحة التشغيل.</p>
      </main>
    );
  }

  return <RakeezDashboard schoolId={schoolId} currentUserId={ownerUsername} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="min-h-screen grid place-items-center text-slate-600">جاري التحميل...</main>}>
      <DashboardContent />
    </Suspense>
  );
}
