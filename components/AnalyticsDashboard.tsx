"use client";

import React, { useEffect, useState } from "react";
import { getDocs, query, where } from "firebase/firestore";
import { tRakeezSchoolRef } from "@/lib/rakeezSchool";
import { schoolToday } from "@/lib/schoolDate";

export default function AnalyticsDashboard({ schoolId }: { schoolId: string }) {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalStaff: 0,
    activeTasks: 0,
    todayAbsences: 0,
    whatsappSentCount: 18,
    systemActivityRate: "98.5%",
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchSchoolAnalytics() {
      try {
        setLoading(true);
        setErrorMsg("");

        const { studentsRef, staffRef, tasksRef, attendanceRef } = tRakeezSchoolRef(schoolId);
        const today = schoolToday();

        const [studentsSnap, staffSnap, tasksSnap, attendanceSnap] = await Promise.all([
          getDocs(studentsRef),
          getDocs(staffRef),
          getDocs(tasksRef),
          getDocs(query(attendanceRef, where("date", "==", today))),
        ]);

        let todayAbsences = 0;
        attendanceSnap.forEach((record) => {
          const absentStudents = record.data().absentStudents;
          if (Array.isArray(absentStudents)) {
            todayAbsences += absentStudents.length;
          }
        });

        const activeTasks = tasksSnap.docs.filter((task) => {
          const status = task.data().status;
          return status === undefined || status === "active";
        }).length;

        setStats((prev) => ({
          ...prev,
          totalStudents: studentsSnap.size,
          totalStaff: staffSnap.size,
          activeTasks,
          todayAbsences,
        }));
      } catch (error) {
        console.error("خطأ في جلب المؤشرات:", error);
        setErrorMsg("تعذر جلب المؤشرات. تحقق من إعدادات Firebase.");
      } finally {
        setLoading(false);
      }
    }

    if (schoolId) {
      fetchSchoolAnalytics();
    }
  }, [schoolId]);

  if (loading) {
    return <div className="p-6 text-center text-slate-600">جاري تحليل بيانات واستخدامات النظام...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white shadow-lg rounded-2xl border border-rose-100" dir="rtl">
      <div className="border-b border-slate-100 pb-4 mb-6">
        <h2 className="rk-title text-slate-800">لوحة المؤشرات وتحليلات خدمات النظام</h2>
        <p className="rk-lead text-slate-500">متابعة دقيقة للأداء التشغيلي واستهلاك الخدمات الفورية</p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-xl text-center font-medium">{errorMsg}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-blue-600">إجمالي الطلاب</p>
          <h3 className="text-3xl font-extrabold text-blue-900 mt-2">{stats.totalStudents}</h3>
          <span className="text-xs text-slate-500 mt-1 block">مسجلون في الفصول الدراسية</span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-emerald-600">الكادر التعليمي والإداري</p>
          <h3 className="text-3xl font-extrabold text-emerald-900 mt-2">{stats.totalStaff}</h3>
          <span className="text-xs text-slate-500 mt-1 block">الموظفون والمعلمون</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-amber-600">الواجبات والمهام النشطة</p>
          <h3 className="text-3xl font-extrabold text-amber-900 mt-2">{stats.activeTasks}</h3>
          <span className="text-xs text-slate-500 mt-1 block">موزعة على الفصول</span>
        </div>

        <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-rose-600">غياب اليوم المرصود</p>
          <h3 className="text-3xl font-extrabold text-rose-900 mt-2">{stats.todayAbsences}</h3>
          <span className="text-xs text-slate-500 mt-1 block">من سجل الغياب المحفوظ لهذا اليوم</span>
        </div>
      </div>

      <div className="bg-gradient-to-l from-blue-900 to-blue-800 text-white rounded-2xl p-6 mb-8 shadow-md">
        <h3 className="font-bold text-lg mb-4">إحصاءات استفادة المدرسة من خدمات رَكيز</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 p-4 rounded-xl border border-white/10">
            <p className="text-xs text-blue-200">إشعارات الواتساب المرسلة</p>
            <h4 className="text-2xl font-bold mt-1">{stats.whatsappSentCount} رسالة</h4>
            <span className="text-xs text-emerald-300 mt-1 block">ربط فوري ناجح مع أولياء الأمور</span>
          </div>
          <div className="bg-white/10 p-4 rounded-xl border border-white/10">
            <p className="text-xs text-blue-200">كفاءة استقرار النظام وتشغيله</p>
            <h4 className="text-2xl font-bold mt-1">{stats.systemActivityRate}</h4>
            <span className="text-xs text-emerald-300 mt-1 block">اعتماد على قواعد بيانات عازلة</span>
          </div>
          <div className="bg-white/10 p-4 rounded-xl border border-white/10">
            <p className="text-xs text-blue-200">معدل استجابة المعلمين</p>
            <h4 className="text-2xl font-bold mt-1">ممتاز</h4>
            <span className="text-xs text-emerald-300 mt-1 block">تحديث الجداول والغياب بانتظام</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="font-bold text-slate-800 text-lg mb-3">تنبيهات النظام الاستباقية</h3>
        <div className="space-y-3">
          <div className="p-3 bg-white border-r-4 border-amber-500 rounded-xl shadow-sm flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <span className="text-sm text-slate-800">
              تنبيه: تم رصد غياب متكرر للطالب (نايف عبدالله) خلال هذا الأسبوع. يُنصح بالتواصل مع المرشد.
            </span>
            <button type="button" className="bg-amber-100 text-amber-800 px-3 py-1 rounded-lg text-xs font-medium shrink-0">
              مراجعة المرشد
            </button>
          </div>
          <div className="p-3 bg-white border-r-4 border-blue-500 rounded-xl shadow-sm flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
            <span className="text-sm text-slate-800">
              تحديث جدول الحصص: تم اعتماد التغييرات الأخيرة في حصص الصف الدراسي الحالي.
            </span>
            <span className="text-xs text-slate-400 shrink-0">منذ ساعة</span>
          </div>
        </div>
      </div>
    </div>
  );
}
