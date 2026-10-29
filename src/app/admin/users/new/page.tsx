import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { UserForm } from "@/components/admin/user-form";
import { admin as copy } from "@/content/admin";
import { listUserTypes } from "@/server/admin/users";
import { passwordPolicy } from "@/server/auth/policy";
import { requireAdmin } from "@/server/auth/session";
import { createUserAction } from "../actions";

export const metadata: Metadata = { title: copy.userForm.newMetaTitle };

export default async function NewUserPage() {
  await requireAdmin("users");
  const types = (await listUserTypes()).filter((type) => type.active);
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.users.eyebrow}
        title={copy.userForm.newTitle}
        description={copy.userForm.newDescription}
      />
      <UserForm
        mode="new"
        action={createUserAction}
        userTypes={types}
        cancelHref="/admin/users"
        adminPasswordMin={passwordPolicy.adminMinLength}
        initial={{
          name: "",
          email: "",
          phone: "",
          userTypeId: types[0]?.id ?? "",
          verificationStatus: "none",
          role: "user",
          marketingOptIn: false,
        }}
      />
    </>
  );
}
