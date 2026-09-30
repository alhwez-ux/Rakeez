"use client";

import React, { useState, useEffect } from "react";
import { getDocs, query, where } from "firebase/firestore";
import { tRakeezSchoolRef } from "@/lib/rakeezSchool";
import { saveDailyAttendance } from "@/lib/attendance";
import { schoolToday } from "@/lib/schoolDate";

interface Student {
  id: string;
  studentName: string;
  parentPhone: string;
}

export default function AttendanceDashboard({ schoolId, classId }: { schoolId: string; classId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [absentList, setAbsentList] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const todayDate = schoolToday();

  useEffect(() => {
    async function fetchStudents() {
      try {
        setLoading(true);
        setErrorMsg("");
        const { studentsRef } = tRakeezSchoolRef(schoolId);
        const q = query(studentsRef, where("classId", "==", classId));
        const snapshot = await getDocs(q);

        const studentsData: Student[] = [];
        snapshot.forEach((studentDoc) => {
          studentsData.push({ id: studentDoc.id, ...studentDoc.data() } as Student);
        });

        setStudents(studentsData);
      } catch (error) {
        console.error("خطأ في جلب بيانات الطلاب:", error);
        setStudents([]);
        setErrorMsg("تعذر جلب الطلاب. تحقق من إعدادات Firebase واتصال الشبكة.");
      } finally {
        setLoading(false);
      }
    }

    if (schoolId && classId) {
      fetchStudents();
    }
  }, [schoolId, classId]);

  const toggleAttendance = (studentId: string) => {
    setAbsentList((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSaveAttendance = async () => {
    try {
      setSaving(true);
      setErrorMsg("");
      const result = await saveDailyAttendance({
        schoolId,
        classId,
        date: todayDate,
        absentStudents: absentList,
      });

      if (!result.success) {
        setErrorMsg("تعذر حفظ الغياب.");
        return;
      }

      setSuccessMsg("تم حفظ رصد الغياب بنجاح!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (error) {
      console.error("خطأ أثناء الحفظ:", error);
      setErrorMsg("تعذر حفظ الغياب.");
    } finally {
      setSaving(false);
    }
  };

  const sendWhatsAppAlert = (student: Student) => {
    const raw = (student.parentPhone || "").replace(/\D/g, "");
    if (!raw) return;
    const phone = raw.startsWith("0") ? `966${raw.slice(1)}` : raw;
    const message = `عزيزي ولي أمر الطالب (${student.studentName})، نود إفادتكم بتسجيل غياب ابنكم ليوم ${todayDate}. نسأل الله له السلامة.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-600">جاري تحميل قائمة الطلاب...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-2xl mt-6 border border-rose-100" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6 border-b border-slate-100 pb-4">
        <div>
          <h2 className="rk-title text-slate-800">سجل الغياب اليومي</h2>
          <p className="rk-lead text-slate-500">التاريخ: {todayDate} | الفصل: {classId}</p>
        </div>
        <button
          onClick={handleSaveAttendance}
          disabled={saving}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition shadow-md shadow-blue-600/20 disabled:bg-slate-400"
        >
          {saving ? "جاري الحفظ..." : "حفظ ورصد الغياب"}
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-center font-medium">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-xl text-center font-medium">
          {errorMsg}
        </div>
      )}

      <div className="space-y-3 md:hidden">
        {students.length === 0 ? (
          <p className="text-center p-6 text-slate-400">لا توجد بيانات طلاب مسجلة لهذا الفصل.</p>
        ) : (
          students.map((student) => {
            const isAbsent = absentList.includes(student.id);
            return (
              <div key={student.id} className="rounded-xl border border-slate-100 p-3 flex flex-col gap-3">
                <p className="font-medium text-slate-800">{student.studentName}</p>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAttendance(student.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                      isAbsent
                        ? "bg-rose-100 text-rose-700 border border-rose-300"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-300"
                    }`}
                  >
                    {isAbsent ? "غائب" : "حاضر"}
                  </button>
                  <button
                    type="button"
                    onClick={() => sendWhatsAppAlert(student)}
                    disabled={!isAbsent}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-40"
                  >
                    إرسال واتساب
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-rose-50/80 text-slate-800 border-b border-rose-100">
              <th className="p-3 font-semibold">اسم الطالب</th>
              <th className="p-3 text-center font-semibold">الحالة (اضغط للتغيير)</th>
              <th className="p-3 text-center font-semibold">إشعار فوري</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center p-6 text-slate-400">لا توجد بيانات طلاب مسجلة لهذا الفصل.</td>
              </tr>
            ) : (
              students.map((student) => {
                const isAbsent = absentList.includes(student.id);
                return (
                  <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="p-3 font-medium text-slate-800">{student.studentName}</td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleAttendance(student.id)}
                        className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${
                          isAbsent
                            ? "bg-rose-100 text-rose-700 border border-rose-300"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-300"
                        }`}
                      >
                        {isAbsent ? "غائب" : "حاضر"}
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => sendWhatsAppAlert(student)}
                        disabled={!isAbsent}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg transition disabled:opacity-40"
                      >
                        إرسال واتساب
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
