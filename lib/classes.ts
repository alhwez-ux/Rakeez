const GRADE_DEFS = [
  { id: "1", name: "الأول" },
  { id: "2", name: "الثاني" },
  { id: "3", name: "الثالث" },
  { id: "4", name: "الرابع" },
  { id: "5", name: "الخامس" },
  { id: "6", name: "السادس" },
] as const;

const KNOWN_SECTIONS = [
  { key: "a", label: "أ" },
  { key: "b", label: "ب" },
  { key: "c", label: "ج" },
  { key: "d", label: "د" },
] as const;

const GRADE_WORDS: Record<string, string> = {
  "1": "1",
  "١": "1",
  الأول: "1",
  اول: "1",
  أول: "1",
  "2": "2",
  "٢": "2",
  الثاني: "2",
  ثاني: "2",
  "3": "3",
  "٣": "3",
  الثالث: "3",
  ثالث: "3",
  "4": "4",
  "٤": "4",
  الرابع: "4",
  رابع: "4",
  "5": "5",
  "٥": "5",
  الخامس: "5",
  خامس: "5",
  "6": "6",
  "٦": "6",
  السادس: "6",
  سادس: "6",
};

export interface ClassOption {
  id: string;
  gradeId: string;
  sectionKey: string;
  sectionLabel: string;
  label: string;
  short: string;
}

export interface ExtraSection {
  gradeId: string;
  label: string;
}

export const GRADES = GRADE_DEFS.map((grade) => ({
  id: grade.id,
  name: grade.name,
  label: `الصف ${grade.name} الابتدائي`,
}));

export const DAYS = [
  { key: "Sunday", label: "الأحد" },
  { key: "Monday", label: "الإثنين" },
  { key: "Tuesday", label: "الثلاثاء" },
  { key: "Wednesday", label: "الأربعاء" },
  { key: "Thursday", label: "الخميس" },
];

export const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export const SUBJECT_SHORT: Record<string, string> = {
  "الدراسات الإسلامية": "دين",
  "التربية الفنية": "فنية",
  "التربية البدنية": "بدنية",
  "المهارات الرقمية": "رقمية",
  "الدراسات الاجتماعية": "اجتماعيات",
  "المهارات الحياتية": "حياتية",
  "اللغة الإنجليزية": "انجليزي",
  لغتي: "لغتي",
  العلوم: "علوم",
  الرياضيات: "رياضيات",
};

let extraSections: ExtraSection[] = [];
const catalogListeners = new Set<() => void>();

export function defaultSectionKeys(gradeId: string) {
  const grade = Number(gradeId);
  if (grade === 5 || grade === 6) return ["a", "b", "c"];
  return ["a", "b", "c", "d"];
}

export function normalizeSectionLabel(value: string) {
  const text = value.trim();
  const compact = text.toLowerCase();
  if (compact === "1" || compact === "a" || text === "أ" || text === "ا") return "أ";
  if (compact === "2" || compact === "b" || text === "ب") return "ب";
  if (compact === "3" || compact === "c" || text === "ج") return "ج";
  if (compact === "4" || compact === "d" || text === "د") return "د";
  return text;
}

function sectionKeyForLabel(label: string) {
  const known = KNOWN_SECTIONS.find((section) => section.label === label);
  if (known) return known.key;
  const hex = Array.from(label)
    .map((char) => (char.codePointAt(0) ?? 0).toString(16).padStart(4, "0"))
    .join("");
  return `u${hex}`;
}

function gradeName(gradeId: string) {
  return GRADE_DEFS.find((grade) => grade.id === gradeId)?.name ?? gradeId;
}

export function classOption(gradeId: string, sectionLabel: string): ClassOption | null {
  const grade = GRADE_DEFS.find((item) => item.id === gradeId);
  const label = normalizeSectionLabel(sectionLabel);
  if (!grade || !label) return null;
  const sectionKey = sectionKeyForLabel(label);
  return {
    id: `class_${grade.id}${sectionKey}`,
    gradeId: grade.id,
    sectionKey,
    sectionLabel: label,
    label: `الصف ${grade.name} الابتدائي (${label})`,
    short: `${grade.name}/${label}`,
  };
}

function defaultClassOptions() {
  const options: ClassOption[] = [];
  GRADE_DEFS.forEach((grade) => {
    defaultSectionKeys(grade.id).forEach((key) => {
      const section = KNOWN_SECTIONS.find((item) => item.key === key);
      const option = section ? classOption(grade.id, section.label) : null;
      if (option) options.push(option);
    });
  });
  return options;
}

