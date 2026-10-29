"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { deleteDoc, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { tRakeezSchoolRef } from "@/lib/rakeezSchool";
import { DAYS, PERIODS, SUBJECT_SHORT, classLabel, classShort, dayLabel } from "@/lib/classes";
import { useSchoolClasses } from "./SchoolClassesProvider";
import {
  listTimetableArchives,
  parseTimetableCsv,
  savePrimaryTimetable,
  saveTimetableArchive,
  type ArchiveRecord,
  type TransferSlot,
} from "@/lib/timetableTransfer";

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
  scheduleOrder: number;
}

interface Assignment {
  id: string;
  teacherId: string;
  classId: string;
  subjectName: string;
  weeklyPeriods: number;
}

type ScheduleView = "assignments" | "general" | "class" | "teacher";

const ALL_CLASSES = "__all__";

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
  const { options } = useSchoolClasses();
  const [view, setView] = useState<ScheduleView>("general");
  const [slots, setSlots] = useState<Record<string, TimetableSlot>>({});
  const [allSlots, setAllSlots] = useState<TimetableSlot[]>([]);
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
    classId: ALL_CLASSES,
    subjectName: "",
    weeklyPeriods: 4,
  });
  const [printKind, setPrintKind] = useState<null | "blank" | "assignments" | "timetable">(null);
  const [archives, setArchives] = useState<ArchiveRecord[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [selectedArchiveId, setSelectedArchiveId] = useState("");
  const shouldPrint = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
            scheduleOrder: Number(teacherDoc.data().scheduleOrder ?? 0),
          });
        });
        teachersData.sort((a, b) => (a.scheduleOrder || 999) - (b.scheduleOrder || 999) || a.fullName.localeCompare(b.fullName, "ar"));
        setTeachers(teachersData);
        setSelectedTeacherId((current) => current || teachersData[0]?.id || "");

        const timetableSnapshot = await getDocs(timetablesRef);
        const slotsMap: Record<string, TimetableSlot> = {};
        const loaded: TimetableSlot[] = [];
        timetableSnapshot.forEach((slotDoc) => {
          const data = slotDoc.data() as Omit<TimetableSlot, "id">;
          const slot = { id: slotDoc.id, ...data };
          loaded.push(slot);
          const key = slotKey(data.dayOfWeek, data.periodNumber, data.classId);
          if (!slotsMap[key]) slotsMap[key] = slot;
        });
        setAllSlots(loaded);
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
    if (!printKind || !shouldPrint.current) return;
    shouldPrint.current = false;
    const timer = window.setTimeout(() => window.print(), 80);
    return () => window.clearTimeout(timer);
  }, [printKind]);

  const classSlots = useMemo(
    () => Object.values(slots).filter((slot) => slot.classId === classId),
    [slots, classId]
  );

  const scheduleTeachers = useMemo(
    () => teachers.filter((teacher) => teacher.scheduleOrder > 0).sort((a, b) => a.scheduleOrder - b.scheduleOrder),
    [teachers]
  );

  const conflicts = useMemo(() => {
    const grouped = new Map<string, TimetableSlot[]>();
    allSlots.forEach((slot) => {
      if (!slot.teacherId) return;
      const key = `${slot.teacherId}_${slot.dayOfWeek}_${slot.periodNumber}`;
      grouped.set(key, [...(grouped.get(key) ?? []), slot]);
    });
    return [...grouped.values()].filter((group) => group.length > 1);
  }, [allSlots]);

  const visibleAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      const classMatch =
        assignmentForm.classId === ALL_CLASSES || assignment.classId === assignmentForm.classId;
      const teacherMatch =
        !assignmentForm.teacherId || assignment.teacherId === assignmentForm.teacherId;
      return classMatch && teacherMatch;
    });
  }, [assignments, assignmentForm.classId, assignmentForm.teacherId]);

  const placedCount = (assignment: Assignment) =>
    allSlots.filter(
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
      setTeachers((prev) => [...prev, { id: teacherRef.id, fullName, scheduleOrder: 0 }]);
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
    if (!assignmentForm.classId || assignmentForm.classId === ALL_CLASSES) {
      showStatus("اختر الفصل قبل حفظ الإسناد.", true);
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

  const toTransfer = (source: TimetableSlot[]): TransferSlot[] =>
    source
      .filter((slot) => slot.subjectName.trim() || slot.teacherId)
      .map((slot) => ({
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        periodNumber: slot.periodNumber,
        classId: slot.classId,
        subjectName: slot.subjectName,
        teacherId: slot.teacherId,
        teacherName: teacherNameById(slot.teacherId),
      }));

  const applySlots = (next: TimetableSlot[]) => {
    const map: Record<string, TimetableSlot> = {};
    next.forEach((slot) => {
      const key = slotKey(slot.dayOfWeek, slot.periodNumber, slot.classId);
      if (!map[key]) map[key] = slot;
    });
    setAllSlots(next);
    setSlots(map);
  };

  const openPrint = (kind: "blank" | "assignments" | "timetable") => {
    shouldPrint.current = true;
    setPrintKind(kind);
  };

  const openArchive = async () => {
    try {
      setSaving(true);
      const records = await listTimetableArchives(schoolId);
      setArchives(records);
      setSelectedArchiveId(records[0]?.id ?? "");
      setArchiveOpen(true);
      if (records.length === 0) showStatus("لا توجد جداول محفوظة في الأرشيف بعد.");
    } catch (error) {
      console.error(error);
      showStatus("تعذر قراءة أرشيف الجداول.", true);
    } finally {
      setSaving(false);
    }
  };

  const loadArchive = () => {
    const record = archives.find((item) => item.id === selectedArchiveId);
    if (!record) {
      showStatus("اختر جدولاً من الأرشيف.", true);
      return;
    }
    const next = record.slots
      .map((slot) => {
        const teacher =
          teachers.find((item) => item.id === slot.teacherId) ||
          teachers.find((item) => item.fullName.trim() === slot.teacherName.trim());
        if (!teacher) return null;
        return {
          id: slot.id || `${slot.dayOfWeek}_${slot.periodNumber}_${teacher.id}`,
          dayOfWeek: slot.dayOfWeek,
          periodNumber: slot.periodNumber,
          classId: slot.classId,
          subjectName: slot.subjectName,
          teacherId: teacher.id,
        };
      })
      .filter((slot): slot is TimetableSlot => Boolean(slot));
    applySlots(next);
    setArchiveOpen(false);
    showStatus("تم تحميل الجدول من الأرشيف دون حذف النسخة المؤرشفة. احفظه كأساسي لاعتماده.");
  };

  const saveArchiveCopy = async () => {
    try {
      setSaving(true);
      const saved = await saveTimetableArchive(schoolId, toTransfer(allSlots), "الجدول العام");
      setArchives((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSelectedArchiveId(saved.id);
      showStatus("تم حفظ نسخة من الجدول في الأرشيف دون استبدال الجدول الأساسي.");
    } catch (error) {
      console.error(error);
      showStatus("تعذر الحفظ في الأرشيف.", true);
    } finally {
      setSaving(false);
    }
  };

  const saveAsPrimary = async () => {
    try {
      setSaving(true);
      await savePrimaryTimetable(schoolId, toTransfer(allSlots));
      showStatus("تم حفظ الجدول كجدول أساسي.");
    } catch (error) {
      console.error(error);
      showStatus("تعذر حفظ الجدول الأساسي.", true);
    } finally {
      setSaving(false);
    }
  };

  const importTimetableFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setSaving(true);
      const text = await file.text();
      const parsed = parseTimetableCsv(text, teachers);
      const known = [...teachers];
      const next = [...allSlots];
      for (const slot of parsed.slots) {
        let teacher = known.find((item) => item.fullName.trim() === slot.teacherName.trim());
        if (!teacher) {
          const { staffRef } = tRakeezSchoolRef(schoolId);
          const teacherRef = doc(staffRef);
          await setDoc(teacherRef, { fullName: slot.teacherName, role: "teacher", scheduleOrder: 0, subjects: [slot.subjectName] });
          teacher = { id: teacherRef.id, fullName: slot.teacherName, scheduleOrder: 0 };
          known.push(teacher);
        }
        const kept = next.filter(
          (item) =>
            !(item.dayOfWeek === slot.dayOfWeek && item.periodNumber === slot.periodNumber && item.teacherId === teacher.id) &&
            !(item.dayOfWeek === slot.dayOfWeek && item.periodNumber === slot.periodNumber && item.classId === slot.classId)
        );
        next.length = 0;
        next.push(...kept, {
          id: `${slot.dayOfWeek}_${slot.periodNumber}_${teacher.id}`,
          dayOfWeek: slot.dayOfWeek,
          periodNumber: slot.periodNumber,
          classId: slot.classId,
          subjectName: slot.subjectName,
          teacherId: teacher.id,
        });
      }
      setTeachers(known);
      applySlots(next);
      showStatus(`تم تحميل ${parsed.slots.length} حصة من الملف. تم تجاوز ${parsed.skipped} صف.`);
    } catch (error) {
      console.error(error);
      showStatus(error instanceof Error ? error.message : "تعذر استيراد الملف.", true);
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-600">جاري تحميل الجداول والإسنادات...</div>;
  }

  const teacherSlots = allSlots.filter((slot) => slot.teacherId === selectedTeacherId);
  const generalTeachers = scheduleTeachers.length > 0 ? scheduleTeachers : [...teachers].sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"));
  const classAssignments = assignments.filter((item) => item.classId === classId);

  const blankRows = Array.from({ length: 18 }, (_, index) => index);
  const buttonClass = "px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-800 hover:bg-rose-50 disabled:opacity-60";

  return (
    <div dir="rtl">
      {printKind && (
        <section className={`print-sheet p-4 ${printKind === "timetable" ? "print-timetable" : ""}`}>
          <h2 className="rk-title text-slate-800 mb-1">
            {printKind === "blank" ? "كشف إسناد مفرغ" : printKind === "assignments" ? "بيانات الإسناد" : "الجدول المدرسي العام"}
          </h2>
          <p className="text-sm text-slate-600 mb-3">مدرسة هارون الرشيد الابتدائية — نظام مسار — عام 1448/1449 هـ</p>
          {printKind === "timetable" ? (
            <table className="w-full text-[8px] border-collapse border border-slate-400">
              <thead>
                <tr>
                  <th className="border border-slate-400 p-1">م</th>
                  <th className="border border-slate-400 p-1">المعلم</th>
                  {DAYS.map((day) => (
                    <th key={day.key} className="border border-slate-400 p-1 text-center" colSpan={7}>
                      {day.label}
                    </th>
                  ))}
                  <th className="border border-slate-400 p-1">المجموع</th>
                </tr>
                <tr>
                  <th className="border border-slate-400"></th>
                  <th className="border border-slate-400"></th>
                  {DAYS.flatMap((day) =>
                    PERIODS.map((period) => (
                      <th key={`${day.key}-${period}`} className="border border-slate-400 text-center">
                        {period}
                      </th>
                    ))
                  )}
                  <th className="border border-slate-400"></th>
                </tr>
              </thead>
              <tbody>
                {generalTeachers.map((teacher) => {
                  const own = allSlots.filter((slot) => slot.teacherId === teacher.id);
                  return (
                    <tr key={teacher.id}>
                      <td className="border border-slate-400 text-center">{teacher.scheduleOrder || ""}</td>
                      <td className="border border-slate-400 whitespace-nowrap">{teacher.fullName}</td>
                      {DAYS.flatMap((day) =>
                        PERIODS.map((period) => {
                          const slot = own.find((item) => item.dayOfWeek === day.key && item.periodNumber === period);
                          return (
                            <td key={`${day.key}-${period}`} className="border border-slate-400 text-center">
                              {slot ? `${SUBJECT_SHORT[slot.subjectName] || slot.subjectName} ${classShort(slot.classId)}` : ""}
                            </td>
                          );
                        })
                      )}
                      <td className="border border-slate-400 text-center">{own.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {["المعلم", "الفصل", "المادة", "حصص الأسبوع"].map((header) => (
                    <th key={header} className="border border-slate-400 p-2 text-right">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {printKind === "blank"
                  ? blankRows.map((row) => (
                      <tr key={row} className="h-10">
                        <td className="border border-slate-400"></td>
                        <td className="border border-slate-400"></td>
                        <td className="border border-slate-400"></td>
                        <td className="border border-slate-400"></td>
                      </tr>
                    ))
                  : visibleAssignments.map((assignment) => (
                      <tr key={assignment.id}>
                        <td className="border border-slate-400 p-2">{teacherNameById(assignment.teacherId)}</td>
                        <td className="border border-slate-400 p-2">{classLabel(assignment.classId)}</td>
                        <td className="border border-slate-400 p-2">{assignment.subjectName}</td>
                        <td className="border border-slate-400 p-2 text-center">{assignment.weeklyPeriods}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    <div className="no-print max-w-[96rem] mx-auto p-4 sm:p-6 bg-white shadow-lg rounded-2xl border border-rose-100">
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
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openPrint("blank")} className={buttonClass}>
              طباعة كشف مفرغ
            </button>
            <button type="button" onClick={() => openPrint("assignments")} className={buttonClass}>
              طباعة بيانات الإسناد
            </button>
          </div>

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
                <option value={ALL_CLASSES}>جميع الفصول</option>
                {options.map((item) => (
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
                {visibleAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      لا توجد إسنادات بعد.
                    </td>
                  </tr>
                ) : (
                  visibleAssignments.map((assignment) => {
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
          <div className="flex flex-wrap gap-2 mb-4">
            <button type="button" onClick={openArchive} disabled={saving} className={buttonClass}>
              استيراد جدول من الأرشيف
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={saving} className={buttonClass}>
              استيراد جدول من ملف
            </button>
            <button type="button" onClick={saveArchiveCopy} disabled={saving} className={buttonClass}>
              حفظ في الأرشيف
            </button>
            <button type="button" onClick={saveAsPrimary} disabled={saving} className="px-3 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white disabled:opacity-60">
              حفظ كأساسي
            </button>
            <button type="button" onClick={() => openPrint("timetable")} className={buttonClass}>
              طباعة
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => importTimetableFile(event.target.files?.[0])}
            />
          </div>
          {archiveOpen && (
            <div className="mb-4 p-3 rounded-xl border border-rose-100 bg-rose-50/50 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex-1 text-xs font-semibold text-slate-700">
                الجداول المؤرشفة
                <select
                  value={selectedArchiveId}
                  onChange={(event) => setSelectedArchiveId(event.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                >
                  {archives.length === 0 ? (
                    <option value="">لا توجد نسخ</option>
                  ) : (
                    archives.map((record) => (
                      <option key={record.id} value={record.id}>
                        {record.label} — {record.savedAt ? new Date(record.savedAt).toLocaleString("ar-SA") : "بدون تاريخ"} — {record.slots.length} حصة
                      </option>
                    ))
                  )}
                </select>
              </label>
              <button type="button" onClick={loadArchive} disabled={!selectedArchiveId} className="px-3 py-2 rounded-xl text-sm bg-slate-800 text-white disabled:opacity-60">
                تحميل النسخة
              </button>
            </div>
          )}
          <div className="mb-4 text-center">
            <p className="text-sm font-bold text-slate-800">الإدارة العامة للتعليم بمنطقة عسير — مدرسة هارون الرشيد الابتدائية</p>
            <p className="text-xs text-slate-500">الجدول المدرسي العام — نظام مسار — عام 1448/1449 هـ — من الأحد إلى الخميس، سبع حصص يومياً</p>
          </div>
          <p className="text-xs text-slate-500 mb-3">اسحب الجدول أفقياً لعرض كل الأيام. الخلية تعرض المادة مختصرة ثم الفصل، كما في جدول مسار.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-[11px] border-collapse border border-slate-300">
              <thead>
                <tr className="bg-rose-50/80 text-slate-800">
                  <th rowSpan={2} className="p-2 border border-slate-300 sticky right-0 bg-rose-50 z-10">م</th>
                  <th rowSpan={2} className="p-2 border border-slate-300 min-w-[8.5rem] sticky right-8 bg-rose-50 z-10">المعلم</th>
                  {DAYS.map((day) => (
                    <th key={day.key} colSpan={PERIODS.length} className="p-2 border border-slate-300 text-center">
                      {day.label}
                    </th>
                  ))}
                  <th rowSpan={2} className="p-2 border border-slate-300">المجموع</th>
                </tr>
                <tr className="bg-slate-50 text-slate-600">
                  {DAYS.flatMap((day) =>
                    PERIODS.map((period) => (
                      <th key={`${day.key}-${period}`} className="p-1 border border-slate-300 text-center w-14">
                        {period}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {generalTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={3 + DAYS.length * PERIODS.length} className="p-6 text-center text-slate-400">
                      لا يوجد معلمون على الجدول العام بعد.
                    </td>
                  </tr>
                ) : (
                  generalTeachers.map((teacher) => {
                    const own = allSlots.filter((slot) => slot.teacherId === teacher.id);
                    return (
                      <tr key={teacher.id}>
                        <td className="p-1 border border-slate-300 text-center font-bold sticky right-0 bg-white">{teacher.scheduleOrder || "—"}</td>
                        <td className="p-1 border border-slate-300 font-bold sticky right-8 bg-white whitespace-nowrap">{teacher.fullName}</td>
                        {DAYS.flatMap((day) =>
                          PERIODS.map((period) => {
                            const slot = own.find((item) => item.dayOfWeek === day.key && item.periodNumber === period);
                            const crowded = own.filter((item) => item.dayOfWeek === day.key && item.periodNumber === period).length > 1;
                            return (
                              <td key={`${day.key}-${period}`} className={`p-1 border border-slate-300 text-center align-middle leading-tight ${crowded ? "bg-rose-50" : ""}`}>
                                {slot ? (
                                  <>
                                    <div className="font-bold text-slate-800">{SUBJECT_SHORT[slot.subjectName] || slot.subjectName}</div>
                                    <div className="text-slate-500">{classShort(slot.classId)}</div>
                                  </>
                                ) : null}
                              </td>
                            );
                          })
                        )}
                        <td className="p-1 border border-slate-300 text-center font-bold">{own.length}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-600">
            {Object.entries(SUBJECT_SHORT).map(([full, short]) => (
              <span key={full} className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-100">
                {short}: {full}
              </span>
            ))}
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
    </div>
  );
}
