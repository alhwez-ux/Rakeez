"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getClassOptions, subscribeClassCatalog, type ClassOption } from "@/lib/classes";
import { addSchoolSection, loadExtraSections } from "@/lib/schoolClasses";

interface SchoolClassesValue {
  options: ClassOption[];
  ready: boolean;
  addSection: (gradeId: string, label: string) => Promise<void>;
}

const SchoolClassesContext = createContext<SchoolClassesValue | null>(null);

export function SchoolClassesProvider({
  schoolId,
  children,
}: {
  schoolId: string;
  children: React.ReactNode;
}) {
  const [options, setOptions] = useState<ClassOption[]>(() => getClassOptions());
  const [ready, setReady] = useState(false);

  useEffect(() => subscribeClassCatalog(() => setOptions(getClassOptions())), []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    loadExtraSections(schoolId)
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  const addSection = async (gradeId: string, label: string) => {
    await addSchoolSection(schoolId, gradeId, label);
  };

  return (
    <SchoolClassesContext.Provider value={{ options, ready, addSection }}>
      {children}
    </SchoolClassesContext.Provider>
  );
}

export function useSchoolClasses() {
  const value = useContext(SchoolClassesContext);
  if (!value) {
    return {
      options: getClassOptions(),
      ready: true,
      addSection: async () => {
        throw new Error("تعذر حفظ الفصل قبل فتح المدرسة.");
      },
    };
  }
  return value;
}
