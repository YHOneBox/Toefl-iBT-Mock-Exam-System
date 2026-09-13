import type { DiscussionTask, EmailTask } from "./types";

export function analyzeEmailFormat(text: string): string[] {
  const issues: string[] = [];
  const t = text.trim();
  if (!t) return ["No email was written."];
  if (!/^(dear|hi\b|hello|to whom|good morning|good afternoon)/im.test(t)) {
    issues.push("Missing a greeting (for example Dear, Hello, or Hi).");
  }
  if (!/(sincerely|regards|best wishes|best,|thank you|thanks,)/im.test(t)) {
    issues.push("Missing a closing (for example Sincerely or Best regards).");
  }
  if (t.split(/\s+/).length < 40) {
    issues.push("The message is too short to complete the communicative purpose.");
  }
  if (t === t.toUpperCase() && t.length > 20) {
    issues.push("The email is written in all capital letters.");
  }
  if (!/[.!?][\s\S]*[.!?]/.test(t) && t.split(/\s+/).length > 25) {
    issues.push("Punctuation is incomplete; use full sentences.");
  }
  if (!/\n/.test(t) && t.split(/\s+/).length > 50) {
    issues.push("The email is one block of text. Use a short opening, body, and closing.");
  }
  return issues;
}

export function analyzeDiscussionFormat(text: string, prompt: string): string[] {
  const issues: string[] = [];
  const t = text.trim();
  if (!t) return ["No discussion post was written."];
  if (t.split(/\s+/).length < 40) {
    issues.push("The post is too short to support a clear position.");
  }
  const overlap = prompt
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 5);
  const copied = overlap.filter((w) => t.toLowerCase().includes(w)).length;
  if (overlap.length && copied / overlap.length > 0.45 && t.split(/\s+/).length < 80) {
    issues.push("Much of the language is borrowed from the prompt. Add your own reasons.");
  }
  if (!/(i (think|believe|agree|disagree)|in my (view|opinion)|should|should not)/i.test(t)) {
    issues.push("The post does not clearly state a position.");
  }
  if (!/[.!?][\s\S]*[.!?]/.test(t)) {
    issues.push("Use complete sentences and end punctuation.");
  }
  return issues;
}

export function isWeakEmailSample(sample: string | undefined, task: EmailTask): boolean {
  const s = (sample || "").trim();
  if (s.length < 80) return true;
  if (/I am writing about a scheduling problem/i.test(s)) return true;
  if (task.goal && s.includes(task.goal)) return true;
  if (/\bWrite to (the|your|a)\b/i.test(s)) return true;
  if (/\bYou reserved\b|\bYou cannot attend\b|\bskipped your stop\b/i.test(s)) return true;
  return false;
}

export function sampleEmailAnswer(task: EmailTask): string {
  if (task.sampleAnswer && !isWeakEmailSample(task.sampleAnswer, task)) return task.sampleAnswer;
  const greeting = emailGreeting(task.audience);
  const facts = lowerAfterBecause(situationInFirstPerson(task.scenario));
  const ask = requestFromGoal(task.goal, task.scenario);
  return `${greeting}

I hope you are well. I am writing because ${facts}

${ask} If you need more details, I can send them right away.

Thank you for your time and help.

Sincerely,
Alex Chen`;
}

export function chooseEmailSample(task: EmailTask, stored?: string): string {
  if (stored && !isWeakEmailSample(stored, task)) return stored;
  return sampleEmailAnswer(task);
}

export function sampleDiscussionAnswer(task: DiscussionTask): string {
  if (task.sampleAnswer) return task.sampleAnswer;
  const other = task.students[0]?.name || "the first student";
  return `I think this is a trade-off rather than a simple yes-or-no question. ${oneProfessorIdea(task.professor.text)}
I partly agree with ${other}, but I would add one practical limit: any policy needs a clear reason and one concrete example from campus or city life. That keeps the post relevant to the discussion and gives others something specific to reply to.`;
}

function emailGreeting(audience: string): string {
  const a = audience.trim();
  if (/^(dear|hi|hello|to whom)\b/i.test(a)) return a.replace(/,?$/, ",");
  const titled = a
    .replace(/^the\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return `Dear ${titled},`;
}

function situationInFirstPerson(scenario: string): string {
  const parts = scenario.split(/(?<=[.!?])\s+/);
  const instruction = /^(write|explain|ask|describe|decline|suggest|offer|thank them)\b/i;
  const facts = parts.filter((part) => !instruction.test(part.trim()));
  const text = (facts.join(" ").trim() || parts[0] || scenario).replace(/\s+/g, " ").trim();
  const converted = text
    .replace(/\bYou cannot\b/g, "I cannot")
    .replace(/\bYou reserved\b/g, "I reserved")
    .replace(/\b[Yy]ou were\b/g, "I was")
    .replace(/\b[Yy]ou are\b/g, "I am")
    .replace(/\b[Yy]our\b/g, "my")
    .replace(/\b[Yy]ou\b/g, "I")
    .replace(/^I ([a-z])/i, (_, letter: string) => `I ${letter.toLowerCase()}`);
  return converted.replace(/[.?!]+$/, "") + ".";
}

function requestFromGoal(goal: string, scenario: string): string {
  const lower = `${goal} ${scenario}`.toLowerCase();
  if (lower.includes("reservation") || lower.includes("friday evening")) {
    return "Could you please change the reservation to Friday evening if a room is free? Another evening this week would also work.";
  }
  if (lower.includes("shuttle") || lower.includes("bus") || lower.includes("transport")) {
    return "Could you please tell me what I should do the next time the bus does not arrive?";
  }
  if (lower.includes("hike") || lower.includes("decline") || lower.includes("refuse") || lower.includes("cannot attend")) {
    return "I am sorry I cannot join. Another member can take my seat, and I can help with sign-in next week.";
  }
  let g = goal.trim().replace(/\.+$/, "");
  g = g.replace(/\s+(politely and clearly|without being rude|while remaining helpful and polite)$/i, "");
  if (/^request\s+/i.test(g)) return `I would like to ${g.charAt(0).toLowerCase()}${g.slice(1)}.`;
  if (/^report\s+/i.test(g)) return `I am writing to ${g.charAt(0).toLowerCase()}${g.slice(1)}.`;
  return "Could you please let me know what I should do next?";
}

function lowerAfterBecause(text: string): string {
  if (/^I\b/.test(text)) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function oneProfessorIdea(text: string): string {
  const first = text.split("?")[0]?.trim() || text;
  return first.endsWith(".") ? first : `${first}.`;
}
