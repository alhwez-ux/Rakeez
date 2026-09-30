"use client";

import React, { useEffect, useState } from "react";
import { Timestamp, addDoc, getDocs } from "firebase/firestore";
import { tRakeezSchoolRef } from "@/lib/rakeezSchool";

interface TaskItem {
  id?: string;
  title: string;
  description: string;
  targetClass: string;
  assignedBy: string;
  dueDate: string;
  status: "active" | "completed";
  createdAt?: Timestamp;
}

const CLASS_OPTIONS = [
  { id: "class_3a", label: "الصف الثالث الابتدائي (أ)" },
  { id: "class_3b", label: "الصف الثالث الابتدائي (ب)" },
  { id: "class_4a", label: "الصف الرابع الابتدائي (أ)" },
];

const classLabel = (classId: string) => CLASS_OPTIONS.find((item) => item.id === classId)?.label ?? classId;

export default function TasksDashboard({ schoolId, currentUserId }: { schoolId: string; currentUserId: string }) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetClass, setTargetClass] = useState("class_3a");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    async function fetchTasks() {
      try {
        setLoading(true);
        setErrorMsg("");
        const { tasksRef } = tRakeezSchoolRef(schoolId);
        const snapshot = await getDocs(tasksRef);
        const tasksData: TaskItem[] = [];
        snapshot.forEach((taskDoc) => {
          tasksData.push({ id: taskDoc.id, ...taskDoc.data() } as TaskItem);
        });
        setTasks(tasksData);
      } catch (error) {
        console.error("خطأ في جلب المهام:", error);
        setErrorMsg("تعذر جلب الواجبات. تحقق من إعدادات Firebase.");
      } finally {
        setLoading(false);
      }
    }

    if (schoolId) {
      fetchTasks();
    }
  }, [schoolId]);

  const handleCreateTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title || !dueDate) return;

    try {
      setSubmitting(true);
      setErrorMsg("");
      const { tasksRef } = tRakeezSchoolRef(schoolId);
      const newTask = {
        title,
        description,
        targetClass,
        assignedBy: currentUserId,
        dueDate,
        status: "active" as const,
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(tasksRef, newTask);
      setTasks((prev) => [{ id: docRef.id, ...newTask }, ...prev]);
      setTitle("");
      setDescription("");
      setDueDate("");
      setSuccessMsg("تم نشر الواجب/المهمة بنجاح!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (error) {
      console.error("خطأ أثناء إضافة المهمة:", error);
      setErrorMsg("تعذر نشر الواجب.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-600">جاري تحميل قائمة الواجبات والمهام...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-2xl border border-rose-100" dir="rtl">
      <div className="border-b border-slate-100 pb-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-800">متابعة الواجبات والمهام المدرسية</h2>
        <p className="text-sm text-slate-500">إدارة وتوزيع الواجبات المدرسية للفصول</p>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-center font-medium">{successMsg}</div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-xl text-center font-medium">{errorMsg}</div>
      )}

      <form onSubmit={handleCreateTask} className="bg-rose-50/70 p-4 rounded-xl mb-6 space-y-4 border border-rose-100">
        <h3 className="font-bold text-slate-800 text-lg">إضافة واجب أو مهمة جديدة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="عنوان الواجب أو الدرس (مثال: واجب الرياضيات - صفحة 45)"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            required
          />
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            required
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={targetClass}
            onChange={(event) => setTargetClass(event.target.value)}
            className="p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            {CLASS_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <textarea
            placeholder="تفاصيل إضافية أو ملاحظات للمعلمين والطلاب..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white h-11 resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-sm font-medium transition shadow-md shadow-blue-600/20 disabled:bg-slate-400"
        >
          {submitting ? "جاري النشر..." : "نشر الواجب للفصل"}
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="font-bold text-slate-800 text-lg mb-2">الواجبات الحالية</h3>
        {tasks.length === 0 ? (
          <p className="text-center p-6 text-slate-400 bg-slate-50 rounded-xl">لا توجد واجبات أو مهام مسجلة حالياً.</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm flex justify-between items-start gap-4 hover:bg-slate-50 transition"
            >
              <div>
                <h4 className="font-bold text-slate-800 text-base">{task.title}</h4>
                <p className="text-xs text-slate-600 mt-1">{task.description || "لا توجد تفاصيل إضافية."}</p>
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
                  <span>
                    الفصل المستهدف: <strong className="text-blue-700">{classLabel(task.targetClass)}</strong>
                  </span>
                  <span>
                    موعد التسليم: <strong className="text-rose-600">{task.dueDate}</strong>
                  </span>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                  task.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-800"
                }`}
              >
                {task.status === "completed" ? "مكتمل" : "نشط"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
