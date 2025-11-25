"use server";

import { createUser } from "@/lib/user-store";

export async function signupAction(payload) {
  const { email, name, password } = payload || {};
  if (!email || !name || !password) {
    throw new Error("Semua field wajib diisi");
  }
  if (password.length < 6) {
    throw new Error("Password minimal 6 karakter");
  }

  const user = await createUser({ email, name, password });
  return { id: user.id, email: user.email, name: user.name };
}
