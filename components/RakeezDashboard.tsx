"use client";

import React, { useState } from "react";
import AnalyticsDashboard from "./AnalyticsDashboard";
import AttendanceDashboard from "./AttendanceDashboard";
import TimetableDashboard from "./TimetableDashboard";
import TasksDashboard from "./TasksDashboard";
import SettingsDashboard from "./SettingsDashboard";

const CLASS_OPTIONS = [
  { id: "class_3a", label: "الصف الثالث الابتدائي (أ)" },
  { id: "class_3b", label: "الصف الثالث الابتدائي (ب)" },
  { id: "class_4a", label: "الصف الرابع الابتدائي (أ)" },
];

export default function RakeezDashboard({ schoolId, currentUserId }: { schoolId: string; currentUserId: string }) {
  const [activeTab, setActiveTab] = useState<"analytics" | "attendance" | "timetable" | "tasks" | "settings">("analytics");
  const [selectedClass, setSelectedClass] = useState("class_3a");

  const tabClass = (tab: "analytics" | "attendance" | "timetable" | "tasks" | "settings") =>
    `py-3 px-4 sm:px-6 font-medium text-sm border-b-2 transition whitespace-nowrap ${
      activeTab === tab
        ? "border-blue-600 text-blue-700"
        : "border-transparent text-slate-600 hover:text-rose-500"
    }`;

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      <header className="bg-white/90 backdrop-blur border-b border-rose-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/rakeez-logo.jpg"
              alt="شعار نظام ركيز"
              width={1024}
              height={558}
              className="h-12 w-auto rounded-lg object-contain bg-[#f2ede7]"
            />
            <div>
              <h1 className="text-xl font-bold text-slate-800 leading-tight">رَكيز</h1>
              <p className="text-xs text-slate-500">المنظومة التشغيلية للمدارس</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">الفصل الحالي:</span>
            <select
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
              className="p-2 border border-slate-200 rounded-xl text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-400 font-medium text-slate-800"
            >
              {CLASS_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <nav className="bg-white/80 border-b border-rose-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-2 overflow-x-auto">
          <button type="button" onClick={() => setActiveTab("analytics")} className={tabClass("analytics")}>
            المؤشرات والتحليلات
          </button>
          <button type="button" onClick={() => setActiveTab("attendance")} className={tabClass("attendance")}>
            سجل الغياب اليومي
          </button>
          <button type="button" onClick={() => setActiveTab("timetable")} className={tabClass("timetable")}>
            جدول الحصص
          </button>
          <button type="button" onClick={() => setActiveTab("tasks")} className={tabClass("tasks")}>
            الواجبات ومتابعة المهام
          </button>
          <button type="button" onClick={() => setActiveTab("settings")} className={tabClass("settings")}>
            الإعدادات
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === "analytics" && <AnalyticsDashboard schoolId={schoolId} />}
        {activeTab === "attendance" && (
          <AttendanceDashboard key={`attendance-${selectedClass}`} schoolId={schoolId} classId={selectedClass} />
        )}
        {activeTab === "timetable" && (
          <TimetableDashboard key={`timetable-${selectedClass}`} schoolId={schoolId} classId={selectedClass} />
        )}
        {activeTab === "tasks" && <TasksDashboard schoolId={schoolId} currentUserId={currentUserId} />}
        {activeTab === "settings" && (
          <SettingsDashboard schoolId={schoolId} onOpenTimetable={() => setActiveTab("timetable")} />
        )}
      </main>

      <footer className="bg-white/80 border-t border-rose-100 py-4 text-center text-xs text-slate-500">
        جميع الحقوق محفوظة © {new Date().getFullYear()} - نظام رَكيز التشغيلي للمدارس
      </footer>
    </div>
  );
}
