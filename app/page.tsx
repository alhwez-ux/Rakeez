'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ShieldCheck, UserCheck, ArrowRight, Lock, Phone, Eye, EyeOff } from 'lucide-react';
import { saveOwnerSession, verifyOwnerLogin } from '@/lib/ownerAccount';

export default function RakeezLoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const username = identifier.trim();
      const allowed = await verifyOwnerLogin(username, password);
      if (!allowed) {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة.');
        return;
      }
      saveOwnerSession(username);
      const params = new URLSearchParams({
        schoolId: selectedSchool,
        userId: username,
      });
      router.push(`/dashboard?${params.toString()}`);
    } catch (loginError) {
      console.error(loginError);
      const message = loginError instanceof Error ? loginError.message : 'تعذر التحقق من بيانات الدخول.';
      setError(message.replace(/AIza[\w-]+/g, '[redacted]'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 font-sans" dir="rtl">
      
      {/* القسم الأيمن: الهوية والتعريف بالنظام التنظيمي (يظهر كاملاً على الحاسوب، مخفف على الجوال) */}
      <div className="rk-brand-panel flex flex-col justify-between gap-8 p-6 sm:p-8 lg:p-16 text-white relative overflow-hidden">
        <div className="absolute -left-16 -top-16 w-72 h-72 rk-brand-orb rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -right-10 top-1/3 w-80 h-80 rk-brand-orb-soft rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/4 -bottom-20 w-72 h-72 rk-brand-orb rounded-full blur-3xl pointer-events-none"></div>

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
          <h2 className="rk-title text-white mb-3">
            العصب التنظيمي لإدارة مدرستك بكفاءة عالية
          </h2>
          <p className="rk-lead text-white/80 mb-6 lg:mb-8">
            نظام موحد يدمج إدارة الجداول، حصص الاحتياط، الغياب اليومي، والمتابعة الإدارية للمعلمين والإداريين بكل دقة وسرعة وبدون تداخل بيانات.
          </p>
        </div>

        {/* مميزات سريعة تظهر في الواجهة */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-white/15 rk-lead">
          <div className="flex items-center gap-2 text-white/80">
            <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
            <span>عزل تام لبيانات المدارس</span>
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <UserCheck className="w-5 h-5 text-blue-400 shrink-0" />
            <span>إدارة الحصص والاحتياط</span>
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <Building2 className="w-5 h-5 text-blue-400 shrink-0" />
            <span>رصد الغياب والمهام اللحظية</span>
          </div>
        </div>
      </div>

      {/* القسم الأيسر: نموذج تسجيل الدخول (يتكيف تلقائياً مع حجم الشاشة) */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
          
          <div className="mb-8">
            <h3 className="rk-title text-slate-800 mb-2">تسجيل الدخول</h3>
            <p className="rk-lead text-slate-500">أدخل اسم المستخدم وكلمة المرور للوصول إلى لوحة التحكم</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* اختيار المدرسة (للنظام المتعدد - Multi-tenant) */}
            <div>
              <label className="rk-label">المدرسة / المنشأة</label>
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

            <div>
              <label className="rk-label">اسم المستخدم</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="اسم المستخدم"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                  className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="rk-label">كلمة المرور</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full pr-10 pl-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm font-medium text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

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
            <p className="rk-lead text-slate-400 flex items-center justify-center gap-1">
              <Lock className="w-3.5 h-3.5" />
              <span>بيانات مشفرة ومعزولة لكل مدرسة بشكل كامل</span>
            </p>
          </div>

        </div>
      </div>

    </main>
  );
}
