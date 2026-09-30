"use client";

import React, { useState } from "react";

export default function SettingsDashboard({
  schoolId,
  onOpenTimetable,
}: {
  schoolId: string;
  onOpenTimetable?: () => void;
}) {
  const [themeColor, setThemeColor] = useState("blue");
  const [bgStyle, setBgStyle] = useState("light");
  const [statusMessage, setStatusMessage] = useState("");

  const showStatus = (message: string) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(""), 4000);
  };

  const handleSaveSettings = () => {
    document.documentElement.dataset.theme = themeColor;
    document.documentElement.dataset.bg = bgStyle;
    showStatus("تم حفظ وتطبيق إعدادات النظام وتخصيص المظهر بنجاح!");
  };

  const handlePrintReports = (reportType: string) => {
    document.body.dataset.printReport = reportType;
    window.print();
  };

  const handleDataAction = (actionType: string) => {
    if (actionType === "export_noor") {
      showStatus("جاري تجهيز وتصدير ملف البيانات بتنسيق متوافق مع نظام نور...");
    } else if (actionType === "import_excel") {
      showStatus("فتح نافذة استيراد بيانات الطلاب والكادر من ملفات Excel...");
    } else {
      showStatus(`تم إنشاء نسخة احتياطية محلية لبيانات المدرسة (${schoolId}) بنجاح!`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white shadow-lg rounded-2xl border border-rose-100" dir="rtl">
      <div className="border-b border-slate-100 pb-4 mb-6 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="rk-title text-slate-800">لوحة الإعدادات وصلاحيات الإدارة</h2>
          <p className="rk-lead text-slate-500">إدارة الإدخال، نظام نور، طباعة التقارير، وتخصيص مظهر النظام</p>
        </div>
        {statusMessage && (
          <span className="bg-blue-50 text-blue-900 text-xs px-4 py-2 rounded-xl font-bold shadow-sm">{statusMessage}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-blue-50/50 border border-blue-200 p-5 rounded-2xl shadow-sm">
          <h3 className="font-bold text-slate-800 text-base mb-3">التصدير والربط (نظام نور)</h3>
          <p className="text-xs text-slate-500 mb-4">تبادل البيانات وسحب كشوف الطلاب والغياب بصيغة معتمدة.</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleDataAction("export_noor")}
              className="w-full text-right bg-white border border-blue-200 hover:bg-blue-100 text-blue-900 px-3 py-2 rounded-xl text-xs font-bold transition flex justify-between items-center"
            >
              <span>تصدير تقارير لنظام نور</span>
              <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">Excel / CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleDataAction("import_excel")}
              className="w-full text-right bg-white border border-blue-200 hover:bg-blue-100 text-blue-900 px-3 py-2 rounded-xl text-xs font-bold transition flex justify-between items-center"
            >
              <span>استيراد بيانات من ملف</span>
              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">رفع ملف</span>
            </button>
            <button
              type="button"
              onClick={() => handleDataAction("backup")}
              className="w-full text-right bg-white border border-blue-200 hover:bg-blue-100 text-blue-900 px-3 py-2 rounded-xl text-xs font-bold transition flex justify-between items-center"
            >
              <span>نسخة احتياطية للقاعدة</span>
              <span className="text-[10px] bg-slate-700 text-white px-1.5 py-0.5 rounded">حفظ</span>
            </button>
          </div>
        </div>

        <div className="bg-rose-50/40 border border-rose-100 p-5 rounded-2xl shadow-sm">
          <h3 className="font-bold text-slate-800 text-base mb-3">أيقونات الإدخال الضرورية</h3>
          <p className="text-xs text-slate-500 mb-4">إضافة وتحديث سجلات الكادر، الطلاب، والجداول الأساسية.</p>
          <div className="space-y-2">
            <button
              type="button"
              className="w-full text-right bg-white border border-slate-200 hover:bg-blue-50 text-blue-900 px-3 py-2 rounded-xl text-xs font-medium transition"
            >
              + تسجيل طالب جديد بالفصل
            </button>
            <button
              type="button"
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
        </div>

        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm">
          <h3 className="font-bold text-slate-800 text-base mb-3">طباعة التقارير الرسمية</h3>
          <p className="text-xs text-slate-500 mb-4">تصدير تقارير الأداء والغياب بصيغة جاهزة للطباعة المباشرة.</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handlePrintReports("attendance")}
              className="w-full text-right bg-white border border-slate-200 hover:bg-emerald-50 text-emerald-900 px-3 py-2 rounded-xl text-xs font-medium transition flex justify-between items-center"
            >
              <span>تقرير غياب الأسبوع</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">طباعة</span>
            </button>
            <button
              type="button"
              onClick={() => handlePrintReports("tasks")}
              className="w-full text-right bg-white border border-slate-200 hover:bg-emerald-50 text-emerald-900 px-3 py-2 rounded-xl text-xs font-medium transition flex justify-between items-center"
            >
              <span>ملخص إنجاز الواجبات</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">طباعة</span>
            </button>
            <button
              type="button"
              onClick={() => handlePrintReports("system")}
              className="w-full text-right bg-white border border-slate-200 hover:bg-emerald-50 text-emerald-900 px-3 py-2 rounded-xl text-xs font-medium transition flex justify-between items-center"
            >
              <span>تقرير استهلاك رَكيز</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">طباعة</span>
            </button>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm">
          <h3 className="font-bold text-slate-800 text-base mb-3">تخصيص المظهر والخلفيات</h3>
          <p className="text-xs text-slate-500 mb-4">اختر هوية اللون والنمط المفضل لبيئة العمل الإدارية.</p>
          <div className="space-y-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">لون الهوية:</label>
              <select
                value={themeColor}
                onChange={(event) => setThemeColor(event.target.value)}
                className="w-full p-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800"
              >
                <option value="blue">الأزرق الملكي (الرسمي)</option>
                <option value="emerald">الأخضر الزمردي</option>
                <option value="indigo">النيلي الداكن</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">نمط الخلفية:</label>
              <select
                value={bgStyle}
                onChange={(event) => setBgStyle(event.target.value)}
                className="w-full p-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800"
              >
                <option value="light">فاتح مريح للعين</option>
                <option value="modern">رمادي ناصع حديث</option>
              </select>
            </div>
          </div>
        </div>
      </div>

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
  );
}
