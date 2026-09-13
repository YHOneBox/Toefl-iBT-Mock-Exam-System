import { makeId } from "../ids";
import type { BuildSentenceItem, DiscussionTask, EmailTask } from "../types";
import { cefrAllowed, type DifficultyBand } from "./difficulty";
import { fingerprint, seedKey } from "./grown-bank";
import type { SentenceSeed } from "./seeds";
import { pick, pickOne, shuffle } from "./util";

const SENTENCES: Array<Omit<BuildSentenceItem, "id" | "taskType">> = [
  {
    cefr: "A2",
    exchange: "A: The printer on the second floor is jammed.\nB:",
    tokens: ["I", "will", "report", "it", "to", "the", "tech", "bar"],
    answer: ["I", "will", "report", "it", "to", "the", "tech", "bar"],
    rationale: "A future offer to report the problem is grammatical and fits the context.",
  },
  {
    cefr: "B1",
    exchange: "A: Can we move tonight's review to the library?\nB:",
    tokens: ["Yes", "if", "the", "group", "study", "room", "is", "still", "available"],
    answer: ["Yes", "if", "the", "group", "study", "room", "is", "still", "available"],
    rationale: "A conditional agreement matches the request.",
  },
  {
    cefr: "B1",
    exchange: "A: I missed the announcement about the shuttle.\nB:",
    tokens: ["It", "will", "leave", "from", "the", "rec", "center", "instead"],
    answer: ["It", "will", "leave", "from", "the", "rec", "center", "instead"],
    rationale: "This reports the changed pickup point.",
  },
  {
    cefr: "A2",
    exchange: "A: Do you have an extra lab coat?\nB:",
    tokens: ["You", "can", "borrow", "mine", "until", "the", "session", "ends"],
    answer: ["You", "can", "borrow", "mine", "until", "the", "session", "ends"],
    rationale: "An offer with a time limit is appropriate.",
  },
  {
    cefr: "B2",
    exchange: "A: The club budget was reduced.\nB:",
    tokens: ["We", "should", "scale", "the", "event", "rather", "than", "cancel", "it"],
    answer: ["We", "should", "scale", "the", "event", "rather", "than", "cancel", "it"],
    rationale: "A practical recommendation fits a budget cut.",
  },
  {
    cefr: "A2",
    exchange: "A: Is the writing center open now?\nB:",
    tokens: ["It", "opens", "after", "lunch", "on", "Fridays"],
    answer: ["It", "opens", "after", "lunch", "on", "Fridays"],
    rationale: "A schedule fact answers the question.",
  },
  {
    cefr: "B1",
    exchange: "A: I cannot find my ID.\nB:",
    tokens: ["Check", "the", "lost", "and", "found", "desk", "first"],
    answer: ["Check", "the", "lost", "and", "found", "desk", "first"],
    rationale: "An imperative suggestion is natural here.",
  },
  {
    cefr: "B2",
    exchange: "A: Should we cite the lecture or the article?\nB:",
    tokens: ["Cite", "the", "article", "and", "mention", "the", "lecture", "as", "background"],
    answer: ["Cite", "the", "article", "and", "mention", "the", "lecture", "as", "background"],
    rationale: "This distinguishes a citable source from background.",
  },
  {
    cefr: "B1",
    exchange: "A: The dorm kitchen is closed tonight.\nB:",
    tokens: ["Then", "we", "can", "eat", "at", "East", "Hall", "instead"],
    answer: ["Then", "we", "can", "eat", "at", "East", "Hall", "instead"],
    rationale: "A consequence plus alternative is coherent.",
  },
  {
    cefr: "C1",
    exchange: "A: The survey results are mixed.\nB:",
    tokens: ["We", "should", "present", "both", "patterns", "before", "drawing", "a", "conclusion"],
    answer: ["We", "should", "present", "both", "patterns", "before", "drawing", "a", "conclusion"],
    rationale: "Cautious academic advice fits mixed data.",
  },
  {
    cefr: "A2",
    exchange: "A: Thanks for saving me a seat.\nB:",
    tokens: ["No", "problem", "the", "room", "filled", "up", "quickly"],
    answer: ["No", "problem", "the", "room", "filled", "up", "quickly"],
    rationale: "A casual acknowledgment plus reason is natural.",
  },
  {
    cefr: "B1",
    exchange: "A: I submitted the form twice.\nB:",
    tokens: ["Email", "the", "registrar", "and", "ask", "them", "to", "delete", "the", "duplicate"],
    answer: ["Email", "the", "registrar", "and", "ask", "them", "to", "delete", "the", "duplicate"],
    rationale: "A clear next action solves the error.",
  },
];

