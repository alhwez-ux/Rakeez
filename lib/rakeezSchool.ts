import { collection, doc } from "firebase/firestore";
import { db } from "./firebase";

// دالة مرجعية لتحديد مسار المدرسة الحالي بكل أمان.
// مسار المستند في Firestore يجب أن يكون زوجياً، لذلك بيانات المدرسة
// تقع على schools/{schoolId}، وinfo ليست مجموعة وسيطة.
export function tRakeezSchoolRef(schoolId: string) {
  const id = schoolId.trim();
  if (!id || id.includes("/")) {
    throw new Error("معرّف المدرسة غير صالح");
  }

  return {
    infoRef: doc(db, "schools", id),
    staffRef: collection(db, "schools", id, "staff"),
    studentsRef: collection(db, "schools", id, "students"),
    timetablesRef: collection(db, "schools", id, "timetables"),
    assignmentsRef: collection(db, "schools", id, "assignments"),
    attendanceRef: collection(db, "schools", id, "attendance"),
    tasksRef: collection(db, "schools", id, "tasks_and_homework"),
  };
}