export function getClassOptions() {
  const options = defaultClassOptions();
  extraSections.forEach((extra) => {
    const option = classOption(extra.gradeId, extra.label);
    if (!option) return;
    if (options.some((item) => item.id === option.id || (item.gradeId === option.gradeId && item.sectionLabel === option.sectionLabel))) {
      return;
    }
    options.push(option);
  });
  return options;
}

export const CLASS_OPTIONS = defaultClassOptions();

export function replaceExtraSections(next: ExtraSection[]) {
  extraSections = next
    .map((item) => ({ gradeId: String(item.gradeId ?? "").trim(), label: normalizeSectionLabel(String(item.label ?? "")) }))
    .filter((item) => GRADES.some((grade) => grade.id === item.gradeId) && item.label);
  catalogListeners.forEach((listener) => listener());
}

export function subscribeClassCatalog(listener: () => void) {
  catalogListeners.add(listener);
  return () => {
    catalogListeners.delete(listener);
  };
}

export function gradeChoices() {
  return GRADES.map((grade) => ({ id: grade.id, label: grade.label }));
}

export function sectionChoices(gradeId: string) {
  return getClassOptions()
    .filter((item) => item.gradeId === gradeId)
    .map((item) => ({ id: item.sectionKey, label: item.sectionLabel }));
}

export function describeClassId(classId: string): ClassOption | null {
  const match = classId.trim().match(/^class_([1-6])([a-dA-D1-4]|u[0-9a-f]+)$/);
  if (!match) return null;
  if (match[2].startsWith("u")) {
    const hex = match[2].slice(1);
    const chars: string[] = [];
    for (let index = 0; index < hex.length; index += 4) {
      const chunk = hex.slice(index, index + 4);
      if (!chunk) break;
      chars.push(String.fromCodePoint(Number.parseInt(chunk, 16)));
    }
    return classOption(match[1], chars.join(""));
  }
  return classOption(match[1], normalizeSectionLabel(match[2]));
}

export function classLabel(classId: string) {
  return getClassOptions().find((item) => item.id === classId)?.label ?? describeClassId(classId)?.label ?? classId;
}

export function classShort(classId: string) {
  return getClassOptions().find((item) => item.id === classId)?.short ?? describeClassId(classId)?.short ?? classId;
}

export function resolveClassId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const options = getClassOptions();
  const known = options.find((item) => item.id === trimmed || item.label === trimmed || item.short === trimmed);
  if (known) return known.id;

  const stored = describeClassId(trimmed);
  if (stored) {
    return options.find((item) => item.gradeId === stored.gradeId && item.sectionLabel === stored.sectionLabel)?.id ?? stored.id;
  }

  const compact = trimmed
    .replace(/\s+/g, "")
    .replace(/الصف/g, "")
    .replace(/الابتدائي/g, "")
    .replace(/[()[\]{}]/g, "");
  const gradeId = matchGradeId(compact);
  if (!gradeId) return "";
  const sectionToken = compact
    .replace(new RegExp(`^${gradeId}`), "")
    .replace(/^(الأول|اول|الثاني|ثاني|الثالث|ثالث|الرابع|رابع|الخامس|خامس|السادس|سادس)/, "")
    .replace(/^[/\\\-]+/, "");
  const sectionLabel = normalizeSectionLabel(sectionToken);
  if (!sectionLabel || sectionLabel === sectionToken && sectionToken.length > 3) {
    const single = normalizeSectionLabel(sectionToken.slice(-1));
    const option = classOption(gradeId, single);
    if (!option) return "";
    return options.find((item) => item.id === option.id)?.id ?? (KNOWN_SECTIONS.some((item) => item.label === option.sectionLabel) ? option.id : "");
  }
  const option = classOption(gradeId, sectionLabel);
  if (!option) return "";
  const listed = options.find((item) => item.id === option.id);
  if (listed) return listed.id;
  if (KNOWN_SECTIONS.some((item) => item.label === option.sectionLabel)) return option.id;
  return "";
}

function matchGradeId(compact: string) {
  const keys = Object.keys(GRADE_WORDS).sort((left, right) => right.length - left.length);
  const found = keys.find((key) => compact.startsWith(key));
  return found ? GRADE_WORDS[found] : "";
}

export function dayLabel(dayKey: string) {
  return DAYS.find((day) => day.key === dayKey)?.label ?? dayKey;
}
