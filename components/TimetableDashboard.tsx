"use client";

import React, { useEffect, useMemo, useState } from "react";
import { deleteDoc, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { tRakeezSchoolRef } from "@/lib/rakeezSchool";
import { CLASS_OPTIONS, DAYS, PERIODS, classLabel, dayLabel } from "@/lib/classes";

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

interface Assignment {
  id: string;
  teacherId: string;
  classId: string;
  subjectName: string;
  weeklyPeriods: number;
}

type ScheduleView = "assignments" | "general" | "class" | "teacher";

const VIEWS: { id: ScheduleView; label: string }[] = [
  { id: "assignments", label: "إسنادات المعلمين" },
  { id: "general", label: "الجدول العام" },
  { id: "class", label: "جدول الفصل" },
  { id: "teacher", label: "جدول المعلم" },
];

function slotKey(day: string, period: number, classId: string) {
  return `${day}_${period}_${classId}`;
}

export default function TimetableDashboard({ schoolId, classId }: { schoolId: string; classId: string }) {
  const [view, setView] = useState<ScheduleView>("assignments");
  const [slots, setSlots] = useState<Record<string, TimetableSlot>>({});
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [assignmentForm, setAssignmentForm] = useState({
    teacherId: "",
    classId,
    subjectName: "",
    weeklyPeriods: 4,
  });

  const teacherNameById = (id: string) => teachers.find((teacher) => teacher.id === id)?.fullName || id;

  const showStatus = (message: string, isError = false) => {
    if (isError) {
      setErrorMsg(message);
      setSuccessMsg("");
    } else {
      setSuccessMsg(message);
      setErrorMsg("");
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setErrorMsg("");
        const { staffRef, timetablesRef, assignmentsRef } = tRakeezSchoolRef(schoolId);

        const staffSnapshot = await getDocs(query(staffRef, where("role", "==", "teacher")));
        const teachersData: Teacher[] = [];
        staffSnapshot.forEach((teacherDoc) => {
          teachersData.push({
            id: teacherDoc.id,
            fullName: String(teacherDoc.data().fullName ?? ""),
          });
        });
        setTeachers(teachersData);
        setSelectedTeacherId((current) => current || teachersData[0]?.id || "");

        const timetableSnapshot = await getDocs(timetablesRef);
        const slotsMap: Record<string, TimetableSlot> = {};
        timetableSnapshot.forEach((slotDoc) => {
          const data = slotDoc.data() as Omit<TimetableSlot, "id">;
          slotsMap[slotKey(data.dayOfWeek, data.periodNumber, data.classId)] = { id: slotDoc.id, ...data };
        });
        setSlots(slotsMap);

        const assignmentSnapshot = await getDocs(assignmentsRef);
        const assignmentData: Assignment[] = [];
        assignmentSnapshot.forEach((assignmentDoc) => {
          const data = assignmentDoc.data();
          assignmentData.push({
            id: assignmentDoc.id,
            teacherId: String(data.teacherId ?? ""),
            classId: String(data.classId ?? ""),
            subjectName: String(data.subjectName ?? ""),
            weeklyPeriods: Number(data.weeklyPeriods ?? 0),
          });
        });
        setAssignments(assignmentData);
      } catch (error) {
        console.error("خطأ في جلب بيانات الجدول:", error);
        setErrorMsg("تعذر جلب الجداول والإسنادات. تحقق من إعدادات Firebase.");
      } finally {
        setLoading(false);
      }
    }

    if (schoolId) fetchData();
  }, [schoolId]);

  useEffect(() => {
    setAssignmentForm((current) => ({ ...current, classId }));
  }, [classId]);

  const classSlots = useMemo(
    () => Object.values(slots).filter((slot) => slot.classId === classId),
    [slots, classId]
  );

  const conflicts = useMemo(() => {
    const grouped = new Map<string, TimetableSlot[]>();
    Object.values(slots).forEach((slot) => {
      if (!slot.teacherId) return;
      const key = `${slot.teacherId}_${slot.dayOfWeek}_${slot.periodNumber}`;
      grouped.set(key, [...(grouped.get(key) ?? []), slot]);
    });
    return [...grouped.values()].filter((group) => group.length > 1);
  }, [slots]);

  const placedCount = (assignment: Assignment) =>
    Object.values(slots).filter(
      (slot) =>
        slot.teacherId === assignment.teacherId &&
        slot.classId === assignment.classId &&
        slot.subjectName.trim() === assignment.subjectName.trim()
    ).length;

  const handleSlotChange = (day: string, period: number, field: "subjectName" | "teacherId", value: string) => {
    const key = slotKey(day, period, classId);
    setSlots((prev) => ({
      ...prev,
      [key]: {
        id: prev[key]?.id || key,
        dayOfWeek: day,
        periodNumber: period,
        classId,
        subjectName: field === "subjectName" ? value : prev[key]?.subjectName || "",
        teacherId: field === "teacherId" ? value : prev[key]?.teacherId || "",
      },
    }));
  };

  const addTeacher = async () => {
    const fullName = teacherName.trim();
    if (!fullName) return;
    try {
      setSaving(true);
      const { staffRef } = tRakeezSchoolRef(schoolId);
      const teacherRef = doc(staffRef);
      await setDoc(teacherRef, { fullName, role: "teacher" });
      setTeachers((prev) => [...prev, { id: teacherRef.id, fullName }]);
      setTeacherName("");
      showStatus("تمت إضافة المعلم إلى كادر الإسناد.");
    } catch (error) {
      console.error(error);
      showStatus("تعذر إضافة المعلم.", true);
    } finally {
      setSaving(false);
    }
  };

  const addAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assignmentForm.teacherId || !assignmentForm.subjectName.trim()) {
      showStatus("اختر المعلم واسم المادة قبل حفظ الإسناد.", true);
      return;
    }
    try {
      setSaving(true);
      const { assignmentsRef } = tRakeezSchoolRef(schoolId);
      const assignmentRef = doc(assignmentsRef);
      const assignment: Assignment = {
        id: assignmentRef.id,
        teacherId: assignmentForm.teacherId,
        classId: assignmentForm.classId,
        subjectName: assignmentForm.subjectName.trim(),
        weeklyPeriods: Math.max(1, Number(assignmentForm.weeklyPeriods) || 1),
      };
      await setDoc(assignmentRef, {
        teacherId: assignment.teacherId,
        classId: assignment.classId,
        subjectName: assignment.subjectName,
        weeklyPeriods: assignment.weeklyPeriods,
      });
      setAssignments((prev) => [...prev, assignment]);
      setAssignmentForm((current) => ({ ...current, subjectName: "" }));
      showStatus("تم حفظ إسناد المعلم.");
    } catch (error) {
      console.error(error);
      showStatus("تعذر حفظ الإسناد.", true);
    } finally {
      setSaving(false);
    }
  };

  const removeAssignment = async (assignment: Assignment) => {
    try {
      const { assignmentsRef } = tRakeezSchoolRef(schoolId);
      await deleteDoc(doc(assignmentsRef, assignment.id));
      setAssignments((prev) => prev.filter((item) => item.id !== assignment.id));
    } catch (error) {
      console.error(error);
      showStatus("تعذر حذف الإسناد.", true);
    }
  };

  const handleSaveClassTimetable = async () => {
    const blocking = conflicts.filter((group) => group.some((slot) => slot.classId === classId));
    if (blocking.length > 0) {
      const first = blocking[0];
      showStatus(
        `تعارض إسناد: ${teacherNameById(first[0].teacherId)} مشغول في ${dayLabel(first[0].dayOfWeek)} الحصة ${first[0].periodNumber} لأكثر من فصل.`,
        true
      );
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");
      const { timetablesRef } = tRakeezSchoolRef(schoolId);
      await Promise.all(
        classSlots.map(async (slot) => {
          const docId = slotKey(slot.dayOfWeek, slot.periodNumber, slot.classId);
          const slotRef = doc(timetablesRef, docId);
          if (!slot.subjectName.trim() && !slot.teacherId) {
            await deleteDoc(slotRef);
            return;
          }
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
        })
      );
      showStatus("تم حفظ جدول الفصل ضمن الجدول العام.");
    } catch (error) {
      console.error("خطأ أثناء حفظ الجدول:", error);
      showStatus("تعذر حفظ جدول الفصل.", true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-600">جاري تحميل الجداول والإسنادات...</div>;
  }

  const teacherSlots = Object.values(slots).filter((slot) => slot.teacherId === selectedTeacherId);
  const classAssignments = assignments.filter((item) => item.classId === classId);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 bg-white shadow-lg rounded-2xl border border-rose-100" dir="rtl">
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center mb-5 border-b border-slate-100 pb-4">
        <div>
          <h2 className="rk-title text-slate-800">الجداول وإسنادات المعلمين</h2>
          <p className="rk-lead text-slate-500">بنفس تسلسل مسار: الإسناد، ثم الجدول العام، ثم جدول الفصل وجدول المعلم.</p>
        </div>
        {view === "class" && (
          <button
            type="button"
            onClick={handleSaveClassTimetable}
            disabled={saving}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-md shadow-blue-600/20 disabled:bg-slate-400"
          >
            {saving ? "جاري الحفظ..." : "حفظ جدول الفصل"}
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto mb-5">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium ${
              view === item.id ? "bg-blue-600 text-white" : "bg-rose-50 text-slate-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {successMsg && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-center font-medium">{successMsg}</div>}
      {errorMsg && <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-xl text-center font-medium">{errorMsg}</div>}

      {view === "assignments" && (
        <div className="space-y-6">
          <form onSubmit={(event) => event.preventDefault()} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">إضافة معلم للكادر</label>
              <input
                value={teacherName}
                onChange={(event) => setTeacherName(event.target.value)}
                placeholder="اسم المعلم"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <button type="button" onClick={addTeacher} disabled={saving} className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm">
              إضافة معلم
            </button>
          </form>

          <form onSubmit={addAssignment} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 xl:items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">المعلم</label>
              <select
                value={assignmentForm.teacherId}
                onChange={(event) => setAssignmentForm((current) => ({ ...current, teacherId: event.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                required
              >
                <option value="">اختر المعلم</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.fullName || teacher.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">الفصل</label>
              <select
                value={assignmentForm.classId}
                onChange={(event) => setAssignmentForm((current) => ({ ...current, classId: event.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
              >
                {CLASS_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">المادة</label>
              <input
                value={assignmentForm.subjectName}
                onChange={(event) => setAssignmentForm((current) => ({ ...current, subjectName: event.target.value }))}
                placeholder="مثال: رياضيات"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">حصص الأسبوع</label>
              <input
                type="number"
                min={1}
                max={35}
                value={assignmentForm.weeklyPeriods}
                onChange={(event) => setAssignmentForm((current) => ({ ...current, weeklyPeriods: Number(event.target.value) }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <button type="submit" disabled={saving} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm">
              حفظ الإسناد
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm border-collapse">
              <thead>
                <tr className="bg-rose-50/80 text-slate-800">
                  <th className="p-3 text-right">المعلم</th>
                  <th className="p-3 text-right">الفصل</th>
                  <th className="p-3 text-right">المادة</th>
                  <th className="p-3 text-center">المقرر</th>
                  <th className="p-3 text-center">الموزع</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      لا توجد إسنادات بعد.
                    </td>
                  </tr>
                ) : (
                  assignments.map((assignment) => {
                    const placed = placedCount(assignment);
                    return (
                      <tr key={assignment.id} className="border-t border-slate-100">
                        <td className="p-3">{teacherNameById(assignment.teacherId)}</td>
                        <td className="p-3">{classLabel(assignment.classId)}</td>
                        <td className="p-3">{assignment.subjectName}</td>
                        <td className="p-3 text-center">{assignment.weeklyPeriods}</td>
                        <td className={`p-3 text-center font-bold ${placed === assignment.weeklyPeriods ? "text-emerald-700" : "text-amber-700"}`}>
                          {placed}
                        </td>
                        <td className="p-3 text-left">
                          <button type="button" onClick={() => removeAssignment(assignment)} className="text-rose-700 text-xs">
                            حذف
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
      )}

      {view === "general" && (
        <div>
          <p className="text-xs text-slate-500 mb-3 md:hidden">اسحب الجدول أفقياً لعرض كل الفصول.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-xs border-collapse border border-slate-200">
              <thead>
                <tr className="bg-rose-50/80">
                  <th className="p-2 border border-slate-200">اليوم</th>
                  <th className="p-2 border border-slate-200">الحصة</th>
                  {CLASS_OPTIONS.map((item) => (
                    <th key={item.id} className="p-2 border border-slate-200">
                      {item.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.flatMap((day) =>
                  PERIODS.map((period) => (
                    <tr key={`${day.key}-${period}`}>
                      <td className="p-2 border border-slate-200 font-bold bg-slate-50">{day.label}</td>
                      <td className="p-2 border border-slate-200 text-center">{period}</td>
                      {CLASS_OPTIONS.map((item) => {
                        const slot = slots[slotKey(day.key, period, item.id)];
                        return (
                          <td key={item.id} className="p-2 border border-slate-200 align-top">
                            {slot?.subjectName ? (
                              <>
                                <div className="font-bold text-slate-800">{slot.subjectName}</div>
                                <div className="text-slate-500">{slot.teacherId ? teacherNameById(slot.teacherId) : "بدون معلم"}</div>
                              </>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "class" && (
        <div>
          <p className="text-sm text-slate-600 mb-3">
            جدول {classLabel(classId)}. المواد المسندة لهذا الفصل:{" "}
            {classAssignments.length === 0
              ? "لا يوجد إسناد بعد."
              : classAssignments.map((item) => `${item.subjectName} (${teacherNameById(item.teacherId)})`).join("، ")}
          </p>
          <p className="text-xs text-slate-500 mb-3 md:hidden">اسحب الجدول أفقياً لعرض كل الحصص.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-right border-collapse border border-slate-200">
              <thead>
                <tr className="bg-rose-50/80 text-slate-800">
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
                  <tr key={day.key}>
                    <td className="p-3 border border-slate-200 font-bold bg-slate-50">{day.label}</td>
                    {PERIODS.map((period) => {
                      const current = slots[slotKey(day.key, period, classId)] || { subjectName: "", teacherId: "" };
                      const conflict = conflicts.some((group) =>
                        group.some(
                          (slot) =>
                            slot.classId === classId && slot.dayOfWeek === day.key && slot.periodNumber === period
                        )
                      );
                      return (
                        <td key={period} className={`p-2 border border-slate-200 align-top ${conflict ? "bg-rose-50" : ""}`}>
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="المادة"
                              list={`subjects-${classId}`}
                              value={current.subjectName}
                              onChange={(event) => handleSlotChange(day.key, period, "subjectName", event.target.value)}
                              className="w-full p-1.5 text-xs border border-slate-200 rounded-lg"
                            />
                            <select
                              value={current.teacherId}
                              onChange={(event) => handleSlotChange(day.key, period, "teacherId", event.target.value)}
                              className="w-full p-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                            >
                              <option value="">المعلم</option>
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
            <datalist id={`subjects-${classId}`}>
              {classAssignments.map((item) => (
                <option key={item.id} value={item.subjectName} />
              ))}
            </datalist>
          </div>
        </div>
      )}

      {view === "teacher" && (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">المعلم</label>
          <select
            value={selectedTeacherId}
            onChange={(event) => setSelectedTeacherId(event.target.value)}
            className="w-full sm:max-w-xs mb-4 px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
          >
            <option value="">اختر المعلم</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName || teacher.id}
              </option>
            ))}
          </select>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs border-collapse border border-slate-200">
              <thead>
                <tr className="bg-rose-50/80">
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
                  <tr key={day.key}>
                    <td className="p-3 border border-slate-200 font-bold bg-slate-50">{day.label}</td>
                    {PERIODS.map((period) => {
                      const matches = teacherSlots.filter((slot) => slot.dayOfWeek === day.key && slot.periodNumber === period);
                      return (
                        <td key={period} className={`p-2 border border-slate-200 align-top ${matches.length > 1 ? "bg-rose-50" : ""}`}>
                          {matches.length === 0 ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            matches.map((slot) => (
                              <div key={slot.id} className="mb-1">
                                <div className="font-bold text-slate-800">{slot.subjectName || "بدون مادة"}</div>
                                <div className="text-slate-500">{classLabel(slot.classId)}</div>
                              </div>
                            ))
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
