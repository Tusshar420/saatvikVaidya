import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { dangerButtonClasses } from "@/components/admin/confirm-delete";
import { InviteAdminForm } from "@/components/admin/invite-admin-form";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminSecurity as copy } from "@/content/admin-security";
import { adminRoles } from "@/lib/admin-permissions";
import { formatDateTime } from "@/lib/format";
import { listAdmins, listPendingInvites } from "@/server/admin/admins";
import { requireAdmin } from "@/server/auth/session";
import {
  changeAdminRoleAction,
  removeAdminAction,
  resetTwoFactorAction,
  revokeInviteAction,
} from "./actions";

const text = copy.admins;

export const metadata: Metadata = { title: text.metaTitle };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** Super admins: the admin accounts, their roles, and waiting invitations. */
export default async function AdminsPage({ searchParams }: PageProps<"/admin/admins">) {
  const { user } = await requireAdmin("admins", "/admin/admins");
  const query = await searchParams;
  const noticeKey = first(query.notice);
  const notice =
    noticeKey && Object.hasOwn(text.notices, noticeKey)
      ? text.notices[noticeKey as keyof typeof text.notices]
      : null;
  // Failure messages are our own texts, passed back in the URL; only known
  // ones are shown, never arbitrary text from the link.
  const errorText = first(query.error);
  const error = Object.values(copy.errors).find((message) => message === errorText);
  const [admins, invites] = await Promise.all([listAdmins(), listPendingInvites()]);

  return (
    <>
      <AdminPageHeader eyebrow={copy.admins.nav} title={text.title} description={text.intro} />
      {notice && (
        <FormAlert tone="success" className="mt-6">
          {notice}
        </FormAlert>
      )}
      {typeof error === "string" && <FormAlert className="mt-6">{error}</FormAlert>}

      <section aria-labelledby="admins-list" className="mt-8">
        <h2 id="admins-list" className="text-h3 text-ink">
          {text.title}
        </h2>
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
          {admins.map((admin) => {
            const self = admin.id === user.id;
            return (
              <li key={admin.id} data-testid="admin-row" className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-extrabold text-ink">{admin.name}</span>
                  {self && <Badge variant="brand">{text.you}</Badge>}
                  <span className="text-sm break-all text-muted">{admin.email}</span>
                  <Badge variant={admin.twoFactorEnabled ? "brand" : "orange"}>
                    {admin.twoFactorEnabled ? text.twoFactorOn : text.twoFactorOff}
                  </Badge>
                </div>
                {self ? (
                  <p className="text-sm text-muted">
                    {admin.adminRole ? copy.roles[admin.adminRole] : ""}
                  </p>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                    <form action={changeAdminRoleAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={admin.id} />
                      <label className="flex flex-col text-xs font-extrabold text-ink">
                        {text.changeRole}
                        <select
                          name="role"
                          defaultValue={admin.adminRole ?? "orders"}
                          className="mt-1.5 min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-medium"
                        >
                          {adminRoles.map((role) => (
                            <option key={role} value={role}>
                              {copy.roles[role]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button type="submit" variant="secondary" size="sm">
                        {text.saveRole}
                      </Button>
                    </form>
                    <form action={resetTwoFactorAction}>
                      <input type="hidden" name="id" value={admin.id} />
                      <Button type="submit" variant="secondary" size="sm" title={text.resetHelp}>
                        {text.resetTwoFactor}
                      </Button>
                    </form>
                    <form action={removeAdminAction}>
                      <input type="hidden" name="id" value={admin.id} />
                      <Button
                        type="submit"
                        variant="secondary"
                        size="sm"
                        title={text.removeHelp}
                        className={dangerButtonClasses}
                      >
                        {text.remove}
                      </Button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="admins-invite" className="mt-10 max-w-3xl">
        <h2 id="admins-invite" className="text-h3 text-ink">
          {text.inviteTitle}
        </h2>
        <InviteAdminForm />
      </section>

      <section aria-labelledby="admins-pending" className="mt-10 max-w-3xl">
        <h2 id="admins-pending" className="text-h3 text-ink">
          {text.pendingTitle}
        </h2>
        {invites.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{text.pendingNone}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-bold break-all text-ink">{invite.email}</p>
                  <p className="text-sm text-muted">
                    {copy.roles[invite.adminRole]} · {text.pendingExpires(formatDateTime(invite.expiresAt))}
                  </p>
                </div>
                <form action={revokeInviteAction}>
                  <input type="hidden" name="id" value={invite.id} />
                  <Button type="submit" variant="secondary" size="sm" className="max-sm:w-full">
                    {text.revoke}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
