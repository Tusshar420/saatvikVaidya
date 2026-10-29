import type { Metadata } from "next";
import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { Notice, parseNotice } from "@/components/admin/notice";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { UsersTable } from "@/components/admin/users-table";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { admin as copy } from "@/content/admin";
import { cn } from "@/lib/cn";
import {
  listUserTypes,
  listUsers,
  userFiltersSchema,
  userRoles,
  verificationStatuses,
} from "@/server/admin/users";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.users.metaTitle };

const text = copy.users;

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  const { user } = await requireAdmin("users");
  const params = await searchParams;
  const filters = userFiltersSchema.parse(params);
  const [list, types] = await Promise.all([
    listUsers(filters),
    listUserTypes(),
  ]);
  const filtered = Boolean(
    filters.q || filters.type || filters.status || filters.role,
  );

  return (
    <>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={`${text.description} ${copy.common.count(list.total, "account", "accounts")}.`}
        action={
          <Link href="/admin/users/new" className={buttonClasses()}>
            <UserPlus aria-hidden className="size-4.5" />
            {text.add}
          </Link>
        }
      />
      <Notice notice={parseNotice(params.notice)} />

      <form
        method="get"
        role="search"
        aria-label={text.searchLabel}
        className="mt-6 grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]"
      >
        <FilterField
          id="filter-q"
          label={text.searchLabel}
          className="sm:col-span-2 lg:col-span-1"
        >
          <span className="relative block">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted"
            />
            <input
              id="filter-q"
              type="search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder={text.searchPlaceholder}
              maxLength={100}
              className={cn(inputClasses, "pl-10")}
            />
          </span>
        </FilterField>
        <FilterField id="filter-type" label={text.typeFilter}>
          <select
            id="filter-type"
            name="type"
            defaultValue={filters.type ?? ""}
            className={cn(inputClasses, "cursor-pointer")}
          >
            <option value="">{copy.common.all}</option>
            {types.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField id="filter-status" label={text.statusFilter}>
          <select
            id="filter-status"
            name="status"
            defaultValue={filters.status ?? ""}
            className={cn(inputClasses, "cursor-pointer")}
          >
            <option value="">{copy.common.all}</option>
            {verificationStatuses.map((status) => (
              <option key={status} value={status}>
                {text.status[status]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField id="filter-role" label={text.roleFilter}>
          <select
            id="filter-role"
            name="role"
            defaultValue={filters.role ?? ""}
            className={cn(inputClasses, "cursor-pointer")}
          >
            <option value="">{copy.common.all}</option>
            {userRoles.map((role) => (
              <option key={role} value={role}>
                {text.roles[role]}
              </option>
            ))}
          </select>
        </FilterField>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
            {copy.common.filter}
          </Button>
          {filtered && (
            <Link
              href="/admin/users"
              className={buttonClasses({ variant: "link" })}
            >
              {copy.common.clearFilters}
            </Link>
          )}
        </div>
      </form>

      {/* Always rendered, so a bulk action's message survives an empty list. */}
      <UsersTable
        rows={list.rows}
        currentUserId={user.id}
        emptyText={filtered ? copy.common.noResults : text.empty}
      />

      <Pagination
        basePath="/admin/users"
        params={{
          q: filters.q,
          type: filters.type,
          status: filters.status,
          role: filters.role,
        }}
        page={list.page}
        pageCount={list.pageCount}
      />
    </>
  );
}

function FilterField({
  id,
  label,
  className,
  children,
}: {
  /** Id of the control, so the label names it (and not its value). */
  id: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={id} className="mb-1.5 text-xs font-extrabold text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}
