"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export async function healthCheck() {
  return {
    status: "ok",
    message: "Server action is alive",
    time: new Date().toISOString(),
  };
}

export async function healthSecret() {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }

  return {
    user: session.user ?? null,
    message: "Protected route reached",
    time: new Date().toISOString(),
  };
}
