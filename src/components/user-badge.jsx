"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";

const DEFAULT_AVATAR = "/avatar-default.svg";

function formatName(name, email) {
  const fallback = email || "Pengguna";
  const display = name || fallback;
  return display.length > 20 ? `${display.slice(0, 17)}...` : display;
}

function initials(name, email) {
  const base = name || email || "User";
  const parts = base.trim().split(/\s+/);
  const chars = parts
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("");
  return chars.toUpperCase() || "U";
}

function resolveAvatarUrl(image, email) {
  if (image) return image;
  if (email) {
    return `https://www.google.com/s2/avatar?email=${encodeURIComponent(
      email
    )}&sz=128`;
  }
  return DEFAULT_AVATAR;
}

export function UserBadgeFloating() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  if (status !== "authenticated") return null;

  const name = formatName(session?.user?.name, session?.user?.email);
  const avatarUrl = resolveAvatarUrl(
    session?.user?.image,
    session?.user?.email
  );
  const badgeInitials = initials(
    session?.user?.name,
    session?.user?.email
  );

  return (
    <div
      ref={menuRef}
      className="fixed right-4 top-4 z-50 flex flex-col items-end gap-2 text-sm font-semibold text-white"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-3 py-2 shadow-lg backdrop-blur transition hover:border-white/40 hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {avatarUrl ? (
          <span className="h-7 w-7 overflow-hidden rounded-full border border-white/20 bg-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt="User avatar"
              onError={(e) => {
                if (
                  e.currentTarget.src !==
                  window.location.origin + DEFAULT_AVATAR
                ) {
                  e.currentTarget.src = DEFAULT_AVATAR;
                }
              }}
              className="h-full w-full object-cover"
            />
          </span>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-200/40 bg-emerald-300/10 text-xs font-bold text-emerald-50">
            {badgeInitials}
          </span>
        )}
        {/* <UserRound className="hidden h-4 w-4 text-emerald-200 sm:inline" /> */}
        <span className="hidden sm:inline">{name}</span>
        <span className="inline sm:hidden">Profil</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="w-52 rounded-2xl border border-white/15 bg-black/80 p-2 text-sm shadow-2xl backdrop-blur-xl"
        >
          <Link
            href="/user"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-white transition hover:bg-white/10"
          >
            <UserRound className="h-4 w-4 text-emerald-200" />
            Profile
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: "/login" });
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-white transition hover:bg-white/10"
          >
            <LogOut className="h-4 w-4 text-emerald-200" />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
