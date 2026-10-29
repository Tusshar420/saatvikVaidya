"use client";

import { useRef } from "react";
import Link from "next/link";
import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Package,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { shell } from "@/content/shell";
import { signIn as copy } from "@/content/sign-in";
import { useAuthSession, type AuthUser } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { formatIndianPhone } from "@/lib/phone";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { useSignOut } from "./auth/use-sign-out";
import { SiteModalButton, useClaimFocus, useSiteModal } from "./site-modals";

/** The phone number, or the email if there's no phone, for display. */
export function contactOf(user: AuthUser): string {
  if (user.phoneNumber) return formatIndianPhone(user.phoneNumber);
  return isPlaceholderEmail(user.email) ? "" : user.email;
}

const itemClasses =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-3 text-sm font-bold text-ink outline-none select-none data-highlighted:bg-brand-soft data-highlighted:text-brand [&_svg]:size-4.5 [&_svg]:text-brand";

/**
 * The header's profile button. Signed out it opens sign-in ("My Profile /
 * Sign in / Register"); signed in it shows the avatar and opens a menu with
 * My account, Report a problem and Sign out, plus the admin panel for
 * admins (which checks the role and two-factor itself). While the session is
 * loading it shows the signed-out look.
 */
export function ProfileMenu({
  className,
  variant = "header",
}: {
  className?: string;
  /** "dock" is the phone bottom bar's "You" item: icon over label, menu opens upward. */
  variant?: "header" | "dock";
}) {
  const dock = variant === "dock";
  const focusKey = dock ? "profile-dock" : "profile-header";
  const { data } = useAuthSession();
  const user = data?.user;
  const ref = useRef<HTMLButtonElement>(null);
  const signOut = useSignOut();
  const openModal = useSiteModal();
  /** Set while a menu item opens a modal, so the menu doesn't pull focus back to its button. */
  const openingModal = useRef(false);
  useClaimFocus(focusKey, ref, Boolean(user));

  if (!user) {
    return (
      <SiteModalButton
        ref={ref}
        modal="signIn"
        data-focus-key={focusKey}
        className={cn(className, dock ? "text-muted" : "text-ink")}
      >
        {dock ? (
          <>
            <UserRound aria-hidden />
            <span className="text-[11px] leading-tight font-bold">
              {shell.dock.you}
            </span>
          </>
        ) : (
          <>
            <span
              aria-hidden
              className="grid size-8.5 place-items-center rounded-[10px] text-white bg-avatar sm:size-10 sm:rounded-md lg:size-9.5"
            >
              <UserRound className="size-4.5 sm:size-5" />
            </span>
            <span className="flex flex-col items-start leading-[1.05] max-lg:sr-only">
              <span className="text-xs font-bold whitespace-nowrap">
                {shell.header.profileTitle}
              </span>{" "}
              <span className="mt-0.75 text-[11px] font-medium text-muted">
                {shell.header.profileSubtitle}
              </span>
            </span>
          </>
        )}
      </SiteModalButton>
    );
  }

  const contact = contactOf(user);
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button
          ref={ref}
          type="button"
          data-focus-key={focusKey}
          aria-label={copy.menu.trigger(user.name)}
          className={cn(className, dock ? "text-muted" : "text-ink")}
        >
          {dock ? (
            <>
              <Avatar
                name={user.name}
                decorative
                className="size-5.5 text-[9px]"
              />
              <span aria-hidden className="text-[11px] leading-tight font-bold">
                {shell.dock.you}
              </span>
            </>
          ) : (
            <>
              <Avatar
                name={user.name}
                decorative
                className="size-8.5 rounded-[10px] text-[11px] sm:size-10 sm:rounded-md lg:size-9.5"
              />
              <span
                aria-hidden
                className="flex max-w-32 flex-col items-start leading-none max-lg:hidden"
              >
                <span className="w-full truncate text-left text-xs font-bold">
                  {user.name}
                </span>
                <span className="mt-0.75 text-[11px] font-medium text-muted">
                  {copy.menu.subtitle}
                </span>
              </span>
              <ChevronDown
                aria-hidden
                className="size-4.25 text-muted max-lg:hidden"
              />
            </>
          )}
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align={dock ? "center" : "end"}
          side={dock ? "top" : "bottom"}
          sideOffset={8}
          collisionPadding={12}
          onCloseAutoFocus={(event) => {
            if (!openingModal.current) return;
            openingModal.current = false;
            event.preventDefault();
          }}
          className="z-200 w-64 max-w-[calc(100vw-24px)] rounded-lg border border-line bg-surface p-1.5 shadow-raised data-[state=open]:animate-fade-in"
        >
          <div className="flex items-center gap-3 px-3 pt-2 pb-3">
            <Avatar name={user.name} decorative size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-ink">
                {user.name}
              </p>
              {contact && (
                <p className="truncate text-small text-muted">{contact}</p>
              )}
            </div>
          </div>
          <Menu.Separator className="mx-1.5 mb-1.5 h-px bg-line" />
          <Menu.Item asChild className={itemClasses}>
            <Link href="/account">
              <UserRound aria-hidden />
              {copy.menu.account}
            </Link>
          </Menu.Item>
          <Menu.Item asChild className={itemClasses}>
            <Link href="/orders">
              <Package aria-hidden />
              {copy.menu.orders}
            </Link>
          </Menu.Item>
          <Menu.Item asChild className={itemClasses}>
            <Link href="/my-brand">
              <Sparkles aria-hidden />
              {copy.menu.brandOrders}
            </Link>
          </Menu.Item>
          {user.role === "admin" && (
            <Menu.Item asChild className={itemClasses}>
              <Link href="/admin">
                <LayoutDashboard aria-hidden />
                {copy.menu.admin}
              </Link>
            </Menu.Item>
          )}
          <Menu.Item
            className={itemClasses}
            onSelect={() => {
              openingModal.current = true;
              openModal("reportProblem", ref.current);
            }}
          >
            <LifeBuoy aria-hidden />
            {copy.menu.reportProblem}
          </Menu.Item>
          <Menu.Item
            className={itemClasses}
            onSelect={() => void signOut(focusKey)}
          >
            <LogOut aria-hidden />
            {copy.menu.signOut}
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
