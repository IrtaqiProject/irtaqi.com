import { atom } from "jotai";

export const loginFormAtom = atom({ email: "", password: "" });
export const loginLoadingAtom = atom(false);
export const loginErrorAtom = atom("");

export const signupFormAtom = atom({ name: "", email: "", password: "" });
export const signupLoadingAtom = atom(false);
export const signupErrorAtom = atom("");
export const signupSuccessAtom = atom(false);
