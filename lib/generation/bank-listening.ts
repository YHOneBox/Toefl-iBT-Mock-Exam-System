import { makeId } from "../ids";
import { ACCENT_GENDER_PAIRS } from "../accents";
import { splitSentences } from "../passage";
import type { Accent, ListenChooseItem, ModuleTag, SpokenSet } from "../types";
import type { DifficultyBand } from "./difficulty";
import { contentKey, isSeenKey, spokenAudioKeys, spokenJoinKey } from "./content-key";
import { NeedMoreItems } from "./need-more";
import type { ChooseSeed, SpokenSeed } from "./seeds";
import { audio, joinScript, mcq, pick, pickOne } from "./util";

const CHOOSE: ChooseSeed[] = [
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
  {
    cefr: "A2",
    skill: "social response",
    script: "Is the wellness center still taking walk-ins this afternoon?",
    options: [
      "Yes, until four, but you should sign in at the front desk first.",
      "The wellness center only sells textbooks.",
      "Walk-ins are never allowed on campus.",
      "You already missed graduation.",
    ],
    answerKey: 0,
    rationale: "The speaker wants current walk-in information.",
  },
  {
    cefr: "B1",
    skill: "social response",
    script: "I left my student ID in the lab. Can you tell the staff I will come back after lunch?",
    options: [
      "I will let them know, but they may still hold it at the office.",
      "Student IDs cannot be used on campus.",
      "The lab is closed forever.",
      "You should buy a new building.",
    ],
    answerKey: 0,
    rationale: "Passing on a message and a practical next step fits.",
  },
  {
    cefr: "B2",
    skill: "social response",
    script: "If office hours are full, is it better to email the professor or join the wait list on the door?",
    options: [
      "Put your name on the wait list, then send a short email so she has the question in writing.",
      "Office hours are only for staff.",
      "You should skip the assignment.",
      "The door wait list is a decoration.",
    ],
    answerKey: 0,
    rationale: "A campus-appropriate plan uses both the list and a brief email.",
  },
  {
    cefr: "A2",
    skill: "social response",
    script: "Does the rec center rent lockers by the day?",
    options: [
      "Yes, you can pay at the front desk with your student card.",
      "Lockers are only for professors.",
      "The rec center does not have a front desk.",
      "You need a car to enter.",
    ],
    answerKey: 0,
    rationale: "The speaker asks how daily lockers work.",
  },
  {
    cefr: "B1",
    skill: "social response",
    script: "The printer just jammed and my paper is due in twenty minutes. What should I do first?",
    options: [
      "Send the file to the tech bar printer and ask them to release the job.",
      "Delete the assignment so it cannot be late.",
      "The printers never jam on campus.",
      "You should wait until next term.",
    ],
    answerKey: 0,
    rationale: "A practical next printer is the right campus move.",
  },
  {
    cefr: "C1",
    skill: "social response",
    script: "Should we ask the ethics board for a delay, or submit the incomplete survey and note the missing cases?",
    options: [
      "Ask for a short delay and explain the missing cases so the record stays accurate.",
      "Ethics boards never read student email.",
      "Incomplete surveys are always accepted without comment.",
      "You should hide the missing cases.",
    ],
    answerKey: 0,
    rationale: "A careful plan protects the record and asks for time.",
  },
];

function pickUniqueThenFill<T>(
  pool: T[],
  n: number,
  used: Set<string>,
  key: (item: T) => string,
  seen: Set<string> = new Set(),
  seenKey: (item: T) => string = key,
  strict = false,
  kind = "listening",
): T[] {
  const unused = pool.filter((item) => !used.has(key(item)));
  const unusedUnseen = unused.filter((item) => !isSeenKey(seen, seenKey(item)));
  const unusedSeen = unused.filter((item) => isSeenKey(seen, seenKey(item)));
  const picked: T[] = [];
  const pickedKeys = new Set<string>();
  const order = strict ? unusedUnseen : [...unusedUnseen, ...unusedSeen];
  for (const item of order) {
    if (picked.length >= n) break;
    const itemKey = key(item);
    if (!itemKey || pickedKeys.has(itemKey)) continue;
    picked.push(item);
    pickedKeys.add(itemKey);
    used.add(itemKey);
  }
  if (picked.length >= n) return picked;
  if (strict) throw new NeedMoreItems(kind);
  const rest = pick(
    pool.filter((item) => !pickedKeys.has(key(item))),
    n - picked.length,
  );
  for (const item of rest) used.add(key(item));
  return [...picked, ...rest];
}

