import { atom } from "jotai";

export const userBadgeOpenAtom = atom(false);

export const summaryStreamingAtom = atom("");
export const qaStreamingAtom = atom("");
export const mindmapStreamingAtom = atom("");
export const quizStreamingAtom = atom("");
export const quizStartedAtom = atom(false);

export const transcriptDetailAtom = atom(null);
export const transcriptDetailLoadingAtom = atom(true);
export const transcriptDetailErrorAtom = atom("");

export const userTranscriptsAtom = atom([]);
export const userDataLoadingAtom = atom(true);
export const userDataErrorAtom = atom("");
