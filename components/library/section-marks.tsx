import { enabledSections, normalizeScope } from "@/lib/scope";
import type { SectionName } from "@/lib/types";

export const SECTION_UI: Record<
  SectionName,
  { letter: string; name: string; tasks: string }
> = {
  reading: {
    letter: "R",
    name: "Reading",
    tasks: "Complete the words · Daily life · Academic passage",
  },
  listening: {
    letter: "L",
    name: "Listening",
    tasks: "Choose a response · Conversation · Announcement · Academic talk",
  },
  writing: {
    letter: "W",
    name: "Writing",
    tasks: "Build a sentence · Email · Academic discussion",
  },
  speaking: {
    letter: "S",
    name: "Speaking",
    tasks: "Listen and repeat · Interview",
  },
};

export const SECTION_ORDER: SectionName[] = ["reading", "listening", "writing", "speaking"];

export function sectionsFromScope(scope?: string[]) {
  return enabledSections(normalizeScope(scope));
}

export function SectionPills({
  included,
  showAll = true,
}: {
  included: SectionName[];
  showAll?: boolean;
}) {
  const list = showAll ? SECTION_ORDER : SECTION_ORDER.filter((section) => included.includes(section));
  return (
    <div className="section-pills" aria-label="Test sections on this paper">
      {list.map((section) => {
        const meta = SECTION_UI[section];
        const on = included.includes(section);
        return (
          <span
            key={section}
            className={`section-pill section-pill-${section}${on ? "" : " is-off"}`}
            title={on ? `${meta.name} is on this paper` : `${meta.name} is not on this paper`}
          >
            <span className="section-pill-letter">{meta.letter}</span>
            {meta.name}
          </span>
        );
      })}
    </div>
  );
}
