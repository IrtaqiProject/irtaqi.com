import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

export const FREE_TOKEN_QUOTA = 20;

export const SUBSCRIPTION_PLANS = [
  {
    id: "plus",
    label: "Plus",
    price: "Mulai eksplorasi",
    perks: ["Unlock semua fitur", "Prioritas reguler"],
  },
  {
    id: "pro",
    label: "Pro",
    price: "Lebih cepat & stabil",
    perks: ["Prioritas cepat", "Dukungan prioritas"],
  },
  {
    id: "ultra",
    label: "Ultra",
    price: "Skala intensif",
    perks: ["Prioritas tercepat", "Pemakaian tanpa batas"],
  },
];

const globalStore = globalThis;

if (!globalStore._userStore) {
  globalStore._userStore = {
    users: [
      // Seed demo account (password: "password")
      {
        id: "demo-user",
        email: "demo@irtaqi.com",
        name: "Demo User",
        passwordHash: bcrypt.hashSync("password", 10),
        tokens: FREE_TOKEN_QUOTA,
        subscriptionTier: null,
      },
    ],
  };
}

const store = globalStore._userStore;

export async function findUserByEmail(email) {
  return ensureUserDefaults(
    store.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null,
  );
}

export async function findUserById(id) {
  return ensureUserDefaults(store.users.find((u) => u.id === id) ?? null);
}

function ensureUserDefaults(user) {
  if (!user) return null;
  if (typeof user.tokens !== "number" || Number.isNaN(user.tokens)) {
    user.tokens = FREE_TOKEN_QUOTA;
  }
  if (user.tokens < 0) user.tokens = 0;
  if (!Object.prototype.hasOwnProperty.call(user, "subscriptionTier")) {
    user.subscriptionTier = null;
  }
  return user;
}

function createShadowUser({ id, email, name }) {
  if (!id) return null;
  const user = {
    id,
    email: email || `${id}@user.local`,
    name: name || "User",
    passwordHash: "",
    tokens: FREE_TOKEN_QUOTA,
    subscriptionTier: null,
  };
  store.users.push(user);
  return user;
}

function requireUser(id, info = {}) {
  const user = ensureUserDefaults(store.users.find((u) => u.id === id) ?? null);
  if (user) return user;
  if (info.allowCreate) {
    const created = createShadowUser({
      id,
      email: info.email,
      name: info.name,
    });
    if (created) return created;
  }
  throw new Error("User tidak ditemukan");
}

function normalizePlan(plan) {
  if (!plan) return null;
  const id = plan.toString().toLowerCase();
  return SUBSCRIPTION_PLANS.find((p) => p.id === id) ?? null;
}

export function getUserAccount(userId, info = {}) {
  const user = requireUser(userId, { allowCreate: true, ...info });
  const plan = normalizePlan(user.subscriptionTier);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tokens: user.tokens,
    subscriptionTier: plan?.id ?? null,
    subscriptionLabel: plan?.label ?? "Free",
    maxTokens: FREE_TOKEN_QUOTA,
    isSubscribed: Boolean(plan),
  };
}

export function consumeUserTokens(userId, amount, info = {}) {
  const user = requireUser(userId, { allowCreate: true, ...info });
  const plan = normalizePlan(user.subscriptionTier);

  if (plan) {
    return {
      tokens: user.tokens,
      subscriptionTier: plan.id,
      subscriptionLabel: plan.label,
      isSubscribed: true,
    };
  }

  if (amount <= 0) {
    return {
      tokens: user.tokens,
      subscriptionTier: null,
      subscriptionLabel: "Free",
      isSubscribed: false,
    };
  }

  if (user.tokens < amount) {
    throw new Error("Token habis. Langganan Plus, Pro, atau Ultra untuk lanjut.");
  }

  user.tokens -= amount;

  return {
    tokens: user.tokens,
    subscriptionTier: null,
    subscriptionLabel: "Free",
    isSubscribed: false,
  };
}

export function subscribeUser(userId, planId, info = {}) {
  const user = requireUser(userId, { allowCreate: true, ...info });
  const plan = normalizePlan(planId);
  if (!plan) {
    throw new Error("Paket langganan tidak dikenali.");
  }

  user.subscriptionTier = plan.id;
  if (user.tokens < FREE_TOKEN_QUOTA) {
    user.tokens = FREE_TOKEN_QUOTA;
  }

  return getUserAccount(userId);
}

export async function createUser({ email, name, password }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: nanoid(),
    email,
    name,
    passwordHash,
    tokens: FREE_TOKEN_QUOTA,
    subscriptionTier: null,
  };
  store.users.push(user);
  return user;
}

export async function verifyPassword(user, password) {
  const ensured = ensureUserDefaults(user);
  return bcrypt.compare(password, ensured.passwordHash);
}

export function listUsers() {
  return store.users.map(({ passwordHash, ...rest }) => ({
    ...ensureUserDefaults(rest),
    passwordHash: undefined,
  }));
}
