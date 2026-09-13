import { makeId } from "../ids";
import type { Cefr, CompleteTheWordsSet, ModuleTag } from "../types";

function cutIndex(length: number, cefr: Cefr) {
  const keep = cefr === "C1" ? 0.4 : cefr === "B2" || cefr === "C2" ? 0.5 : 0.6;
  return Math.max(2, Math.min(length - 1, Math.ceil(length * keep)));
}

export function buildCompleteTheWords(
  passage: string,
  topic: string,
  module: ModuleTag,
  cefr: Cefr,
): CompleteTheWordsSet {
  const sentences = passage.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [passage];
  const firstSentence = sentences[0];
  const rest = sentences.slice(1).join(" ");
  const words = rest.split(/\s+/).filter(Boolean);
  const tokens: CompleteTheWordsSet["tokens"] = [];
  let gaps = 0;
  words.forEach((word, index) => {
    const punctMatch = word.match(/([^A-Za-z']+)$/);
    const punct = punctMatch ? punctMatch[1] : "";
    const core = punct ? word.slice(0, -punct.length) : word;
    const takeGap = index % 2 === 1 && core.length >= 4 && gaps < 10 && /[A-Za-z]/.test(core);
    if (takeGap) {
      const cut = cutIndex(core.length, cefr);
      const itemId = makeId("ctw");
      tokens.push({
        text: core,
        isGap: true,
        prefix: core.slice(0, cut),
        answer: core.slice(cut),
        itemId,
        punct,
      });
      gaps += 1;
    } else {
      tokens.push({ text: word, isGap: false });
    }
  });
  if (gaps < 10) {
    for (const token of tokens) {
      if (gaps >= 10) break;
      if (token.isGap) continue;
      const core = token.text.replace(/[^A-Za-z']/g, "");
      if (core.length < 5) continue;
      const cut = cutIndex(core.length, cefr);
      token.isGap = true;
      token.prefix = core.slice(0, cut);
      token.answer = core.slice(cut);
      token.itemId = makeId("ctw");
      token.punct = token.text.slice(core.length);
      token.text = core;
      gaps += 1;
    }
  }
  return {
    id: makeId("ctwset"),
    taskType: "complete_the_words",
    module,
    cefr,
    topic,
    firstSentence,
    tokens,
    fullPassage: passage,
  };
}
