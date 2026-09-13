import { makeId } from "../ids";
import type { BuildSentenceItem, DiscussionTask, EmailTask } from "../types";
import { cefrAllowed, type DifficultyBand } from "./difficulty";
import { contentKey, isSeenKey, isSeenText } from "./content-key";
import { seedKey } from "./grown-bank";
import { NeedMoreItems } from "./need-more";
import type { DiscussionSeed, EmailSeed, GrownBank, SentenceSeed } from "./seeds";
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
  {
    cefr: "A2",
    exchange: "A: The cafeteria card reader is broken.\nB:",
    tokens: ["You", "can", "pay", "with", "cash", "at", "the", "next", "register"],
    answer: ["You", "can", "pay", "with", "cash", "at", "the", "next", "register"],
    rationale: "A simple alternative answers the problem.",
  },
  {
    cefr: "B1",
    exchange: "A: I need a quiet place to record my presentation.\nB:",
    tokens: ["Try", "the", "media", "rooms", "behind", "the", "library", "cafe"],
    answer: ["Try", "the", "media", "rooms", "behind", "the", "library", "cafe"],
    rationale: "A specific campus location fits the request.",
  },
  {
    cefr: "A2",
    exchange: "A: Where do I pick up my student ID?\nB:",
    tokens: ["The", "card", "office", "is", "next", "to", "the", "bookstore"],
    answer: ["The", "card", "office", "is", "next", "to", "the", "bookstore"],
    rationale: "A location fact answers the question.",
  },
  {
    cefr: "B1",
    exchange: "A: My roommate is moving out next week.\nB:",
    tokens: ["You", "should", "tell", "housing", "before", "they", "assign", "someone", "new"],
    answer: ["You", "should", "tell", "housing", "before", "they", "assign", "someone", "new"],
    rationale: "Advice about a housing process is appropriate.",
  },
  {
    cefr: "A2",
    exchange: "A: Is there a bike rack near the science building?\nB:",
    tokens: ["There", "is", "one", "by", "the", "side", "entrance"],
    answer: ["There", "is", "one", "by", "the", "side", "entrance"],
    rationale: "A short location answer fits the question.",
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
  {
    cefr: "B1",
    scenario:
      "You have a clinic appointment during tomorrow's seminar. Write to your professor. Explain the conflict, ask whether you may submit the reflection online, and offer to meet in office hours.",
    audience: "Seminar professor",
    goal: "Request a short accommodation politely and offer a clear alternative.",
    sampleAnswer: `Dear Professor Patel,

I have a campus clinic appointment during tomorrow's seminar and will miss the in-class reflection. I do not want to fall behind on the weekly post.

Could I please submit the reflection online by tomorrow evening? I can also come to office hours this week if you would like me to catch up in person.

Thank you for your time.

Sincerely,
Alex Chen`,
  },
  {
    cefr: "B1",
    scenario:
      "The tech bar could not recover a file you need for a group poster. Write to your group. Explain what happened, say what you can still do tonight, and ask someone to bring the printed draft to the meeting.",
    audience: "Your project group",
    goal: "Report a problem, share a plan, and ask for one clear action.",
    sampleAnswer: `Hi everyone,

The tech bar could not recover the poster file, so I cannot edit the latest version on my laptop. I still have the notes and can finish the captions tonight.

Could someone please bring the printed draft to the meeting so we can mark changes on paper? I will arrive early and set up the table.

Thanks,
Alex`,
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
  {
    cefr: "B1",
    course: "First-Year Seminar 100",
    professor: {
      name: "Professor Hale",
      text: "Some clubs require a weekly meeting so members stay involved. Other students say required meetings keep busy people away. Should campus clubs require weekly meetings, or should they let members come when they can? Explain your view.",
    },
    students: [
      {
        name: "Nora",
        text: "I think a weekly meeting helps a club finish real work. If nobody has to come, the same three people do everything.",
      },
      {
        name: "Omar",
        text: "Required meetings can shut out students with jobs or labs. I would keep one optional meeting and use a group chat for updates.",
      },
    ],
    prompt: "Write a post with a clear opinion. You may agree with Nora or Omar, but add your own reason.",
  },
  {
    cefr: "B1",
    course: "Campus Wellness 110",
    professor: {
      name: "Professor Kim",
      text: "The recreation center can stay open later at night, or it can offer more short morning classes. The staff budget can support only one change this term. Which choice helps more students, and why?",
    },
    students: [
      {
        name: "Priya",
        text: "Later hours help students who have class all day. I would rather exercise at night than wake up earlier.",
      },
      {
        name: "Leo",
        text: "Morning classes are easier to staff, and they help people start the day. Late nights can also make the gym less safe.",
      },
    ],
    prompt: "Take a position and support it with campus-life reasons.",
  },
];

function writingExtras(
  extras: SentenceSeed[] | Pick<GrownBank, "sentences" | "emails" | "discussions"> | undefined,
): { sentences: SentenceSeed[]; emails: EmailSeed[]; discussions: DiscussionSeed[] } {
  if (!extras) return { sentences: [], emails: [], discussions: [] };
  if (Array.isArray(extras)) return { sentences: extras, emails: [], discussions: [] };
  return {
    sentences: extras.sentences || [],
    emails: extras.emails || [],
    discussions: extras.discussions || [],
  };
}

export function makeWritingBundle(
  band: DifficultyBand = "standard",
  extras: SentenceSeed[] | Pick<GrownBank, "sentences" | "emails" | "discussions"> = [],
  seen: Set<string> = new Set(),
  strict = false,
  _usedStems: Set<string> = new Set(),
) {
  const extra = writingExtras(extras);
  const allow = new Set(cefrAllowed(band));
  const unseen = (row: SentenceSeed) =>
    !isSeenKey(seen, seedKey("sentences", row)) && !isSeenKey(seen, contentKey(row.answer.join(" ")));
  const merged = [...extra.sentences].reverse().concat(SENTENCES);
  const usedExchanges = new Set<string>();
  const usedAnswers = new Set<string>();
  const sentencePool = merged.filter((row) => {
    if (!allow.has(row.cefr) || !unseen(row)) return false;
    const key = contentKey(row.exchange);
    const answer = contentKey(row.answer.join(" "));
    if (!key || usedExchanges.has(key) || !answer || usedAnswers.has(answer)) return false;
    usedExchanges.add(key);
    usedAnswers.add(answer);
    return true;
  });
  const emailPool = [...extra.emails, ...EMAILS].filter(
    (row) => allow.has(row.cefr) && !isSeenText(seen, row.scenario) && !isSeenKey(seen, seedKey("emails", row)),
  );
  const discussionPool = [...extra.discussions, ...DISCUSSIONS].filter(
    (row) =>
      allow.has(row.cefr) &&
      !isSeenText(seen, row.prompt) &&
      !isSeenKey(seen, seedKey("discussions", row)),
  );
  if (strict && sentencePool.length < 10) throw new NeedMoreItems("sentences");
  if (strict && emailPool.length === 0) throw new NeedMoreItems("email");
  if (strict && discussionPool.length === 0) throw new NeedMoreItems("discussion");
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
