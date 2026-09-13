import { makeId } from "../ids";
import { ACCENT_GENDER_PAIRS } from "../accents";
import type { Accent, ListenChooseItem, ModuleTag, SpokenSet } from "../types";
import { audio, joinScript, mcq, pick, pickOne } from "./util";

const CHOOSE: Array<Omit<ListenChooseItem, "id" | "module" | "taskType" | "audio"> & { script: string; accent?: Accent }> = [
  {
    cefr: "A2",
    skill: "social response",
    script: "Did you happen to grab an extra syllabus from the lecture?",
    options: [
      "Yes, I picked up one for you.",
      "The lecture is in the science building.",
      "I do not think the printer is working.",
      "You can sit anywhere you like.",
    ],
    answerKey: 0,
    rationale: "The speaker asks if an extra syllabus was taken, so offering it is the fit response.",
  },
  {
    cefr: "A2",
    skill: "social response",
    script: "The registration site just closed. Do you know another way to add the class?",
    options: [
      "I already finished my homework.",
      "You could ask the department office tomorrow morning.",
      "The library is open until nine.",
      "That class has no textbook.",
    ],
    answerKey: 1,
    rationale: "The problem is adding a closed class; the office is a realistic next step.",
  },
  {
    cefr: "B1",
    skill: "social response",
    script: "I left my student ID in the dining hall. Any chance you are heading that way?",
    options: [
      "The dining hall serves pizza on Fridays.",
      "I can check the lost-and-found desk for you.",
      "IDs are required in the library.",
      "You should change your password.",
    ],
    answerKey: 1,
    rationale: "Offering to check lost-and-found answers the implied request for help.",
  },
  {
    cefr: "B1",
    skill: "social response",
    script: "Would you mind if we moved the study session to the quieter room upstairs?",
    options: [
      "Sure, that sounds better for concentrating.",
      "The assignment is due next month.",
      "I already returned my book.",
      "Quiet rooms do not have windows.",
    ],
    answerKey: 0,
    rationale: "The question asks permission to relocate; agreeing addresses it.",
  },
  {
    cefr: "A2",
    skill: "social response",
    script: "Is this seat taken?",
    options: [
      "No, go ahead and sit down.",
      "The lecture starts at two.",
      "I need to print this later.",
      "Seats are cheaper online.",
    ],
    answerKey: 0,
    rationale: "A simple yes/no seat question is answered by offering the seat.",
  },
  {
    cefr: "B1",
    skill: "social response",
    script: "I cannot hear the announcement. Did they say the shuttle is delayed?",
    options: [
      "Yes, it will leave about fifteen minutes late.",
      "Shuttles are painted green this year.",
      "You should buy a semester pass.",
      "The stop is near the bookstore.",
    ],
    answerKey: 0,
    rationale: "The listener wants confirmation of a delay.",
  },
  {
    cefr: "B2",
    skill: "social response",
    script: "I was supposed to meet Professor Hale, but I think I mixed up the office hours.",
    options: [
      "You might check the note on her door or email her.",
      "Office hours are always in the gym.",
      "Professors do not read email.",
      "The building closes at sunrise.",
    ],
    answerKey: 0,
    rationale: "Suggesting the door note or email is a practical response to a schedule mix-up.",
  },
  {
    cefr: "A2",
    skill: "social response",
    script: "Could you turn the volume down a bit? I am trying to finish this reading.",
    options: [
      "Sorry about that. I will use headphones.",
      "Reading is part of the exam.",
      "The volume buttons are broken on campus.",
      "You should sit farther from the window.",
    ],
    answerKey: 0,
    rationale: "An apology plus headphones addresses the request.",
  },
  {
    cefr: "B1",
    skill: "social response",
    script: "Do you know if the wellness walk is still happening after the rain?",
    options: [
      "They posted that it moved to the indoor track.",
      "Wellness walks require a lab coat.",
      "Rain makes the cafeteria cheaper.",
      "You already missed registration.",
    ],
    answerKey: 0,
    rationale: "The asker wants the status of the event; the indoor track answers it.",
  },
  {
    cefr: "B2",
    skill: "social response",
    script: "I agreed to present first, but I am not sure I can cover the whole chapter.",
    options: [
      "We can split the chapter and you take the opening section.",
      "Chapters are always short in this course.",
      "Presentations cannot be divided.",
      "You should drop the class today.",
    ],
    answerKey: 0,
    rationale: "Offering to split the work responds to the worry.",
  },
  {
    cefr: "A2",
    skill: "social response",
    script: "Excuse me, which way is the registrar?",
    options: [
      "Go past the fountain and it is on the left.",
      "Registration ended last year.",
      "The registrar does not have a door.",
      "You need a lab notebook.",
    ],
    answerKey: 0,
    rationale: "A directions question needs a location answer.",
  },
  {
    cefr: "B1",
    skill: "social response",
    script: "I brought the wrong notebook. Can I photo a few of your pages?",
    options: [
      "Yes, just avoid the personal notes in the back.",
      "Notebooks are sold at the gym.",
      "Photography is the final exam topic.",
      "You should buy a printer first.",
    ],
    answerKey: 0,
    rationale: "Permission with a small condition fits the request.",
  },
  {
    cefr: "B1",
    skill: "social response",
    script: "The group chat says the quiz is open-book. Is that what you heard?",
    options: [
      "That matches what the instructor said this morning.",
      "Group chats cannot mention quizzes.",
      "Open-book means no lecture.",
      "The quiz was canceled last semester.",
    ],
    answerKey: 0,
    rationale: "The speaker wants confirmation; agreeing with a source answers it.",
  },
  {
    cefr: "A2",
    skill: "social response",
    script: "Are you using this printer, or can I send my file?",
    options: [
      "I am done. Go ahead.",
      "Printers need a password from the dean.",
      "Files cannot be sent on campus.",
      "The library closed at noon forever.",
    ],
    answerKey: 0,
    rationale: "The question is whether the printer is free.",
  },
  {
    cefr: "B2",
    skill: "social response",
    script: "I might have to miss lab because my bus was canceled. Should I email the TA now?",
    options: [
      "Yes, write now and ask about a make-up time.",
      "TAs never read messages.",
      "Labs cannot be missed for any reason, so do nothing.",
      "The bus will arrive yesterday.",
    ],
    answerKey: 0,
    rationale: "Emailing promptly is the appropriate next action.",
  },
  {
    cefr: "B1",
    skill: "social response",
    script: "Want to grab coffee after we return these books?",
    options: [
      "Sure, the cafe next to the library works.",
      "Books cannot be returned today.",
      "Coffee is part of the midterm.",
      "The cafe only sells notebooks.",
    ],
    answerKey: 0,
    rationale: "Accepting and naming a place answers the invitation.",
  },
  {
    cefr: "A2",
    skill: "social response",
    script: "Is the computer lab locked on Sundays?",
    options: [
      "It stays open, but you will need your ID to enter.",
      "Sunday is only for faculty parking.",
      "Labs never have computers.",
      "You should wait until winter.",
    ],
    answerKey: 0,
    rationale: "The answer gives Sunday access information.",
  },
  {
    cefr: "B2",
    skill: "social response",
    script: "I thought the film screening was tonight, but the poster says tomorrow. Did they change it?",
    options: [
      "Yes, they moved it because the room was double-booked.",
      "Posters cannot be printed in color.",
      "Film screenings are always at dawn.",
      "You already bought the wrong textbook.",
    ],
    answerKey: 0,
    rationale: "Confirming a schedule change answers the confusion.",
  },
  {
    cefr: "B1",
    skill: "social response",
    script: "Could you save me a seat if the workshop fills up before I get there?",
    options: [
      "I can, but I will text you if they stop holding places.",
      "Workshops do not have seats.",
      "You should skip the workshop.",
      "The building has no doors.",
    ],
    answerKey: 0,
    rationale: "Agreeing with a practical condition fits the request.",
  },
  {
    cefr: "A2",
    skill: "social response",
    script: "Do we need the textbook in class today?",
    options: [
      "No, just bring the handout from yesterday.",
      "Textbooks are banned on campus.",
      "Class was canceled last year.",
      "The handout is written in code.",
    ],
    answerKey: 0,
    rationale: "The question is about what to bring.",
  },
  {
    cefr: "C1",
    skill: "social response",
    script: "If the committee rejects our club budget, should we scale the event or postpone it?",
    options: [
      "Let us draft both a smaller plan and a later date, then decide after we hear from them.",
      "Committees always approve every budget.",
      "Club events cannot change once proposed.",
      "You should ignore the committee.",
    ],
    answerKey: 0,
    rationale: "A nuanced plan treats both options as possible until news arrives.",
  },
];

