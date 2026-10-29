import { getDoc, setDoc } from "firebase/firestore";
import { getClassOptions, normalizeSectionLabel, replaceExtraSections, type ExtraSection } from "./classes";
import { tRakeezSchoolRef } from "./rakeezSchool";

function asExtra(value: unknown): ExtraSection | null {
  if (!value || typeof value !== "object") return null;
  const data = value as { gradeId?: unknown; label?: unknown };
  const gradeId = String(data.gradeId ?? "").trim();
  const label = normalizeSectionLabel(String(data.label ?? ""));
  if (!gradeId || !label) return null;
  return { gradeId, label };
}

export async function loadExtraSections(schoolId: string) {
  const { infoRef } = tRakeezSchoolRef(schoolId);
  const snapshot = await getDoc(infoRef);
  const raw = snapshot.data()?.extraSections;
  const extras = Array.isArray(raw) ? raw.map(asExtra).filter((item): item is ExtraSection => item !== null) : [];
  replaceExtraSections(extras);
  return extras;
}

export async function addSchoolSection(schoolId: string, gradeId: string, rawLabel: string) {
  const label = normalizeSectionLabel(rawLabel);
  if (!label) throw new Error("اكتب رمز الفصل.");
  const current = getClassOptions();
  if (current.some((item) => item.gradeId === gradeId && item.sectionLabel === label)) {
    throw new Error("هذا الفصل موجود في الصف.");
  }
  const { infoRef } = tRakeezSchoolRef(schoolId);
  const snapshot = await getDoc(infoRef);
  const stored = snapshot.data()?.extraSections;
  const extras = Array.isArray(stored) ? stored.map(asExtra).filter((item): item is ExtraSection => item !== null) : [];
  const next = [...extras.filter((item) => !(item.gradeId === gradeId && item.label === label)), { gradeId, label }];
  await setDoc(infoRef, { extraSections: next }, { merge: true });
  replaceExtraSections(next);
  return next;
}
