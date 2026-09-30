"use client";

import React, { useEffect, useState } from "react";
import { doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { tRakeezSchoolRef } from "@/lib/rakeezSchool";

interface TimetableSlot {
  id: string;
  dayOfWeek: string;
  periodNumber: number;
  classId: string;
  subjectName: string;
  teacherId: string;
}

interface Teacher {
  id: string;
  fullName: string;
}

const DAYS = [
  { key: "Sunday", label: "الأحد" },
  { key: "Monday", label: "الإثنين" },
  { key: "Tuesday", label: "الثلاثاء" },
  { key: "Wednesday", label: "الأربعاء" },
  { key: "Thursday", label: "الخميس" },
];

const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export default function TimetableDashboard({ schoolId, classId }: { schoolId: string; classId: string }) {
  const [timetable, setTimetable] = useState<Record<string, TimetableSlot>>({});
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setErrorMsg("");

        const { staffRef, timetablesRef } = tRakeezSchoolRef(schoolId);
        const staffQuery = query(staffRef, where("role", "==", "teacher"));
        const staffSnapshot = await getDocs(staffQuery);
        const teachersData: Teacher[] = [];
        staffSnapshot.forEach((teacherDoc) => {
          teachersData.push({
            id: teacherDoc.id,
            fullName: String(teacherDoc.data().fullName ?? ""),
          });
        });
        setTeachers(teachersData);

        const timetableQuery = query(timetablesRef, where("classId", "==", classId));
        const timetableSnapshot = await getDocs(timetableQuery);
        const slotsMap: Record<string, TimetableSlot> = {};
        timetableSnapshot.forEach((slotDoc) => {
          const data = slotDoc.data() as Omit<TimetableSlot, "id">;
          const key = `${data.dayOfWeek}_${data.periodNumber}`;
          slotsMap[key] = { id: slotDoc.id, ...data };
        });
        setTimetable(slotsMap);
      } catch (error) {
        console.error("خطأ في جلب بيانات الجدول:", error);
        setErrorMsg("تعذر جلب جدول الحصص. تحقق من إعدادات Firebase.");
      } finally {
        setLoading(false);
      }
    }

    if (schoolId && classId) {
      fetchData();
    }
  }, [schoolId, classId]);

  const handleSlotChange = (day: string, period: number, field: "subjectName" | "teacherId", value: string) => {
    const key = `${day}_${period}`;
    setTimetable((prev) => ({
      ...prev,
      [key]: {
        id: prev[key]?.id || `${day}_${period}_${classId}`,
        dayOfWeek: day,
        periodNumber: period,
        classId,
        subjectName: field === "subjectName" ? value : prev[key]?.subjectName || "",
        teacherId: field === "teacherId" ? value : prev[key]?.teacherId || "",
      },
    }));
  };

  const handleSaveTimetable = async () => {
    try {
      setSaving(true);
      setErrorMsg("");
      const { timetablesRef } = tRakeezSchoolRef(schoolId);
      const promises = Object.values(timetable).map(async (slot) => {
        const docId = `${slot.dayOfWeek}_${slot.periodNumber}_${slot.classId}`;
        const slotRef = doc(timetablesRef, docId);
        await setDoc(
          slotRef,
          {
            dayOfWeek: slot.dayOfWeek,
            periodNumber: slot.periodNumber,
            classId: slot.classId,
            subjectName: slot.subjectName,
            teacherId: slot.teacherId,
          },
          { merge: true }
        );
      });

      await Promise.all(promises);
      setSuccessMsg("تم حفظ جدول الحصص بنجاح!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (error) {
      console.error("خطأ أثناء حفظ الجدول:", error);
      setErrorMsg("تعذر حفظ جدول الحصص.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-600">جاري تحميل جدول الحصص...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white shadow-lg rounded-2xl border border-rose-100" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">جدول الحصص المدرسية</h2>
          <p className="text-sm text-slate-500">الفصل الدراسي: {classId}</p>
        </div>
        <button
          type="button"
          onClick={handleSaveTimetable}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition shadow-md shadow-blue-600/20 disabled:bg-slate-400"
        >
          {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-center font-medium">{successMsg}</div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-xl text-center font-medium">{errorMsg}</div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse border border-slate-200 min-w-[880px]">
          <thead>
            <tr className="bg-rose-50/80 text-slate-800 border-b">
              <th className="p-3 border border-slate-200">اليوم / الحصة</th>
              {PERIODS.map((period) => (
                <th key={period} className="p-3 border border-slate-200 text-center">
                  الحصة {period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day.key} className="border-b hover:bg-slate-50 transition">
                <td className="p-3 border border-slate-200 font-bold text-slate-800 bg-slate-50">{day.label}</td>
                {PERIODS.map((period) => {
                  const key = `${day.key}_${period}`;
                  const currentSlot = timetable[key] || { subjectName: "", teacherId: "" };

                  return (
                    <td key={period} className="p-2 border border-slate-200 align-top">
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="اسم المادة"
                          value={currentSlot.subjectName}
                          onChange={(event) => handleSlotChange(day.key, period, "subjectName", event.target.value)}
                          className="w-full p-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <select
                          value={currentSlot.teacherId}
                          onChange={(event) => handleSlotChange(day.key, period, "teacherId", event.target.value)}
                          className="w-full p-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        >
                          <option value="">اختر المعلم</option>
                          {teachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.fullName || teacher.id}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
