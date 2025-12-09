import { atom } from "jotai";

export const youtubeAtom = atom("");
export const loadingAtom = atom(false);
export const errorAtom = atom("");
export const transcribeProgressAtom = atom(0);

export const transcriptResultAtom = atom(null);

export const summaryPromptAtom = atom("Highlight ayat, hadits, dan poin praktis.");
export const summaryResultAtom = atom(null);
export const summaryLoadingAtom = atom(false);
export const summaryErrorAtom = atom("");
export const summaryProgressAtom = atom(0);

export const qaPromptAtom = atom("Tulis 5-8 pertanyaan dan jawaban yang mudah dipahami.");
export const qaResultAtom = atom(null);
export const qaLoadingAtom = atom(false);
export const qaErrorAtom = atom("");
export const qaProgressAtom = atom(0);

export const mindmapPromptAtom = atom("Buat peta pikiran hierarkis dari transkrip.");
export const mindmapResultAtom = atom(null);
export const mindmapChartAtom = atom("");
export const mindmapErrorAtom = atom("");
export const mindmapLoadingAtom = atom(false);
export const mindmapProgressAtom = atom(0);

export const quizPromptAtom = atom("Buat soal pilihan ganda berbobot sedang.");
export const quizResultAtom = atom(null);
export const quizLoadingAtom = atom(false);
export const quizErrorAtom = atom("");
export const quizProgressAtom = atom(0);
