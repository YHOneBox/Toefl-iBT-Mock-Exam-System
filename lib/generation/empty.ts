import { makeId } from "../ids";
import type { ListeningBundle, ReadingBundle, SpeakingBundle, WritingBundle } from "../types";

export function emptyReadingBundle(): ReadingBundle {
  return { completeTheWords: [], dailyLife: [], academic: [] };
}

export function emptyListeningBundle(): ListeningBundle {
  return { choose: [], conversations: [], announcements: [], talks: [] };
}

export function emptyWritingBundle(): WritingBundle {
  return {
    sentences: [],
    email: { id: makeId("email"), taskType: "write_email", cefr: "B1", scenario: "", audience: "", goal: "" },
    discussion: {
      id: makeId("disc"),
      taskType: "write_discussion",
      cefr: "B1",
      course: "",
      professor: { name: "", text: "" },
      students: [],
      prompt: "",
    },
  };
}

export function emptySpeakingBundle(): SpeakingBundle {
  return {
    listenRepeat: { scenario: "", setting: "", items: [] },
    interview: { scenario: "", interviewer: "", items: [] },
  };
}
