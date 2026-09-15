"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const AnswerRevealContext = createContext(false);

export function useAnswerReveal() {
  return useContext(AnswerRevealContext);
}

export function useShowAnswer(review?: boolean) {
  const reveal = useAnswerReveal();
  return Boolean(review || reveal);
}

function isRevealKey(e: KeyboardEvent) {
  if (e.repeat || e.isComposing) return false;
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return false;
  return e.code === "Backquote";
}

export function AnswerRevealProvider({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isRevealKey(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      setOn((value) => !value);
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <AnswerRevealContext.Provider value={on}>
      {children}
      {on && (
        <div className="answer-key-badge" aria-live="polite">
          Answer key
        </div>
      )}
    </AnswerRevealContext.Provider>
  );
}