function chooseItems(n: number, module: ModuleTag, _accents: Accent[], cefrList?: string[]): ListenChooseItem[] {
  const pool = cefrList?.length ? CHOOSE.filter((row) => cefrList.includes(row.cefr)) : CHOOSE;
  const source = pool.length >= n ? pool : CHOOSE;
  return pick(source, n).map((row, i) => ({
    id: makeId("lcr"),
    taskType: "listen_choose_response" as const,
    module,
    cefr: row.cefr,
    skill: row.skill,
    audio: audio(
      row.script,
      ACCENT_GENDER_PAIRS[i % ACCENT_GENDER_PAIRS.length].accent,
      ACCENT_GENDER_PAIRS[i % ACCENT_GENDER_PAIRS.length].gender,
    ),
    options: row.options,
    answerKey: row.answerKey,
    rationale: row.rationale,
  }));
}

type SpokenSeed = Omit<SpokenSet, "id" | "module" | "audio">;

const CONVERSATIONS: SpokenSeed[] = [
  {
    taskType: "listen_conversation",
    cefr: "B1",
    topic: "Campus life",
    title: "Group project meeting",
    speakers: [
      { id: "a", label: "Woman", gender: "female", accent: "us" },
      { id: "b", label: "Man", gender: "male", accent: "uk" },
    ],
    script: [
      { speakerId: "a", text: "Have you started the slides for Thursday's presentation?" },
      { speakerId: "b", text: "I drafted the outline, but the data from the survey is still messy." },
      { speakerId: "a", text: "If you send me the raw file tonight, I can clean the charts." },
      { speakerId: "b", text: "That would help. I have a lab report due tomorrow morning." },
      { speakerId: "a", text: "Okay. Let us meet at the tech bar at six to put it together." },
    ],
    questions: [
      mcq("What is the woman offering to do?", ["Write the lab report", "Clean the survey charts", "Cancel Thursday", "Book the tech bar forever"], 1, "She offers to clean the charts if she gets the file.", "factual", "B1"),
      mcq("Why is the man short on time?", ["He has a lab report due", "He is presenting alone", "The tech bar is closed", "The survey was canceled"], 0, "He mentions a lab report due tomorrow morning.", "factual", "B1"),
    ],
  },
  {
    taskType: "listen_conversation",
    cefr: "A2",
    topic: "Campus life",
    title: "Dining plans",
    speakers: [
      { id: "a", label: "Man", gender: "male", accent: "au" },
      { id: "b", label: "Woman", gender: "female", accent: "us" },
    ],
    script: [
      { speakerId: "a", text: "Need anything from the market? I can go after class." },
      { speakerId: "b", text: "Are we not leaving for the play soon?" },
      { speakerId: "a", text: "That is tomorrow. Tonight we still have to cook." },
      { speakerId: "b", text: "Right. Then yes, get rice and the sauce we used last week." },
    ],
    questions: [
      mcq("When is the play?", ["Tonight", "Tomorrow", "After class today", "Last week"], 1, "The man says the play is tomorrow.", "factual", "A2"),
      mcq("What does the woman want from the market?", ["Tickets", "Rice and sauce", "A textbook", "Coffee only"], 1, "She asks for rice and the sauce.", "factual", "A2"),
    ],
  },
  {
    taskType: "listen_conversation",
    cefr: "B2",
    topic: "Campus life",
    title: "Housing repair",
    speakers: [
      { id: "a", label: "Woman", gender: "female", accent: "uk" },
      { id: "b", label: "Man", gender: "male", accent: "us" },
    ],
    script: [
      { speakerId: "a", text: "Housing said they would fix the heater, but nobody came yesterday." },
      { speakerId: "b", text: "Did you file the request through the portal or just email the RA?" },
      { speakerId: "a", text: "Only the RA. I thought that was enough." },
      { speakerId: "b", text: "They usually wait for a ticket number. Submit it online and mention the cold nights." },
    ],
    questions: [
      mcq("What is the woman's problem?", ["She lost her portal password", "The heater was not repaired", "The RA moved out", "She missed a class"], 1, "Nobody came to fix the heater.", "main idea", "B2"),
      mcq("What does the man suggest?", ["Call the police", "Submit an online ticket", "Buy a new heater", "Wait until spring"], 1, "He says they wait for a ticket number.", "purpose", "B2"),
    ],
  },
  {
    taskType: "listen_conversation",
    cefr: "B1",
    topic: "Campus life",
    title: "Club table",
    speakers: [
      { id: "a", label: "Man", gender: "male", accent: "us" },
      { id: "b", label: "Woman", gender: "female", accent: "au" },
    ],
    script: [
      { speakerId: "a", text: "Can you cover the club table at noon? I have a makeup quiz." },
      { speakerId: "b", text: "I can do forty minutes, but I have lab at twelve forty-five." },
      { speakerId: "a", text: "That works. I will be back before then." },
      { speakerId: "b", text: "Bring the sign-up sheet. People keep asking about the urban garden trip." },
    ],
    questions: [
      mcq("Why does the man need help?", ["He has a makeup quiz", "The club was canceled", "He does not know the campus", "The garden trip is full"], 0, "He has a makeup quiz at noon.", "factual", "B1"),
      mcq("What will the woman need at the table?", ["Lab goggles", "The sign-up sheet", "A quiz booklet", "Bus tickets"], 1, "She asks him to bring the sign-up sheet.", "factual", "B1"),
    ],
  },
];

