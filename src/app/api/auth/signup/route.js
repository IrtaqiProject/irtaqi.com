import { NextResponse } from "next/server";
import { z } from "zod";

import { createUser } from "@/lib/user-store";

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
});

export async function POST(req) {
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const user = await createUser(parsed.data);
    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sign up";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
