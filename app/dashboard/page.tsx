"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RakeezDashboard from "@/components/RakeezDashboard";

function DashboardContent() {
  const params = useSearchParams();
  const schoolId = params.get("schoolId") ?? "";
  const currentUserId = params.get("userId") ?? "";

  if (!schoolId) {
    return (
      <main className="min-h-screen grid place-items-center p-6" dir="rtl">
        <p className="text-slate-600 text-sm">اختر المدرسة من صفحة الدخول للوصول إلى لوحة التشغيل.</p>
      </main>
    );
  }

  return <RakeezDashboard schoolId={schoolId} currentUserId={currentUserId} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="min-h-screen grid place-items-center text-slate-600">جاري التحميل...</main>}>
      <DashboardContent />
    </Suspense>
  );
}
