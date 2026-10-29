export const APPEARANCE_KEY = "rakeez-appearance";

export type ThemeColor = "blue" | "emerald" | "indigo" | "tiffany" | "cumin" | "pink";
export type BgStyle = "light" | "modern";

export interface Appearance {
  themeColor: ThemeColor;
  bgStyle: BgStyle;
}

export const THEME_OPTIONS: { id: ThemeColor; label: string; swatch: string }[] = [
  { id: "blue", label: "الأزرق الملكي (الرسمي)", swatch: "#2563eb" },
  { id: "emerald", label: "الأخضر الزمردي", swatch: "#059669" },
  { id: "indigo", label: "النيلي الداكن", swatch: "#4f46e5" },
  { id: "tiffany", label: "التيفاني", swatch: "#0ABAB5" },
  { id: "cumin", label: "الكموني", swatch: "#C4A265" },
  { id: "pink", label: "الوردي", swatch: "#E89BB5" },
];

const THEMES = new Set<ThemeColor>(THEME_OPTIONS.map((option) => option.id));
const BACKGROUNDS = new Set<BgStyle>(["light", "modern"]);

export function readAppearance(): Appearance | null {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Appearance>;
    if (!parsed.themeColor || !parsed.bgStyle) return null;
    if (!THEMES.has(parsed.themeColor) || !BACKGROUNDS.has(parsed.bgStyle)) return null;
    return { themeColor: parsed.themeColor, bgStyle: parsed.bgStyle };
  } catch {
    return null;
  }
}

export function applyAppearance(appearance: Appearance) {
  document.documentElement.dataset.theme = appearance.themeColor;
  document.documentElement.dataset.bg = appearance.bgStyle;
}

export function saveAppearance(appearance: Appearance) {
  applyAppearance(appearance);
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
}
