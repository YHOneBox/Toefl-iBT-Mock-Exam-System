import type { SessionTiming } from "./timing-log";
import type { ScopePart, TestFormPayload } from "./types";

export type ClientResponse = {
  value: unknown;
  recordingPath?: string | null;
  transcript?: string | null;
};

export type ClientSession = {
  id: string;
  formId: string;
  mode: string;
  scope: ScopePart[];
  sourceSessionId: string | null;
  status: string;
  currentPointer: string;
  readingRoute: string | null;
  listeningRoute: string | null;
  allowReadapt: boolean;
  sectionStartedAt: string | null;
  sectionEndsAt: string | null;
  notepad: string;
  timing?: SessionTiming;
  createdAt: string;
  completedAt: string | null;
  topics: string[];
  form: TestFormPayload;
  responses: Record<string, ClientResponse>;
  scoreReport: {
    raw: Record<string, unknown>;
    bands: Record<string, number | undefined>;
    traits: Record<string, unknown>;
    concordance: Record<string, unknown>;
    compositeFromSessionId: string | null;
  } | null;
};
