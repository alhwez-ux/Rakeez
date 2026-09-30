"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import AttendanceDashboard from "@/components/AttendanceDashboard";

function AttendancePageContent() {
  const params = useSearchParams();
  const [schoolId, setSchoolId] = useState(params.get("schoolId") ?? "haroon_alrasheed");
  const [classId, setClassId] = useState(params.get("classId") ?? "");
  const [activeClassId, setActiveClassId] = useState(params.get("classId") ?? "");

  const openClass = (event: React.FormEvent) => {
    event.preventDefault();
    setActiveClassId(classId.trim());
  };

  return (
    <main className="min-h-screen px-4 py-8" dir="rtl">
      <form
        onSubmit={openClass}
        className="max-w-4xl mx-auto bg-white/90 border border-white rounded-2xl shadow-lg shadow-rose-100/60 p-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">المدرسة</label>
          <select
            value={schoolId}
            onChange={(event) => setSchoolId(event.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800"
          >
            <option value="haroon_alrasheed">مدرسة هارون الرشيد الابتدائية</option>
            <option value="alarqam_school">مدرستي الأهلية (مثال)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">الفصل</label>
          <input
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            placeholder="مثال: 4أ"
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
        >
          عرض السجل
        </button>
      </form>

      {activeClassId ? (
        <AttendanceDashboard key={`${schoolId}-${activeClassId}`} schoolId={schoolId} classId={activeClassId} />
      ) : (
        <p className="max-w-4xl mx-auto mt-6 text-center text-sm text-slate-600">أدخل الفصل لعرض سجل الغياب.</p>
      )}
    </main>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-8 text-center text-slate-600">جاري التحميل...</main>}>
      <AttendancePageContent />
    </Suspense>
  );
}
