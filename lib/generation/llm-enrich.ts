import { generateJson } from "../llm";
import type { ExamDifficulty, TestFormPayload } from "../types";

export async function enrichWithLlm(
  form: TestFormPayload,
  difficulty: ExamDifficulty = "standard",
  avoid: string[] = [],
): Promise<void> {
  const level =
    difficulty === "easier"
      ? "A2-B1 campus English, shorter sentences, clear requests"
      : difficulty === "harder"
        ? "B2-C1 academic English, denser reasons, still introductory university level"
        : "real enhanced TOEFL iBT: B1-B2 campus and introductory academic English";
  const avoidLine = avoid.length ? `Do not reuse these topics or scenarios: ${avoid.slice(0, 20).join("; ")}.` : "";
  const data = (await generateJson({
    system:
      "Create original TOEFL practice prompts only. Do not copy official ETS items. Return valid JSON.",
    user: `Write one original Write an Email scenario and one Academic Discussion prompt for a mock enhanced TOEFL iBT. Difficulty: ${level}. ${avoidLine}
JSON shape: {"email":{"scenario":"","audience":"","goal":"","sampleAnswer":""},"discussion":{"course":"","professor":{"name":"","text":""},"students":[{"name":"","text":""},{"name":"","text":""}],"prompt":""}}
The email sampleAnswer must be a complete student email (90-130 words): greeting, 2 short body paragraphs that do the requested actions in first person, polite closing, and a name. Do not paste the test instructions or the goal line into the email.`,
    temperature: 0.8,
  })) as {
    email?: { scenario?: string; audience?: string; goal?: string; sampleAnswer?: string };
    discussion?: {
      course?: string;
      professor?: { name?: string; text?: string };
      students?: Array<{ name?: string; text?: string }>;
      prompt?: string;
    };
  };
  if (data.email?.scenario && data.email.audience && data.email.goal) {
    form.writing.email.scenario = data.email.scenario;
    form.writing.email.audience = data.email.audience;
    form.writing.email.goal = data.email.goal;
    if (data.email.sampleAnswer && data.email.sampleAnswer.length > 80) {
      form.writing.email.sampleAnswer = data.email.sampleAnswer;
    }
  }
  if (data.discussion?.professor?.text && data.discussion.students?.length === 2 && data.discussion.prompt) {
    form.writing.discussion.course = data.discussion.course || form.writing.discussion.course;
    form.writing.discussion.professor = {
      name: data.discussion.professor.name || "Professor",
      text: data.discussion.professor.text,
    };
    form.writing.discussion.students = data.discussion.students.map((s, i) => ({
      name: s.name || `Student ${i + 1}`,
      text: s.text || "",
    }));
    form.writing.discussion.prompt = data.discussion.prompt;
  }
}
