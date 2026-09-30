export const CLASS_OPTIONS = [
  { id: "class_3a", label: "الصف الثالث الابتدائي (أ)" },
  { id: "class_3b", label: "الصف الثالث الابتدائي (ب)" },
  { id: "class_4a", label: "الصف الرابع الابتدائي (أ)" },
];

export const DAYS = [
  { key: "Sunday", label: "الأحد" },
  { key: "Monday", label: "الإثنين" },
  { key: "Tuesday", label: "الثلاثاء" },
  { key: "Wednesday", label: "الأربعاء" },
  { key: "Thursday", label: "الخميس" },
];

export const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export function classLabel(classId: string) {
  return CLASS_OPTIONS.find((item) => item.id === classId)?.label ?? classId;
}

export function dayLabel(dayKey: string) {
  return DAYS.find((day) => day.key === dayKey)?.label ?? dayKey;
}
