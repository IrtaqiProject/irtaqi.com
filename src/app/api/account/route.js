import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  FREE_TOKEN_QUOTA,
  SUBSCRIPTION_PLANS,
  getUserAccount,
  subscribeUser,
} from "@/lib/user-store";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const account = getUserAccount(session.user.id, {
      email: session.user.email,
      name: session.user.name,
    });
    return NextResponse.json({
      account,
      plans: SUBSCRIPTION_PLANS,
      maxTokens: FREE_TOKEN_QUOTA,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat akun." },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const planId = body?.plan;
  if (!planId) {
    return NextResponse.json(
      { error: "Plan harus diisi (plus/pro/ultra)." },
      { status: 400 },
    );
  }

  try {
    const account = subscribeUser(session.user.id, planId, {
      email: session.user.email,
      name: session.user.name,
    });
    return NextResponse.json({
      account,
      plans: SUBSCRIPTION_PLANS,
      maxTokens: FREE_TOKEN_QUOTA,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Gagal memproses langganan.",
      },
      { status: 400 },
    );
  }
}
