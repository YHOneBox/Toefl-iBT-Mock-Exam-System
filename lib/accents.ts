import type { Accent } from "./types";

export const ACCENTS: Accent[] = ["us", "uk", "au"];

export const ACCENT_LABEL: Record<Accent, string> = {
  us: "US",
  uk: "UK",
  au: "Australia",
};

export const ACCENT_GENDER_PAIRS: Array<{ accent: Accent; gender: "male" | "female" }> = [
  { accent: "us", gender: "female" },
  { accent: "us", gender: "male" },
  { accent: "uk", gender: "female" },
  { accent: "uk", gender: "male" },
  { accent: "au", gender: "female" },
  { accent: "au", gender: "male" },
];

export function langForAccent(accent: Accent) {
  if (accent === "uk") return "en-GB";
  if (accent === "au") return "en-AU";
  return "en-US";
}

export function accentLangPrefixes(accent: Accent): string[] {
  if (accent === "uk") return ["en-gb", "en-ie"];
  if (accent === "au") return ["en-au", "en-nz"];
  return ["en-us", "en-ca"];
}

export function emptyAccentMap(): Record<Accent, string> {
  return { us: "", uk: "", au: "" };
}