const EMAILS: Array<Omit<EmailTask, "id" | "taskType">> = [
  {
    cefr: "B1",
    scenario:
      "You reserved a study room for your group, but two members now have a makeup exam at that time. Write to the library desk. Explain the conflict, ask whether you can change the reservation to Friday evening, and thank them.",
    audience: "Library reservations desk",
    goal: "Request a reservation change politely and clearly.",
    sampleAnswer: `Dear Reservations Staff,

I reserved a study room for my group, but two members now have a makeup exam at that same time. We still need a quiet place to meet this week.

Could we please change the reservation to Friday evening if a room is available? If Friday evening is full, another evening this week would also work.

Thank you for your help.

Sincerely,
Alex Chen`,
  },
  {
    cefr: "B2",
    scenario:
      "A campus shuttle skipped your stop twice this week, and you were late to lab. Write to transportation services. Describe what happened, explain the impact, and ask what you should do next time the bus does not arrive.",
    audience: "Campus transportation services",
    goal: "Report a problem and request guidance without being rude.",
    sampleAnswer: `Dear Transportation Services,

A campus shuttle skipped my stop twice this week, and I was late to lab both times. I waited at the usual stop and the bus did not arrive.

Could you please tell me what I should do the next time the bus does not come? I also want to make sure my late arrival is recorded correctly if that is possible.

Thank you for your time.

Sincerely,
Alex Chen`,
  },
  {
    cefr: "B1",
    scenario:
      "You cannot attend the club's Saturday hike because of a family visit. Write to the club leader. Decline politely, suggest another member take your van seat, and offer to help with sign-in next week.",
    audience: "Club leader",
    goal: "Refuse an activity while remaining helpful and polite.",
    sampleAnswer: `Dear Club Leader,

I am sorry that I cannot attend the Saturday hike. I have a family visit that day and will be off campus.

Another member can take my van seat so the group is not short a place. I can also help with sign-in next week if that would be useful.

Thank you for organizing the trip, and I hope everyone has a good hike.

Sincerely,
Alex Chen`,
  },
];

const DISCUSSIONS: Array<Omit<DiscussionTask, "id" | "taskType">> = [
  {
    cefr: "B2",
    course: "Urban Studies 210",
    professor: {
      name: "Professor Okonkwo",
      text: "Some cities add parks to improve well-being, but new green space can also raise nearby housing costs. Should city governments prioritize new parks in neighborhoods that currently have few, even if that risks later displacement? Explain your view.",
    },
    students: [
      {
        name: "Lina",
        text: "I think the first step should be parks in underserved neighborhoods. Health benefits matter now, and cities can add rent support if prices rise.",
      },
      {
        name: "Mateo",
        text: "I worry that parks without housing policy just push people out. I would improve existing small spaces first and protect tenants at the same time.",
      },
    ],
    prompt: "Write a post that takes a clear position and supports it with reasons. You may respond to Lina or Mateo, but add your own ideas.",
  },
  {
    cefr: "B2",
    course: "Environmental Science 101",
    professor: {
      name: "Professor Berg",
      text: "Individual actions such as shorter showers are easy to advertise, but industrial and transport systems produce a large share of emissions. Where should public campaigns focus if the goal is meaningful climate progress?",
    },
    students: [
      {
        name: "Asha",
        text: "Personal habits still matter because they build support for bigger laws. People who change daily routines may also vote for stronger rules.",
      },
      {
        name: "Kenji",
        text: "I think campaigns should target companies and infrastructure. Individual guilt can distract from the systems that set most of the emissions.",
      },
    ],
    prompt: "Contribute to the discussion with a clear, elaborated opinion.",
  },
];

export function makeWritingBundle(
  band: DifficultyBand = "standard",
  extras: SentenceSeed[] = [],
  seen: Set<string> = new Set(),
) {
  const allow = new Set(cefrAllowed(band));
  const unseen = (row: SentenceSeed) => !seen.has(seedKey("sentences", row));
  const merged = [...extras].reverse().concat(SENTENCES);
  const sentencePool = merged.filter((row) => allow.has(row.cefr) && unseen(row));
  const emailPool = EMAILS.filter((row) => allow.has(row.cefr) && !seen.has(fingerprint(row.scenario)));
  const discussionPool = DISCUSSIONS.filter(
    (row) => allow.has(row.cefr) && !seen.has(fingerprint(row.prompt)),
  );
  return {
    sentences: (sentencePool.length >= 10 ? sentencePool.slice(0, 10) : pick(merged, 10)).map((row) => ({
      ...row,
      id: makeId("sent"),
      taskType: "build_sentence" as const,
      tokens: shuffle([...row.tokens]),
    })),
    email: { ...(pickOne(emailPool.length ? emailPool : EMAILS)), id: makeId("email"), taskType: "write_email" as const },
    discussion: {
      ...(pickOne(discussionPool.length ? discussionPool : DISCUSSIONS)),
      id: makeId("disc"),
      taskType: "write_discussion" as const,
    },
  };
}
