"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useSchoolClasses } from "./SchoolClassesProvider";
import { readAppearance, saveAppearance, THEME_OPTIONS, type BgStyle, type ThemeColor } from "@/lib/appearance";
import { getOwnerAccount, saveOwnerSession, updateOwnerAccount } from "@/lib/ownerAccount";
import {
  addStaffMember,
  addStudent,
  listStaff,
  buildBackupJson,
  buildNoorCsv,
  buildPrintReport,
  importSchoolCsv,
} from "@/lib/schoolRecords";

function PasswordInput({
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        className="w-full py-2.5 pr-2.5 pl-10 border border-slate-200 rounded-xl text-sm bg-white"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 hover:text-slate-600"
      >
        {visible ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function SettingsDashboard({
  schoolId,
  onOpenTimetable,
}: {
  schoolId: string;
  onOpenTimetable?: () => void;
}) {
  const [themeColor, setThemeColor] = useState<ThemeColor>("blue");
  const [bgStyle, setBgStyle] = useState<BgStyle>("light");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [busy, setBusy] = useState("");
  const [panel, setPanel] = useState<"student" | "staff" | null>(null);
  const [printSheet, setPrintSheet] = useState<{ title: string; headers: string[]; rows: string[][] } | null>(null);
  const shouldPrint = useRef(false);
  const [studentName, setStudentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const { options } = useSchoolClasses();
  const [studentClassId, setStudentClassId] = useState("class_1a");
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState<"teacher" | "admin">("teacher");
  const [staffList, setStaffList] = useState<{ id: string; fullName: string; role: string; scheduleOrder: number; subjects: string[] }[]>([]);
  const [ownerUsername, setOwnerUsername] = useState("");
  const [ownerCurrentPassword, setOwnerCurrentPassword] = useState("");
  const [ownerNewPassword, setOwnerNewPassword] = useState("");
  const [ownerConfirmPassword, setOwnerConfirmPassword] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    listStaff(schoolId)
      .then((rows) => {
        if (!cancelled) setStaffList(rows);
      })
      .catch(() => {
        if (cancelled) return;
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId, panel]);

  useEffect(() => {
    const saved = readAppearance();
    if (!saved) return;
    setThemeColor(saved.themeColor);
    setBgStyle(saved.bgStyle);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getOwnerAccount()
      .then((account) => {
        if (!cancelled && account) setOwnerUsername(account.username);
      })
      .catch(() => {
        if (cancelled) return;
        setStatusError(true);
        setStatusMessage("تعذر تحميل حساب المالك.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!printSheet || !shouldPrint.current) return;
    shouldPrint.current = false;
    window.print();
  }, [printSheet]);

  const showStatus = (message: string, isError = false) => {
    setStatusMessage(message);
    setStatusError(isError);
    setTimeout(() => setStatusMessage(""), 5000);
  };

  const runAction = async (action: string, task: () => Promise<string>) => {
    try {
      setBusy(action);
      showStatus(await task());
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "تعذر تنفيذ الإجراء.";
      showStatus(message.replace(/AIza[\w-]+/g, "[redacted]"), true);
    } finally {
      setBusy("");
    }
  };

  const handleSaveSettings = () => {
    saveAppearance({ themeColor, bgStyle });
    showStatus("تم حفظ وتطبيق إعدادات النظام وتخصيص المظهر بنجاح!");
  };

  const handlePrintReports = (reportType: "attendance" | "tasks" | "system") => {
    runAction(`print-${reportType}`, async () => {
      const report = await buildPrintReport(schoolId, reportType);
      shouldPrint.current = true;
      setPrintSheet(report);
      return "تم تجهيز التقرير للطباعة.";
    });
  };

  const handleExportNoor = () => {
    runAction("export_noor", async () => {
      const csv = await buildNoorCsv(schoolId);
      downloadText(`noor-${schoolId}.csv`, csv, "text/csv;charset=utf-8");
      return "تم تنزيل ملف الحضور بصيغة CSV متوافقة مع Excel ونظام نور.";
    });
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    await runAction("import_excel", async () => {
      const text = await file.text();
      const result = await importSchoolCsv(schoolId, text);
      return `تم استيراد ${result.students} طالباً و${result.staff} من الكادر. تم تجاوز ${result.skipped} صف.`;
    });
    if (importRef.current) importRef.current.value = "";
  };

  const handleBackup = () => {
    runAction("backup", async () => {
      const json = await buildBackupJson(schoolId);
      downloadText(`rakeez-backup-${schoolId}.json`, json, "application/json;charset=utf-8");
      return "تم تنزيل النسخة الاحتياطية المحلية لبيانات المدرسة.";
    });
  };

  const handleAddStudent = (event: React.FormEvent) => {
    event.preventDefault();
    runAction("student", async () => {
      await addStudent({
        schoolId,
        studentName,
        parentPhone,
        classId: studentClassId,
      });
      setStudentName("");
      setParentPhone("");
      setPanel(null);
      return "تم تسجيل الطالب في الفصل.";
    });
  };

  const handleAddStaff = (event: React.FormEvent) => {
    event.preventDefault();
    runAction("staff", async () => {
      await addStaffMember({ schoolId, fullName: staffName, role: staffRole });
      setStaffName("");
      setPanel(null);
      return staffRole === "admin" ? "تمت إضافة الإداري إلى الكادر." : "تمت إضافة المعلم إلى الكادر.";
    });
  };

  const handleOwnerAccount = (event: React.FormEvent) => {
    event.preventDefault();
    if ((ownerNewPassword || ownerConfirmPassword) && ownerNewPassword !== ownerConfirmPassword) {
      showStatus("تأكيد كلمة المرور غير مطابق.", true);
      return;
    }
    runAction("owner", async () => {
      const username = await updateOwnerAccount({
        currentPassword: ownerCurrentPassword,
        username: ownerUsername,
        newPassword: ownerNewPassword,
      });
      saveOwnerSession(username);
      const params = new URLSearchParams(window.location.search);
      params.set("userId", username);
      router.replace(`/dashboard?${params.toString()}`);
      setOwnerCurrentPassword("");
      setOwnerNewPassword("");
      setOwnerConfirmPassword("");
      return "تم حفظ بيانات دخول المالك.";
    });
  };

  return (
    <div className="max-w-7xl mx-auto" dir="rtl">
      {printSheet && (
        <section className="print-sheet p-6">
          <h2 className="rk-title text-slate-800 mb-4">{printSheet.title}</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {printSheet.headers.map((header) => (
                  <th key={header} className="border border-slate-300 p-2 text-right">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printSheet.rows.length === 0 ? (
                <tr>
                  <td className="border border-slate-300 p-2" colSpan={printSheet.headers.length}>
                    لا توجد بيانات لهذا التقرير.
                  </td>
                </tr>
              ) : (
                printSheet.rows.map((row, index) => (
                  <tr key={`${row.join("-")}-${index}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${cell}-${cellIndex}`} className="border border-slate-300 p-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}
      <div className="no-print p-6 bg-white shadow-lg rounded-2xl border border-rose-100">
      <div className="border-b border-slate-100 pb-4 mb-6 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="rk-title text-slate-800">لوحة الإعدادات وصلاحيات الإدارة</h2>
          <p className="rk-lead text-slate-500">إدارة الإدخال، نظام نور، طباعة التقارير، وتخصيص مظهر النظام</p>
        </div>
        {statusMessage && (
          <span
            className={`text-xs px-4 py-2 rounded-xl font-bold shadow-sm ${
              statusError ? "bg-rose-50 text-rose-800" : "bg-blue-50 text-blue-900"
            }`}
          >
            {statusMessage}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-blue-50/50 border border-blue-200 p-5 rounded-2xl shadow-sm">
          <h3 className="font-bold text-slate-800 text-base mb-3">التصدير والربط (نظام نور)</h3>
          <p className="text-xs text-slate-500 mb-4">تبادل البيانات وسحب كشوف الطلاب والغياب بصيغة معتمدة.</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleExportNoor}
              disabled={Boolean(busy)}
              className="w-full text-right bg-white border border-blue-200 hover:bg-blue-100 text-blue-900 px-3 py-2 rounded-xl text-xs font-bold transition flex justify-between items-center disabled:opacity-60"
            >
              <span>{busy === "export_noor" ? "جاري التصدير..." : "تصدير تقارير لنظام نور"}</span>
              <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">Excel / CSV</span>
            </button>
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              disabled={Boolean(busy)}
              className="w-full text-right bg-white border border-blue-200 hover:bg-blue-100 text-blue-900 px-3 py-2 rounded-xl text-xs font-bold transition flex justify-between items-center disabled:opacity-60"
            >
              <span>{busy === "import_excel" ? "جاري الاستيراد..." : "استيراد بيانات من ملف"}</span>
              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">CSV</span>
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => handleImportFile(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={handleBackup}
              disabled={Boolean(busy)}
              className="w-full text-right bg-white border border-blue-200 hover:bg-blue-100 text-blue-900 px-3 py-2 rounded-xl text-xs font-bold transition flex justify-between items-center disabled:opacity-60"
            >
              <span>{busy === "backup" ? "جاري الحفظ..." : "نسخة احتياطية للقاعدة"}</span>
              <span className="text-[10px] bg-slate-700 text-white px-1.5 py-0.5 rounded">JSON</span>
            </button>
          </div>
        </div>

        <div className="bg-rose-50/40 border border-rose-100 p-5 rounded-2xl shadow-sm">
          <h3 className="font-bold text-slate-800 text-base mb-3">أيقونات الإدخال الضرورية</h3>
          <p className="text-xs text-slate-500 mb-4">إضافة وتحديث سجلات الكادر، الطلاب، والجداول الأساسية.</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setPanel((current) => (current === "student" ? null : "student"))}
              className="w-full text-right bg-white border border-slate-200 hover:bg-blue-50 text-blue-900 px-3 py-2 rounded-xl text-xs font-medium transition"
            >
              + تسجيل طالب جديد بالفصل
            </button>
            <button
              type="button"
              onClick={() => setPanel((current) => (current === "staff" ? null : "staff"))}
              className="w-full text-right bg-white border border-slate-200 hover:bg-blue-50 text-blue-900 px-3 py-2 rounded-xl text-xs font-medium transition"
            >
              + إضافة معلم أو إداري جديد
            </button>
            <button
              type="button"
              onClick={onOpenTimetable}
              className="w-full text-right bg-white border border-slate-200 hover:bg-blue-50 text-blue-900 px-3 py-2 rounded-xl text-xs font-medium transition"
            >
              + تحديث جدول الحصص
            </button>
          </div>
          <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {staffList.length === 0 ? (
              <p className="p-3 text-xs text-slate-400">لا يوجد كادر مسجل بعد.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-rose-50/80 text-slate-700">
                  <tr>
                    <th className="p-2 text-right">م</th>
                    <th className="p-2 text-right">الاسم</th>
                    <th className="p-2 text-right">الدور</th>
                    <th className="p-2 text-right">المواد</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((member) => (
                    <tr key={member.id} className="border-t border-slate-100">
                      <td className="p-2">{member.scheduleOrder || "—"}</td>
                      <td className="p-2 font-medium">{member.fullName}</td>
                      <td className="p-2">{member.role === "admin" ? "إداري" : "معلم"}</td>
                      <td className="p-2 text-slate-500">{member.subjects.join("، ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm">
          <h3 className="font-bold text-slate-800 text-base mb-3">طباعة التقارير الرسمية</h3>
          <p className="text-xs text-slate-500 mb-4">تصدير تقارير الأداء والغياب بصيغة جاهزة للطباعة المباشرة.</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handlePrintReports("attendance")}
              disabled={Boolean(busy)}
              className="w-full text-right bg-white border border-slate-200 hover:bg-emerald-50 text-emerald-900 px-3 py-2 rounded-xl text-xs font-medium transition flex justify-between items-center disabled:opacity-60"
            >
              <span>تقرير غياب الأسبوع</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">طباعة</span>
            </button>
            <button
              type="button"
              onClick={() => handlePrintReports("tasks")}
              disabled={Boolean(busy)}
              className="w-full text-right bg-white border border-slate-200 hover:bg-emerald-50 text-emerald-900 px-3 py-2 rounded-xl text-xs font-medium transition flex justify-between items-center disabled:opacity-60"
            >
              <span>ملخص إنجاز الواجبات</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">طباعة</span>
            </button>
            <button
              type="button"
              onClick={() => handlePrintReports("system")}
              disabled={Boolean(busy)}
              className="w-full text-right bg-white border border-slate-200 hover:bg-emerald-50 text-emerald-900 px-3 py-2 rounded-xl text-xs font-medium transition flex justify-between items-center disabled:opacity-60"
            >
              <span>تقرير استهلاك رَكيز</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">طباعة</span>
            </button>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm">
          <h3 className="font-bold text-slate-800 text-base mb-3">تخصيص المظهر والخلفيات</h3>
          <p className="text-xs text-slate-500 mb-4">اختر هوية اللون والنمط. يُطبَّق اللون مباشرة على صفحة الدخول ولوحة التحكم.</p>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-2">لون الهوية:</label>
              <div className="grid grid-cols-2 gap-2">
                {THEME_OPTIONS.map((option) => {
                  const selected = themeColor === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        const next = option.id as ThemeColor;
                        setThemeColor(next);
                        saveAppearance({ themeColor: next, bgStyle });
                      }}
                      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-right text-xs font-bold transition ${
                        selected
                          ? "border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-600/25"
                          : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"
                      }`}
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: option.swatch }}
                      />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">نمط الخلفية:</label>
              <select
                value={bgStyle}
                onChange={(event) => {
                  const next = event.target.value as BgStyle;
                  setBgStyle(next);
                  saveAppearance({ themeColor, bgStyle: next });
                }}
                className="w-full p-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800"
              >
                <option value="light">فاتح مريح للعين</option>
                <option value="modern">رمادي ناصع حديث</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-6 bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm">
        <h3 className="font-bold text-slate-800 text-base mb-1">حساب المالك</h3>
        <p className="text-xs text-slate-500 mb-4">
          تغيير اسم المستخدم وكلمة المرور. يلزم إدخال كلمة المرور الحالية قبل الحفظ.
        </p>
        <form onSubmit={handleOwnerAccount} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">اسم المستخدم</label>
            <input
              value={ownerUsername}
              onChange={(event) => setOwnerUsername(event.target.value)}
              autoComplete="username"
              required
              className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">كلمة المرور الحالية</label>
            <PasswordInput
              value={ownerCurrentPassword}
              onChange={setOwnerCurrentPassword}
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">كلمة المرور الجديدة</label>
            <PasswordInput
              value={ownerNewPassword}
              onChange={setOwnerNewPassword}
              autoComplete="new-password"
              placeholder="اتركها فارغة للإبقاء على الحالية"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">تأكيد كلمة المرور</label>
            <PasswordInput
              value={ownerConfirmPassword}
              onChange={setOwnerConfirmPassword}
              autoComplete="new-password"
            />
          </div>
          <div className="md:col-span-2 xl:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={Boolean(busy)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-md shadow-blue-600/20 transition disabled:opacity-60"
            >
              {busy === "owner" ? "جاري الحفظ..." : "حفظ بيانات الدخول"}
            </button>
          </div>
        </form>
      </section>

      {panel === "student" && (
        <form onSubmit={handleAddStudent} className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3 bg-rose-50/50 border border-rose-100 p-4 rounded-2xl">
          <input
            value={studentName}
            onChange={(event) => setStudentName(event.target.value)}
            placeholder="اسم الطالب"
            required
            className="p-2.5 border border-slate-200 rounded-xl text-sm bg-white"
          />
          <input
            value={parentPhone}
            onChange={(event) => setParentPhone(event.target.value)}
            placeholder="جوال ولي الأمر"
            className="p-2.5 border border-slate-200 rounded-xl text-sm bg-white"
          />
          <select
            value={studentClassId}
            onChange={(event) => setStudentClassId(event.target.value)}
            className="p-2.5 border border-slate-200 rounded-xl text-sm bg-white"
          >
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={Boolean(busy)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm disabled:opacity-60"
          >
            {busy === "student" ? "جاري التسجيل..." : "حفظ الطالب"}
          </button>
        </form>
      )}

      {panel === "staff" && (
        <form onSubmit={handleAddStaff} className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 bg-rose-50/50 border border-rose-100 p-4 rounded-2xl">
          <input
            value={staffName}
            onChange={(event) => setStaffName(event.target.value)}
            placeholder="اسم المعلم أو الإداري"
            required
            className="p-2.5 border border-slate-200 rounded-xl text-sm bg-white"
          />
          <select
            value={staffRole}
            onChange={(event) => setStaffRole(event.target.value as "teacher" | "admin")}
            className="p-2.5 border border-slate-200 rounded-xl text-sm bg-white"
          >
            <option value="teacher">معلم</option>
            <option value="admin">إداري</option>
          </select>
          <button
            type="submit"
            disabled={Boolean(busy)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm disabled:opacity-60"
          >
            {busy === "staff" ? "جاري الإضافة..." : "حفظ في الكادر"}
          </button>
        </form>
      )}

      <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
        <button
          type="button"
          onClick={handleSaveSettings}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-md shadow-blue-600/20 transition"
        >
          حفظ وتطبيق إعدادات النظام
        </button>
      </div>
      </div>
    </div>
  );
}
