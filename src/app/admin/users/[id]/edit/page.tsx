import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { UserForm } from "@/components/admin/user-form";
import { admin as copy } from "@/content/admin";
import { getUserDetail, listUserTypes } from "@/server/admin/users";
import { passwordPolicy } from "@/server/auth/policy";
import { requireAdmin } from "@/server/auth/session";
import { updateUserAction } from "../../actions";

export const metadata: Metadata = { title: copy.userForm.editMetaTitle };

export default async function EditUserPage({
  params,
}: PageProps<"/admin/users/[id]/edit">) {
  await requireAdmin("users");
  const { id } = await params;
  const [user, types] = await Promise.all([getUserDetail(id), listUserTypes()]);
  if (!user) notFound();

  // Inactive types are offered only if this user already has one.
  const options = types.filter(
    (type) => type.active || type.id === user.userTypeId,
  );

  return (
    <>
      <Link
        href={`/admin/users/${user.id}`}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {user.name}
      </Link>
      <AdminPageHeader
        className="mt-2"
        eyebrow={copy.users.eyebrow}
        title={copy.userForm.editTitle(user.name)}
      />
      <UserForm
        mode="edit"
        action={updateUserAction.bind(null, user.id)}
        userTypes={options}
        cancelHref={`/admin/users/${user.id}`}
        adminPasswordMin={passwordPolicy.adminMinLength}
        initial={{
          name: user.name,
          email: user.email ?? "",
          phone: user.phoneNumber ? user.phoneNumber.slice(3) : "",
          userTypeId: user.userTypeId,
          verificationStatus: user.verificationStatus,
          role: user.role,
          marketingOptIn: user.marketingOptIn,
        }}
      />
    </>
  );
}
