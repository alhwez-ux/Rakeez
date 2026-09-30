'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ShieldCheck, UserCheck, ArrowRight, Lock, Phone } from 'lucide-react';

export default function RakeezLoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const params = new URLSearchParams({
      schoolId: selectedSchool,
      userId: identifier.trim(),
    });
    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 font-sans" dir="rtl">
      
      {/* القسم الأيمن: الهوية والتعريف بالنظام التنظيمي (يظهر كاملاً على الحاسوب، مخفف على الجوال) */}
      <div className="flex flex-col justify-between p-8 lg:p-16 text-white relative overflow-hidden bg-[linear-gradient(165deg,#1b3348_0%,#2c3148_46%,#5a3a48_100%)]">
        <div className="absolute -left-16 -top-16 w-72 h-72 bg-sky-400/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -right-10 top-1/3 w-80 h-80 bg-rose-300/25 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/4 -bottom-20 w-72 h-72 bg-violet-300/15 rounded-full blur-3xl pointer-events-none"></div>

        <div>
          {/* شعار النظام — العرض أصغر من الأصل حتى لا يزاحم النص، والمصدر عالي الدقة */}
          <div className="mb-6">
            <div className="inline-flex rounded-2xl bg-[#f2ede7] p-1.5 shadow-lg shadow-black/25 ring-1 ring-white/10">
              <img
                src="/rakeez-logo.png"
                alt="شعار نظام ركيز"
                width={493}
                height={446}
                className="h-auto w-[148px] rounded-xl object-contain sm:w-[168px]"
              />
            </div>
          </div>

          {/* العنوان الرئيسي والنبذة */}
          <h2 className="text-3xl lg:text-4xl font-extrabold leading-snug mb-4">
            العصب التنظيمي لإدارة مدرستك بكفاءة عالية
          </h2>
          <p className="text-slate-300 text-base leading-relaxed mb-8">
            نظام موحد يدمج إدارة الجداول، حصص الاحتياط، الغياب اليومي، والمتابعة الإدارية للمعلمين والإداريين بكل دقة وسرعة وبدون تداخل بيانات.
          </p>
        </div>

        {/* مميزات سريعة تظهر في الواجهة */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-800 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
            <span>عزل تام لبيانات المدارس</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <UserCheck className="w-5 h-5 text-blue-400 shrink-0" />
            <span>إدارة الحصص والاحتياط</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Building2 className="w-5 h-5 text-blue-400 shrink-0" />
            <span>رصد الغياب والمهام اللحظية</span>
          </div>
        </div>
      </div>

      {/* القسم الأيسر: نموذج تسجيل الدخول (يتكيف تلقائياً مع حجم الشاشة) */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
          
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">تسجيل الدخول</h3>
            <p className="text-slate-500 text-sm">أدخل بياناتك للوصول إلى لوحة التحكم التشغيلية</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* اختيار المدرسة (للنظام المتعدد - Multi-tenant) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">المدرسة / المنشأة</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-slate-400">
                  <Building2 className="w-4 h-4" />
                </span>
                <select
                  value={selectedSchool}
                  onChange={(e) => setSelectedSchool(e.target.value)}
                  required
                  className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all appearance-none"
                >
                  <option value="" disabled>اختر المدرسة التابع لها...</option>
                  <option value="haroon_alrasheed">مدرسة هارون الرشيد الابتدائية</option>
                  <option value="alarqam_school">مدرستي الأهلية (مثال)</option>
                </select>
              </div>
            </div>

            {/* رقم الجوال أو المعرف الوظيفي */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">رقم الجوال أو المعرف الوظيفي</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="05xxxxxxxx"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* زر الدخول */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 group disabled:opacity-70"
            >
              {loading ? (
                <span>جاري التحقق...</span>
              ) : (
                <>
                  <span>دخول للنظام</span>
                  <ArrowRight className="w-4 h-4 group-hover:-translate-x-1 transition-transform rotate-180" />
                </>
              )}
            </button>
          </form>

          {/* تذييل بسيط */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
              <Lock className="w-3.5 h-3.5" />
              <span>بيانات مشفرة ومعزولة لكل مدرسة بشكل كامل</span>
            </p>
          </div>

        </div>
      </div>

    </main>
  );
}