function chooseItems(
  n: number,
  module: ModuleTag,
  extras: ChooseSeed[] = [],
  usedScripts: Set<string> = new Set(),
  cefrList?: string[],
  seen: Set<string> = new Set(),
  strict = false,
): ListenChooseItem[] {
  const merged = [...extras].reverse().concat(CHOOSE);
  const leveled = cefrList?.length ? merged.filter((row) => cefrList.includes(row.cefr)) : merged;
  const source = leveled.length
    ? [...leveled, ...merged.filter((row) => !leveled.includes(row))]
    : merged;
  return pickUniqueThenFill(
    source,
    n,
    usedScripts,
    (row) => contentKey(row.script),
    seen,
    (row) => contentKey(row.script),
    strict,
    "choose",
  ).map((row, i) => ({
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
  {
    taskType: "listen_conversation",
    cefr: "B1",
    topic: "Campus life",
    title: "Writing center booking",
    speakers: [
      { id: "a", label: "Woman", gender: "female", accent: "au" },
      { id: "b", label: "Man", gender: "male", accent: "uk" },
    ],
    script: [
      { speakerId: "a", text: "The writing center site shows no slots before Friday. My draft is due Thursday night." },
      { speakerId: "b", text: "They keep two walk-in hours on Wednesday morning. You have to arrive when the door opens." },
      { speakerId: "a", text: "I have chemistry then. Could I send the draft and ask for written comments?" },
      { speakerId: "b", text: "Yes, but only if you upload it by noon today. They do not comment on late files." },
    ],
    questions: [
      mcq("What is the woman's problem?", ["The writing center has no listed slots before her deadline", "She lost her chemistry textbook", "The center closed for the year", "She already uploaded the draft"], 0, "The booking site shows no times before Friday.", "main idea", "B1"),
      mcq("What must she do for written comments?", ["Arrive Friday night", "Upload the draft by noon today", "Skip chemistry forever", "Call the dean"], 1, "Written comments require an upload by noon.", "factual", "B1"),
    ],
  },
  {
    taskType: "listen_conversation",
    cefr: "A2",
    topic: "Campus life",
    title: "Lost umbrella",
    speakers: [
      { id: "a", label: "Man", gender: "male", accent: "us" },
      { id: "b", label: "Woman", gender: "female", accent: "uk" },
    ],
    script: [
      { speakerId: "a", text: "I left a black umbrella in lecture hall B. Did anyone turn it in?" },
      { speakerId: "b", text: "The lost-and-found box is at the info desk, not in the hall." },
      { speakerId: "a", text: "Is the desk open after six?" },
      { speakerId: "b", text: "Until seven on weekdays. Bring your ID if you want to claim something." },
    ],
    questions: [
      mcq("Where should the man look?", ["Lecture hall B only", "The info desk lost-and-found", "The dining hall kitchen", "His dorm roof"], 1, "Lost items go to the info desk box.", "factual", "A2"),
      mcq("How late is the desk open on weekdays?", ["Until seven", "Until noon", "All night", "It is closed"], 0, "She says until seven on weekdays.", "factual", "A2"),
    ],
  },
  {
    taskType: "listen_conversation",
    cefr: "B2",
    topic: "Campus life",
    title: "Lab safety swap",
    speakers: [
      { id: "a", label: "Woman", gender: "female", accent: "us" },
      { id: "b", label: "Man", gender: "male", accent: "au" },
    ],
    script: [
      { speakerId: "a", text: "I cannot make Thursday's lab safety session. Can I switch to the Monday makeup?" },
      { speakerId: "b", text: "Monday is already full. They opened a short session Friday at eight." },
      { speakerId: "a", text: "That is early, but I can do it if I still get the badge." },
      { speakerId: "b", text: "You will. Just update the form tonight so your name moves off Thursday." },
    ],
    questions: [
      mcq("Why is the woman asking to switch?", ["She cannot attend Thursday", "She already has the badge", "Monday is her only free day", "The lab closed"], 0, "She cannot make the Thursday session.", "factual", "B2"),
      mcq("What should she do tonight?", ["Cancel the badge", "Update the form", "Skip Friday", "Email every student"], 1, "He tells her to update the form so her name moves.", "factual", "B2"),
    ],
  },
  {
    taskType: "listen_conversation",
    cefr: "B1",
    topic: "Campus life",
    title: "Meal plan guest",
    speakers: [
      { id: "a", label: "Man", gender: "male", accent: "uk" },
      { id: "b", label: "Woman", gender: "female", accent: "us" },
    ],
    script: [
      { speakerId: "a", text: "My cousin is visiting Saturday. Can I use a guest swipe at the dining hall?" },
      { speakerId: "b", text: "Guest swipes work after eleven, but only two per week on your plan." },
      { speakerId: "a", text: "I already used one on Wednesday. So I still have one left." },
      { speakerId: "b", text: "Yes. Tell the cashier it is a guest meal before they scan your card." },
    ],
    questions: [
      mcq("What does the man want to do?", ["Cook in the dorm", "Use a guest swipe for his cousin", "Cancel his meal plan", "Work as a cashier"], 1, "He asks about a guest swipe for Saturday.", "main idea", "B1"),
      mcq("What limit does the woman mention?", ["Two guest swipes per week", "No guests on Saturday", "Guest swipes only at night", "Unlimited swipes"], 0, "The plan allows two guest swipes per week.", "factual", "B1"),
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
  {
    taskType: "listen_announcement",
    cefr: "B1",
    topic: "Campus life",
    title: "Health clinic hours",
    speakers: [{ id: "n", label: "Announcer", gender: "male", accent: "au" }],
    script: [
      {
        speakerId: "n",
        text: "The campus clinic will open extra evening hours this week for flu shots. Appointments are from five to eight on Tuesday and Thursday. Bring your student card and any allergy list. Walk-ins are taken only if a booked student cancels. A short form is required before the shot.",
      },
    ],
    questions: [
      mcq("Why are evening hours added?", ["For flu shots", "For a concert", "For final exams", "For housing keys"], 0, "Extra hours are for flu shots.", "factual", "B1"),
      mcq("When are walk-ins taken?", ["Any time", "Only if a booked student cancels", "Never this week", "Only on Saturday"], 1, "Walk-ins fill canceled appointments only.", "factual", "B1"),
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

function spokenConflicts(
  seed: SpokenSeed,
  used: { scripts: Set<string>; titles: Set<string> },
  seen: Set<string>,
): boolean {
  if (used.titles.has(seed.title.trim())) return true;
  return spokenAudioKeys(expandTalkScript(seed).script).some((key) => used.scripts.has(key) || isSeenKey(seen, key));
}

function markSpokenUsed(seed: SpokenSeed, used: { scripts: Set<string>; titles: Set<string> }) {
  used.titles.add(seed.title.trim());
  for (const key of spokenAudioKeys(expandTalkScript(seed).script)) used.scripts.add(key);
}

function pickSpoken(
  pool: SpokenSeed[],
  n: number,
  used: { scripts: Set<string>; titles: Set<string> },
  seen: Set<string>,
  strict: boolean,
  kind: string,
): SpokenSeed[] {
  const open = pool.filter((seed) => !spokenConflicts(seed, used, seen));
  const picked = pickUniqueThenFill(
    open,
    n,
    used.scripts,
    (s) => spokenJoinKey(expandTalkScript(s).script),
    seen,
    (s) => spokenJoinKey(expandTalkScript(s).script),
    strict,
    kind,
  );
  for (const seed of picked) markSpokenUsed(seed, used);
  return picked;
}

function expandTalkScript(seed: SpokenSeed): SpokenSeed {
  if (seed.taskType !== "listen_academic_talk" || seed.script.length >= 4) return seed;
  const speakerId = seed.script[0]?.speakerId || seed.speakers[0]?.id || "p";
  const sentences = splitSentences(seed.script.map((line) => line.text).join(" "));
  if (sentences.length < 3) return seed;
  return { ...seed, script: sentences.map((text) => ({ speakerId, text })) };
}

function toSpoken(seed: SpokenSeed, module: ModuleTag, salt = 0): SpokenSet {
  const expanded = expandTalkScript(seed);
  const maleAccents: Accent[] = ["us", "uk", "au"];
  const femaleAccents: Accent[] = ["au", "us", "uk"];
  const speakers = expanded.speakers.map((s, i) => ({
    id: s.id,
    label: s.label,
    gender: s.gender,
    accent: s.gender === "male" ? maleAccents[(salt + i) % 3] : femaleAccents[(salt + i) % 3],
  }));
  const talkRate = expanded.taskType === "listen_academic_talk" ? 0.86 : undefined;
  return {
    ...expanded,
    id: makeId("spk"),
    module,
    speakers,
    questions: expanded.questions.map((q) => ({ ...q, id: makeId("q") })),
    audio: audio(
      joinScript(expanded.script, speakers),
      speakers[0]?.accent || "us",
      speakers[0]?.gender || "female",
      talkRate,
    ),
  };
}

export function listeningBundleFor(
  module: ModuleTag,
  spec: { choose: number; conversations: number; announcements: number; talks: number },
  opts:
    | boolean
    | {
        hard?: boolean;
        band?: DifficultyBand;
        extras?: {
          choose?: ChooseSeed[];
          conversations?: SpokenSeed[];
          announcements?: SpokenSeed[];
          talks?: SpokenSeed[];
        };
        used?: { scripts: Set<string>; titles: Set<string> };
        seen?: Set<string>;
        strict?: boolean;
      } = false,
) {
  const hard = typeof opts === "boolean" ? opts : Boolean(opts.hard || opts.band === "harder");
  const band =
    typeof opts === "boolean" ? (opts ? "harder" : "standard") : opts.band || (hard ? "harder" : "standard");
  const extras = typeof opts === "boolean" ? {} : opts.extras || {};
  const used = typeof opts === "boolean" ? { scripts: new Set<string>(), titles: new Set<string>() } : opts.used || {
    scripts: new Set<string>(),
    titles: new Set<string>(),
  };
  const seen = typeof opts === "boolean" ? new Set<string>() : opts.seen || new Set<string>();
  const strict = typeof opts === "boolean" ? false : Boolean(opts.strict);
  const convAll = [...(extras.conversations || [])].reverse().concat(CONVERSATIONS);
  const talkAll = [...(extras.talks || [])].reverse().concat(TALKS);
  const annAll = [...(extras.announcements || [])].reverse().concat(ANNOUNCEMENTS);
  const convPreferred =
    band === "easier"
      ? convAll.filter((c) => c.cefr === "A2" || c.cefr === "B1")
      : hard
        ? convAll.filter((c) => c.cefr !== "A2")
        : convAll;
  const talkPreferred =
    band === "easier"
      ? talkAll.filter((t) => t.cefr !== "C1")
      : hard
        ? talkAll.filter((t) => t.cefr !== "B1")
        : talkAll;
  const convPool = [...convPreferred, ...convAll.filter((item) => !convPreferred.includes(item))];
  const talkPool = [...talkPreferred, ...talkAll.filter((item) => !talkPreferred.includes(item))];
  const chooseCefr = band === "easier" ? ["A2", "B1"] : band === "harder" ? ["B1", "B2", "C1"] : undefined;
  return {
    choose: chooseItems(spec.choose, module, extras.choose || [], used.scripts, chooseCefr, seen, strict),
    conversations: pickSpoken(
      convPool.length ? convPool : convAll,
      spec.conversations,
      used,
      seen,
      strict,
      "conversations",
    ).map((s, i) => toSpoken(s, module, i)),
    announcements: pickSpoken(annAll, spec.announcements, used, seen, strict, "announcements").map((s, i) =>
      toSpoken(s, module, i + 1),
    ),
    talks: pickSpoken(talkPool.length ? talkPool : talkAll, spec.talks, used, seen, strict, "talks").map((s, i) =>
      toSpoken(s, module, i + 2),
    ),
  };
}

export function pickAccent(): Accent {
  return pickOne(["us", "uk", "au"] as Accent[]);
}
