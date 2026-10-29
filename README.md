# رَكيز

منظومة تشغيل المدارس: الجداول، الغياب، الواجبات، والمؤشرات. الواجهة Next.js والبيانات في Cloud Firestore ضمن `schools/{schoolId}`.

## التشغيل

```bash
npm install
copy .env.example .env.local
npm run dev
```

املأ `.env.local` من إعدادات تطبيق Firebase (القيم العامة `NEXT_PUBLIC_*` فقط). ثم افتح `http://localhost:3000`.

## البناء والنشر

```bash
npm run build
npm start
```

على Vercel اربط المستودع واضبط المتغيرات الستة نفسها قبل البناء. أمر البناء `next build` وأمر التشغيل `next start`. لا ترفع `.env.local`.

## فحص قاعدة البيانات

قراءة غير مدمّرة لمدرستي الواجهة والمجموعات المتوقعة:

```bash
npm run check:db
```

بعد التشغيل، نفس الفحص متاح على `GET /api/health`.

المجموعات تحت كل مدرسة: `staff`، `students`، `timetables`، `assignments`، `attendance`، `tasks_and_homework`.

حساب المالك سجل واحد في `system/owner`: اسم المستخدم وتجزئة SHA-256 لكلمة المرور مع ملح، دون حفظ كلمة المرور كنص. الدخول من الصفحة الرئيسية يطابق هذه التجزئة، والتعديل من قسم «حساب المالك» في الإعدادات بعد إدخال كلمة المرور الحالية. التهيئة الأولى، إن لم يوجد السجل، تتم بأمر `node scripts/seed-owner.mjs` مع `OWNER_USERNAME` و`OWNER_PASSWORD` في بيئة التشغيل فقط، وليس داخل الملفات.

استيراد الإعدادات يقبل CSV (من Excel: حفظ باسم CSV) بأعمدة `اسم الطالب` أو `اسم المعلم`.
