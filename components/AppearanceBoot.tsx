"use client";

import { useEffect } from "react";
import { applyAppearance, readAppearance } from "@/lib/appearance";

export default function AppearanceBoot() {
  useEffect(() => {
    const saved = readAppearance();
    if (saved) applyAppearance(saved);
  }, []);

  return null;
}
