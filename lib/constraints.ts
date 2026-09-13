import fs from "fs";
import path from "path";
import { CONSTRAINTS_DIR } from "./paths";

export function loadConstraintPack(): string {
  const files = ["exam-blueprint.md", "subjects-vocab.md", "rubrics.md"];
  return files
    .map((name) => {
      const full = path.join(CONSTRAINTS_DIR, name);
      return fs.readFileSync(full, "utf8");
    })
    .join("\n\n---\n\n");
}
