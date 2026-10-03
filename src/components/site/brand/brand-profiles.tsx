"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import {
  chooseBrandProfileAction,
  deleteBrandProfileAction,
  setDefaultBrandProfileAction,
  type ProfileChangeResult,
} from "@/app/(site)/launch/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brand as copy } from "@/content/brand";
import { cn } from "@/lib/cn";
import type { BrandProfileView } from "@/server/brand/profiles";
import { BrandProfileForm } from "./brand-profile-form";
import { LogoPreview } from "./logo-preview";

const text = copy.profiles;

/**
 * The saved brands on step 3, like the saved addresses: pick the one this
 * order uses, set the default, edit, delete, or add a new one.
 */
export function BrandProfiles({
  profiles,
  selectedId,
  max,
  context = "order",
}: {
  profiles: BrandProfileView[];
  /** The brand this order uses. */
  selectedId: number | null;
  max: number;
  /** On the account page there is no order, so no "use for this order". */
  context?: "order" | "account";
}) {
  const [editing, setEditing] = useState<"new" | number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const editingProfile = typeof editing === "number" ? (profiles.find((p) => p.id === editing) ?? null) : null;

  function saved(id: number, created: boolean) {
    if (created) {
      // Carry on as this brand's edit form, to add the logo.
      setEditing(id);
      setNotice(text.messages.saved);
    } else {
      setEditing(null);
      setNotice(text.messages.saved);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {notice && <FormAlert tone="success">{notice}</FormAlert>}
      {profiles.length === 0 && editing !== "new" && (
        <div className="rounded-lg border border-dashed border-line-strong p-5">
          <p className="text-base font-extrabold text-ink">{text.empty.title}</p>
          <p className="mt-1 text-sm text-muted">{text.empty.line}</p>
        </div>
      )}
      <ul aria-label={text.listLabel} className="grid gap-3 lg:grid-cols-2">
        {profiles.map((profile) =>
          editing === profile.id ? null : (
            <ProfileItem
              key={profile.id}
              profile={profile}
              selected={context === "order" && profile.id === selectedId}
              context={context}
              onEdit={() => {
                setNotice(null);
                setEditing(profile.id);
              }}
              onDone={setNotice}
            />
          ),
        )}
      </ul>
      {editing === "new" && (
        <BrandProfileForm
          key="new"
          profile={null}
          context={context}
          onSaved={saved}
          onCancel={() => setEditing(null)}
        />
      )}
      {editingProfile && (
        <BrandProfileForm
          key={editingProfile.id}
          profile={editingProfile}
          context={context}
          onSaved={saved}
          onCancel={() => setEditing(null)}
        />
      )}
      {editing === null && profiles.length < max && (
        <Button
          variant="secondary"
          icon={<Plus aria-hidden className="size-4" />}
          onClick={() => {
            setNotice(null);
            setEditing("new");
          }}
          className="w-fit max-sm:w-full"
        >
          {profiles.length === 0 ? text.addFirst : text.add}
        </Button>
      )}
    </div>
  );
}

function ProfileItem({
  profile,
  selected,
  context,
  onEdit,
  onDone,
}: {
  profile: BrandProfileView;
  selected: boolean;
  context: "order" | "account";
  onEdit: () => void;
  onDone: (message: string | null) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const colours = text.colours(profile.primaryColour, profile.secondaryColour);
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border bg-surface p-4",
        selected ? "border-teal shadow-card" : "border-line",
      )}
    >
      <div className="flex gap-3">
        {profile.logo ? (
          <LogoPreview
            src={`/api/launch/logo?profile=${profile.id}&v=${profile.updatedAt.getTime()}`}
            {...profile.logo}
            alt={copy.packaging.logo.previewAlt(profile.brandName)}
            className="size-16 p-1"
          />
        ) : (
          <div className="grid size-16 shrink-0 place-items-center rounded-lg border border-dashed border-line-strong p-1 text-center text-label text-muted">
            {text.noLogo}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="min-w-0 text-base font-extrabold break-words text-ink">{profile.profileName}</h4>
            {profile.isDefault && <Badge variant="gold">{text.badgeDefault}</Badge>}
            {selected && <Badge variant="teal">{text.badgeSelected}</Badge>}
          </div>
          <p className="text-sm break-words text-muted">{profile.brandName}</p>
          {colours && (
            <p className="mt-1 flex items-center gap-1.5 text-small text-muted">
              {[profile.primaryColour, profile.secondaryColour].map(
                (colour) =>
                  colour && (
                    <span
                      key={colour}
                      aria-hidden
                      className="size-4 rounded-full border border-line"
                      style={{ backgroundColor: colour }}
                    />
                  ),
              )}
              <span className="sr-only">{colours}</span>
            </p>
          )}
        </div>
      </div>
      {!profile.logo && <p className="text-small text-muted">{text.logoNeeded}</p>}
      {confirming ? (
        <DeleteConfirm profile={profile} context={context} onCancel={() => setConfirming(false)} onDone={onDone} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {context === "order" && !selected && profile.logo && (
            <ProfileAction
              action={chooseBrandProfileAction}
              id={profile.id}
              context={context}
              label={text.use}
              ariaLabel={text.useLabel(profile.profileName)}
              onDone={onDone}
              primary
            />
          )}
          {!profile.isDefault && (
            <ProfileAction
              action={setDefaultBrandProfileAction}
              id={profile.id}
              context={context}
              label={text.makeDefault}
              ariaLabel={text.makeDefaultLabel(profile.profileName)}
              onDone={onDone}
            />
          )}
          <Button variant="secondary" size="sm" aria-label={text.editLabel(profile.profileName)} onClick={onEdit}>
            {text.edit}
          </Button>
          <Button
            variant="link"
            size="sm"
            aria-label={text.removeLabel(profile.profileName)}
            onClick={() => setConfirming(true)}
          >
            {text.remove}
          </Button>
        </div>
      )}
    </li>
  );
}

type ProfileAction = (state: ProfileChangeResult | null, formData: FormData) => Promise<ProfileChangeResult>;

/** A one-button form that changes a saved brand (use, make default). */
function ProfileAction({
  action,
  id,
  context,
  label,
  ariaLabel,
  onDone,
  primary,
}: {
  action: ProfileAction;
  id: number;
  context: "order" | "account";
  label: string;
  ariaLabel: string;
  onDone: (message: string | null) => void;
  primary?: boolean;
}) {
  const [, formAction, pending] = useActionState(async (previous: ProfileChangeResult | null, formData: FormData) => {
    const result = await action(previous, formData);
    onDone(result.message);
    return result;
  }, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="context" value={context} />
      <Button type="submit" size="sm" variant={primary ? "primary" : "secondary"} loading={pending} aria-label={ariaLabel}>
        {label}
      </Button>
    </form>
  );
}

function DeleteConfirm({
  profile,
  context,
  onCancel,
  onDone,
}: {
  profile: BrandProfileView;
  context: "order" | "account";
  onCancel: () => void;
  onDone: (message: string | null) => void;
}) {
  const [, formAction, pending] = useActionState(async (previous: ProfileChangeResult | null, formData: FormData) => {
    const result = await deleteBrandProfileAction(previous, formData);
    onDone(result.message);
    return result;
  }, null);
  return (
    <form action={formAction} role="group" aria-label={text.removeConfirm(profile.profileName)} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={profile.id} />
      <input type="hidden" name="context" value={context} />
      <p className="text-sm font-bold text-ink">{text.removeConfirm(profile.profileName)}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" loading={pending}>
          {text.removeYes}
        </Button>
        <Button variant="link" size="sm" onClick={onCancel}>
          {text.removeNo}
        </Button>
      </div>
    </form>
  );
}
