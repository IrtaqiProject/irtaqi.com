import { atom } from "jotai";

export const youtubeAtom = atom("");
export const transcriptAtom = atom(null);
export const transcriptLoadingAtom = atom(false);
export const transcriptErrorAtom = atom("");

export const summaryPromptAtom = atom("Highlight ayat, hadits, dan poin praktis.");
export const qaPromptAtom = atom("Susun 5-10 tanya jawab yang merujuk pada dalil dan amalan.");
export const mindmapPromptAtom = atom("Buat peta pikiran hierarkis dengan node singkat dan cabang lengkap.");

export const summaryResultAtom = atom(null);
export const qaResultAtom = atom(null);
export const mindmapResultAtom = atom(null);
export const mindmapChartAtom = atom("");
export const mindmapRenderErrorAtom = atom("");
