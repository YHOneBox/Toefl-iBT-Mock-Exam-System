import { ACCENT_GENDER_PAIRS } from "../accents";
import { makeId } from "../ids";
import type { SpeakingBundle } from "../types";
import { audio, pickOne } from "./util";

const REPEAT: Array<Omit<SpeakingBundle["listenRepeat"], "items"> & { sentences: string[] }> = [
  {
    scenario: "You are training to welcome visitors at the campus greenhouse. Listen to your supervisor and repeat what she says. Repeat only once.",
    setting: "Campus greenhouse path",
    sentences: [
      "We grow plants for teaching and research.",
      "Please stay on the marked path at all times.",
      "The tropical room stays warm and humid year round.",
      "Do not touch the plants unless a staff member asks you to.",
      "If you feel dizzy in the heat, step back into the hallway.",
      "Group tours start at the front desk and last about forty minutes.",
      "The visitor map near the entrance shows which rooms are open today.",
    ],
  },
  {
    scenario: "You are learning to guide new students around the library. Listen to the librarian and repeat what he says. Repeat only once.",
    setting: "Library main floor",
    sentences: [
      "Course reserves are at the first desk.",
      "Quiet floors begin after the stairs.",
      "You can print from any campus login.",
      "Please return books to the labeled carts, not the shelves.",
      "Study rooms must be booked in the library app.",
      "If a computer is frozen, restart it or ask the tech bar for help.",
      "The archives on the fourth floor are open by appointment only this week.",
    ],
  },
];

const INTERVIEWS: Array<Omit<SpeakingBundle["interview"], "items"> & { questions: string[] }> = [
  {
    scenario: "You have agreed to take part in a research study about campus and city life. You will have a short interview with a researcher.",
    interviewer: "Dr. Elena Ruiz",
    questions: [
      "Think of the last time you visited a city you do not live in. Why did you go, and what did you notice first?",
      "Some people feel energized in busy cities, while others feel drained. What kind of reaction do you have, and why?",
      "Do you agree that people who live in cities have more interesting lives? Explain your reasons.",
      "Should city governments create more parks to improve happiness, even if the money could be used for housing or transport? Why or why not?",
    ],
  },
  {
    scenario: "You are being interviewed for a campus scholarship that supports community projects.",
    interviewer: "Mr. David Chen",
    questions: [
      "Describe a group project or club activity you joined. What was your role?",
      "How do you usually react when a plan changes at the last minute?",
      "Some people say students should focus only on grades. Do you agree? Why or why not?",
      "If the university had funds for one new student service, what should it be, and why?",
    ],
  },
];

const REPEAT_SECONDS = [8, 8, 10, 10, 10, 12, 12] as const;

export function makeSpeakingBundle(): SpeakingBundle {
  const repeat = pickOne(REPEAT);
  const interview = pickOne(INTERVIEWS);
  return {
    listenRepeat: {
      scenario: repeat.scenario,
      setting: repeat.setting,
      items: repeat.sentences.map((sentence, i) => ({
        id: makeId("rep"),
        taskType: "listen_repeat" as const,
        sentence,
        seconds: REPEAT_SECONDS[i],
        audio: audio(
          sentence,
          ACCENT_GENDER_PAIRS[i % ACCENT_GENDER_PAIRS.length].accent,
          ACCENT_GENDER_PAIRS[i % ACCENT_GENDER_PAIRS.length].gender,
        ),
      })),
    },
    interview: {
      scenario: interview.scenario,
      interviewer: interview.interviewer,
      items: interview.questions.map((prompt, i) => ({
        id: makeId("int"),
        taskType: "take_interview" as const,
        prompt,
        seconds: 45 as const,
        focus: (["fact", "reaction", "opinion", "policy"] as const)[i],
        audio: audio(
          prompt,
          ACCENT_GENDER_PAIRS[i % ACCENT_GENDER_PAIRS.length].accent,
          ACCENT_GENDER_PAIRS[i % ACCENT_GENDER_PAIRS.length].gender,
        ),
      })),
    },
  };
}
