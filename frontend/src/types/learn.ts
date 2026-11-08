/** Learning paths (Figma "08 · Learn · Step + quiz"). */

/** A run of lesson text; `bold` renders it semibold. */
export type RichTextSegment = {
  text: string;
  bold?: boolean;
};

/** Syntax-highlight role of a code token. */
export type CodeTokenKind = "plain" | "string" | "keyword" | "builtin";

export type CodeToken = {
  text: string;
  kind?: CodeTokenKind; // defaults to "plain"
};

export type CodeSnippet = {
  language: string; // "python"
  /** One array of tokens per line. */
  lines: CodeToken[][];
};

export type QuizOption = {
  id: string;
  /** Shown in monospace (options are usually code). */
  label: string;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
  /** Short note shown after answering. */
  explanation?: string;
};

export type LearningStep = {
  id: string;
  title: string;
  intro: RichTextSegment[];
  code?: CodeSnippet;
  quiz: QuizQuestion[];
};

/** Where the learner is in the path (server-side progress). */
export type LearningProgress = {
  /** Index of the current (first unfinished) step. Steps before it are done. */
  currentStepIndex: number;
  /** Index of the quiz question being answered in the current step. */
  currentQuestionIndex: number;
  /** Answer already chosen for the current question, if any. */
  selectedOptionId?: string;
};

export type LearningPath = {
  id: string;
  title: string; // "Python basics"
  steps: LearningStep[];
  progress: LearningProgress;
};