const ANNOUNCEMENTS: SpokenSeed[] = [
  {
    taskType: "listen_announcement",
    cefr: "B1",
    topic: "Campus life",
    title: "Library closure",
    speakers: [{ id: "n", label: "Announcer", gender: "female", accent: "us" }],
    script: [
      {
        speakerId: "n",
        text: "Attention students. The main library will close at four today because of a water leak on the third floor. Course reserves have been moved to the first-floor desk. The twenty-four-hour study room in the student center remains open. Updates will be posted on the library website.",
      },
    ],
    questions: [
      mcq("Why is the library closing early?", ["A scheduled holiday", "A water leak", "An exam lock-down", "A power upgrade"], 1, "A water leak on the third floor is the reason.", "factual", "B1"),
      mcq("Where can students still study late?", ["The third floor", "The student-center study room", "The parking garage", "The dining hall kitchen"], 1, "The twenty-four-hour room in the student center stays open.", "factual", "B1"),
    ],
  },
  {
    taskType: "listen_announcement",
    cefr: "A2",
    topic: "Campus life",
    title: "Shuttle change",
    speakers: [{ id: "n", label: "Announcer", gender: "male", accent: "uk" }],
    script: [
      {
        speakerId: "n",
        text: "The campus shuttle will not stop at East Dorm this week while the road is repaired. Please use the rec-center stop, a five-minute walk away. Evening buses after eight will run every thirty minutes instead of every twenty. Drivers will not wait for late passengers.",
      },
    ],
    questions: [
      mcq("Where should East Dorm riders wait?", ["At East Dorm as usual", "At the rec-center stop", "At the library only", "At the repair site"], 1, "They should use the rec-center stop.", "factual", "A2"),
      mcq("How do evening buses change?", ["They stop running", "They come less often", "They become free", "They wait longer"], 1, "After eight they run every thirty minutes instead of twenty.", "factual", "A2"),
    ],
  },
  {
    taskType: "listen_announcement",
    cefr: "B2",
    topic: "Campus life",
    title: "Art contest",
    speakers: [{ id: "n", label: "Announcer", gender: "female", accent: "au" }],
    script: [
      {
        speakerId: "n",
        text: "The student art contest deadline is Friday at noon. Submit digital files through the arts portal, not by email. Printed work can be dropped at the gallery office with a completed form. Winners will be announced at the Saturday reception, and all entries will stay on display through midterms.",
      },
    ],
    questions: [
      mcq("How should digital work be submitted?", ["By campus email", "Through the arts portal", "On a USB at the rec center", "On social media"], 1, "Digital files go through the arts portal, not email.", "factual", "B2"),
      mcq("What happens after the deadline?", ["Entries are returned immediately", "Work is shown through midterms", "The gallery closes", "Only winners may attend Saturday"], 1, "All entries stay on display through midterms.", "factual", "B2"),
    ],
  },
];

