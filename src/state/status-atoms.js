import { atom } from "jotai";

export const healthAtom = atom(null);
export const healthLoadingAtom = atom(true);
export const secretAtom = atom(null);
export const secretStateAtom = atom({ loading: false, error: "" });
