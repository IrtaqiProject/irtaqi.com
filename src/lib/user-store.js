import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

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
      },
    ],
  };
}

const store = globalStore._userStore;

export async function findUserByEmail(email) {
  return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function createUser({ email, name, password }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: nanoid(), email, name, passwordHash };
  store.users.push(user);
  return user;
}

export async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.passwordHash);
}

export function listUsers() {
  return store.users.map(({ passwordHash, ...rest }) => rest);
}