const TALKS: SpokenSeed[] = [
  {
    taskType: "listen_academic_talk",
    cefr: "B2",
    topic: "Life Sciences",
    title: "Rainforest homeostasis",
    speakers: [{ id: "p", label: "Professor", gender: "female", accent: "us" }],
    script: [
      {
        speakerId: "p",
        text: "Today I want to talk about how rainforests help keep a local climate relatively stable. Dense canopies intercept rainfall and slow it down, so water reaches the soil more gently and less of it runs off. Roots and fungi then hold moisture and recycle nutrients. Transpiration from leaves returns water vapor to the air, which can fall again as rain. This cycle is one reason the forest can sustain itself even during short dry spells. However, if a large area is cleared, the cycle weakens. Less moisture returns to the air, soils dry faster, and nearby remaining forest becomes more vulnerable. So when we talk about deforestation, we are not only losing trees. We are changing a system that regulates heat and water. That is why conservation plans now look at whole landscapes, not single groves.",
      },
    ],
    questions: [
      mcq("What is the talk mainly about?", ["How to plant a garden", "How rainforests help regulate local climate", "Why fungi are rare in soil", "How heat is measured"], 1, "The professor explains the water cycle and stability of rainforest climate.", "main idea", "B2"),
      mcq("What do canopies do in the talk?", ["They intercept and slow rainfall", "They remove fungi from soil", "They increase runoff", "They stop transpiration"], 0, "Dense canopies intercept rainfall and slow it.", "factual", "B2"),
      mcq("What can be inferred after large clearing?", ["The remaining forest may dry more easily", "Rain immediately increases", "Nutrients become unlimited", "Heat regulation improves"], 0, "The cycle weakens and remaining forest becomes more vulnerable.", "inference", "B2"),
      mcq("Why does the professor mention whole landscapes?", ["To argue that single groves are enough", "To show conservation should consider the wider system", "To compare cities and farms only", "To deny that trees matter"], 1, "Plans look at landscapes because the regulating system is larger than one grove.", "purpose", "B2"),
    ],
  },
  {
    taskType: "listen_academic_talk",
    cefr: "C1",
    topic: "Business",
    title: "Taylor and factory time",
    speakers: [{ id: "p", label: "Professor", gender: "male", accent: "uk" }],
    script: [
      {
        speakerId: "p",
        text: "Frederick Winslow Taylor is often remembered for timing factory tasks with a stopwatch. The goal was to break work into small motions and find the most efficient way to do each one. Supporters said this raised output and made wages more predictable. Critics argued that it treated workers as machines and ignored skill that could not be easily measured. What I want you to notice is the lasting idea, not the stopwatch itself. Modern warehouses still divide tasks, track time, and reward speed. At the same time, many firms now talk about worker well-being because extreme efficiency can increase errors and turnover. So Taylor’s influence is mixed. We inherited tools for measuring work, and we also inherited a debate about what those measurements leave out.",
      },
    ],
    questions: [
      mcq("What was Taylor trying to do?", ["Eliminate factory wages", "Find efficient motions for each task", "Replace stopwatches with computers", "End warehouse tracking"], 1, "He broke work into motions to find an efficient method.", "factual", "C1"),
      mcq("What did critics claim?", ["Output never increased", "Skill was ignored and workers were treated like machines", "Wages became unpredictable", "Stopwatches were inaccurate"], 1, "Critics said it treated workers as machines and ignored unmeasured skill.", "factual", "C1"),
      mcq("Why does the professor mention modern warehouses?", ["To show the core idea still exists", "To prove Taylor has no influence", "To describe a different century only", "To praise extreme speed without limits"], 0, "Warehouses still divide tasks and track time.", "method", "C1"),
      mcq("What is the professor's attitude toward Taylor's legacy?", ["Entirely positive", "Entirely negative", "Mixed, with tools and a debate", "Uninterested"], 2, "The influence is described as mixed.", "attitude", "C1"),
    ],
  },
  {
    taskType: "listen_academic_talk",
    cefr: "B2",
    topic: "Art and Architecture",
    title: "Public monuments",
    speakers: [{ id: "p", label: "Professor", gender: "female", accent: "au" }],
    script: [
      {
        speakerId: "p",
        text: "Public monuments do more than remember a person. They also shape how people move through a city. A statue in a square can become a meeting point, a protest site, or simply a landmark for giving directions. When values change, the same object can feel welcoming to some residents and painful to others. Cities then face a practical question: keep, relocate, or reinterpret the monument with new plaques and context. None of those choices is only about art. Each one changes the story a public space tells. I want you to look at your own campus memorials with that in mind. Who is centered, who is missing, and how does the design invite people to gather or keep walking?",
      },
    ],
    questions: [
      mcq("What is the main idea?", ["Monuments are only artistic objects", "Monuments influence memory and how people use public space", "Statues should always be removed", "Campus maps do not need landmarks"], 1, "Monuments shape movement, gathering, and public stories.", "main idea", "B2"),
      mcq("What practical options does the professor list?", ["Keep, relocate, or reinterpret", "Sell, hide, or ignore", "Paint, bury, or copy", "Only build new squares"], 0, "Keep, relocate, or reinterpret with new context.", "factual", "B2"),
      mcq("What can be inferred about changing values?", ["Everyone will interpret a monument the same way", "The same monument can be welcomed by some and painful to others", "Plaques never change meaning", "Design cannot affect gathering"], 1, "The talk says the same object can feel different as values change.", "inference", "B2"),
      mcq("Why does the professor mention campus memorials?", ["To assign a field trip downtown", "To have students apply the idea locally", "To argue that campuses have no monuments", "To end the lecture early"], 1, "Students are asked to look at campus memorials with the same questions.", "purpose", "B2"),
    ],
  },
];

