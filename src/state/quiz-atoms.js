import { atom } from "jotai";

export const currentIndexAtom = atom(0);
export const selectionsAtom = atom({});
export const revealedAtom = atom({});
export const scoreAtom = atom(0);
export const showResultsAtom = atom(false);
export const validationAtom = atom("");
export const timerDurationAtom = atom(0);
export const timerRemainingAtom = atom(0);
export const timerRunningAtom = atom(false);
