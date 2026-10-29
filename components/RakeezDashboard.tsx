"use client";

import React, { useState } from "react";
import AnalyticsDashboard from "./AnalyticsDashboard";
import AttendanceDashboard from "./AttendanceDashboard";
import TimetableDashboard from "./TimetableDashboard";
import TasksDashboard from "./TasksDashboard";
import SettingsDashboard from "./SettingsDashboard";
import VoiceCallDashboard from "./VoiceCallDashboard";
import HealthStatusDashboard from "./HealthStatusDashboard";
import { SchoolClassesProvider, useSchoolClasses } from "./SchoolClassesProvider";
import { GRADES } from "@/lib/classes";

type DashboardTab = "analytics" | "attendance" | "timetable" | "tasks" | "call" | "health" | "settings";

export default function RakeezDashboard({ schoolId, currentUserId }: { schoolId: string; currentUserId: string }) {
  return (
    <SchoolClassesProvider schoolId={schoolId}>
      <RakeezDashboardView schoolId={schoolId} currentUserId={currentUserId} />
    </SchoolClassesProvider>
  );
}

function RakeezDashboardView({ schoolId, currentUserId }: { schoolId: string; currentUserId: string }) {
  const { options, addSection } = useSchoolClasses();
  const [activeTab, setActiveTab] = useState<DashboardTab>("analytics");
  const [selectedClass, setSelectedClass] = useState("class_3a");
  const [addOpen, setAddOpen] = useState(false);
  const [newGradeId, setNewGradeId] = useState("1");
  const [newSection, setNewSection] = useState("");
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const tabClass = (tab: DashboardTab) =>
    `py-3 px-4 sm:px-6 rk-lead font-medium border-b-2 transition whitespace-nowrap ${
      activeTab === tab
        ? "border-blue-600 text-blue-700"
        : "border-transparent text-slate-600 hover:text-blue-600"
    }`;

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      <header className="bg-white/90 backdrop-blur border-b rk-line shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/rakeez-logo.png"
              alt="شعار نظام ركيز"
              width={1024}
              height={558}
              className="h-11 w-auto rounded-lg object-contain bg-[#f2ede7]"
            />
            <div>
              <h1 className="rk-title text-slate-800 leading-tight">رَكيز</h1>
              <p className="rk-lead text-slate-500">المنظومة التشغيلية للمدارس</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full sm:w-auto">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="rk-lead font-medium text-slate-600">الفصل الحالي:</span>
              <select
                value={selectedClass}
                onChange={(event) => setSelectedClass(event.target.value)}
                className="w-full sm:w-auto p-2 border border-slate-200 rounded-xl text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-400 font-medium text-slate-800"
              >
                {options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setAddOpen((open) => !open);
                  setAddError("");
                }}
                className="px-3 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white"
              >
                إضافة فصل جديد
              </button>
            </div>
            {addOpen && (
              <form
                className="flex flex-col sm:flex-row gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  try {
                    setAddSaving(true);
                    setAddError("");
                    await addSection(newGradeId, newSection);
                    setNewSection("");
                    setAddOpen(false);
                  } catch (error) {
                    setAddError(error instanceof Error ? error.message : "تعذر إضافة الفصل.");
                  } finally {
                    setAddSaving(false);
                  }
                }}
              >
                <select
                  value={newGradeId}
                  onChange={(event) => setNewGradeId(event.target.value)}
                  className="p-2 border border-slate-200 rounded-xl text-sm bg-white"
                  aria-label="الصف"
                >
                  {GRADES.map((grade) => (
                    <option key={grade.id} value={grade.id}>
                      {grade.label}
                    </option>
                  ))}
                </select>
                <input
                  value={newSection}
                  onChange={(event) => setNewSection(event.target.value)}
                  placeholder="رمز الفصل، مثل هـ"
                  className="p-2 border border-slate-200 rounded-xl text-sm bg-white"
                  required
                />
                <button
                  type="submit"
                  disabled={addSaving}
                  className="px-3 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white disabled:opacity-60"
                >
                  {addSaving ? "جاري الحفظ..." : "حفظ الفصل"}
                </button>
              </form>
            )}
            {addError && <p className="text-sm text-rose-700">{addError}</p>}
          </div>
        </div>
      </header>

      <nav className="bg-white/80 border-b rk-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-2 overflow-x-auto">
          <button type="button" onClick={() => setActiveTab("analytics")} className={tabClass("analytics")}>
            المؤشرات والتحليلات
          </button>
          <button type="button" onClick={() => setActiveTab("attendance")} className={tabClass("attendance")}>
            سجل الغياب اليومي
          </button>
          <button type="button" onClick={() => setActiveTab("timetable")} className={tabClass("timetable")}>
            جدول الحصص والإسنادات
          </button>
          <button type="button" onClick={() => setActiveTab("tasks")} className={tabClass("tasks")}>
            الواجبات ومتابعة المهام
          </button>
          <button type="button" onClick={() => setActiveTab("call")} className={tabClass("call")}>
            النداء الصوتي
          </button>
          <button type="button" onClick={() => setActiveTab("health")} className={tabClass("health")}>
            الحالات الصحية
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
        {activeTab === "call" && <VoiceCallDashboard schoolId={schoolId} currentUserId={currentUserId} />}
        {activeTab === "health" && <HealthStatusDashboard schoolId={schoolId} currentUserId={currentUserId} />}
        {activeTab === "settings" && (
          <SettingsDashboard schoolId={schoolId} onOpenTimetable={() => setActiveTab("timetable")} />
        )}
      </main>

      <footer className="bg-white/80 border-t rk-line py-4 text-center rk-lead text-slate-500">
        جميع الحقوق محفوظة © {new Date().getFullYear()} - نظام رَكيز التشغيلي للمدارس
      </footer>
    </div>
  );
}