function toSpoken(seed: SpokenSeed, module: ModuleTag, salt = 0): SpokenSet {
  const maleAccents: Accent[] = ["us", "uk", "au"];
  const femaleAccents: Accent[] = ["au", "us", "uk"];
  const speakers = seed.speakers.map((s, i) => ({
    id: s.id,
    label: s.label,
    gender: s.gender,
    accent: s.gender === "male" ? maleAccents[(salt + i) % 3] : femaleAccents[(salt + i) % 3],
  }));
  return {
    ...seed,
    id: makeId("spk"),
    module,
    speakers,
    questions: seed.questions.map((q) => ({ ...q, id: makeId("q") })),
    audio: audio(joinScript(seed.script, speakers), speakers[0]?.accent || "us", speakers[0]?.gender || "female"),
  };
}

export function listeningBundleFor(
  module: ModuleTag,
  spec: { choose: number; conversations: number; announcements: number; talks: number },
  opts: boolean | { hard?: boolean; band?: "easier" | "standard" | "harder" } = false,
) {
  const hard = typeof opts === "boolean" ? opts : Boolean(opts.hard || opts.band === "harder");
  const band = typeof opts === "boolean" ? (opts ? "harder" : "standard") : opts.band || (hard ? "harder" : "standard");
  const accents: Accent[] = ["us", "uk", "au"];
  const convPool =
    band === "easier"
      ? CONVERSATIONS.filter((c) => c.cefr === "A2" || c.cefr === "B1")
      : hard
        ? CONVERSATIONS.filter((c) => c.cefr !== "A2")
        : CONVERSATIONS;
  const talkPool =
    band === "easier"
      ? TALKS.filter((t) => t.cefr !== "C1")
      : hard
        ? TALKS.filter((t) => t.cefr !== "B1")
        : TALKS;
  const chooseCefr = band === "easier" ? ["A2", "B1"] : band === "harder" ? ["B1", "B2", "C1"] : undefined;
  return {
    choose: chooseItems(spec.choose, module, accents, chooseCefr),
    conversations: pick(convPool.length ? convPool : CONVERSATIONS, spec.conversations).map((s, i) =>
      toSpoken(s, module, i),
    ),
    announcements: pick(ANNOUNCEMENTS, spec.announcements).map((s, i) => toSpoken(s, module, i + 1)),
    talks: pick(talkPool.length ? talkPool : TALKS, spec.talks).map((s, i) => toSpoken(s, module, i + 2)),
  };
}

export function pickAccent(): Accent {
  return pickOne(["us", "uk", "au"] as Accent[]);
}
