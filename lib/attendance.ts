import { doc, setDoc } from "firebase/firestore";
import { tRakeezSchoolRef } from "@/lib/rakeezSchool";

export interface AttendancePayload {
  schoolId: string;
  classId: string;
  date: string; // مثال: "2026-10-01"
  absentStudents: string[]; // مصفوفة معرفات الطلاب الغائبين
  recordedBy?: string; // معرف المعلم أو الإداري
}

export async function saveDailyAttendance(payload: AttendancePayload) {
  try {
    // إنشاء مفتاح فريد يدمج التاريخ والفصل لمنع التكرار
    const recordId = `${payload.date}_${payload.classId}`;
    if (recordId.includes("/")) {
      throw new Error("معرّف سجل الغياب غير صالح");
    }

    // تحديد المسار الدقيق داخل المدرسة المعنية (Multi-tenant isolation)
    const { attendanceRef } = tRakeezSchoolRef(payload.schoolId);
    const attendanceDocRef = doc(attendanceRef, recordId);

    // حفظ البيانات أو تحديثها مباشرة
    await setDoc(
      attendanceDocRef,
      {
        classId: payload.classId,
        date: payload.date,
        absentStudents: payload.absentStudents,
        ...(payload.recordedBy ? { recordedBy: payload.recordedBy } : {}),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log("تم حفظ سجل الغياب بنجاح");
    return { success: true as const };
  } catch (error) {
    console.error("خطأ أثناء حفظ الغياب:", error);
    return { success: false as const, error };
  }
}
