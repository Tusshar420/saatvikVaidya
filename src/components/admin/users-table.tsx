"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { Modal, ModalContent } from "@/components/ui/modal";
import { bulkUsersAction } from "@/app/admin/users/actions";
import { admin as copy } from "@/content/admin";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { formatIndianPhone } from "@/lib/phone";
import { idleForm, type FormState } from "@/server/admin/form";
import type { UserRow } from "@/server/admin/users";
import { VerificationBadge } from "./badges";
import { dangerButtonClasses } from "./confirm-delete";
import { DataTable, EmptyRow, TBody, THead, Td, Th, Tr } from "./data-table";

const text = copy.users;
type Operation = "approve" | "reject" | "delete";

/**
 * The users list with checkboxes and bulk approve / reject / delete. Every
 * bulk action asks for confirmation first.
 */
export function UsersTable({
  rows,
  currentUserId,
  emptyText = text.empty,
}: {
  rows: UserRow[];
  currentUserId: string;
  /** Shown in the table when there are no rows. */
  emptyText?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<Operation | null>(null);
  const [note, setNote] = useState("");
  const [state, action, pending] = useActionState(
    async (previous: FormState, formData: FormData) => {
      const result = await bulkUsersAction(previous, formData);
      // Done: close the dialog, and clear the selection (the rows changed).
      setConfirming(null);
      if (result.status === "success") {
        setSelected(new Set());
        setNote("");
      }
      return result;
    },
    idleForm,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form ref={formRef} action={action} className="mt-6 flex flex-col gap-4">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <input type="hidden" name="operation" value={confirming ?? ""} />
      {/* The dialog renders outside the form, so its note is mirrored here. */}
      <input
        type="hidden"
        name="note"
        value={confirming === "delete" ? "" : note}
      />

      <div
        role="group"
        aria-label={text.bulk.label}
        className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3 shadow-card sm:flex-row sm:items-center"
      >
        <label className="flex min-h-11 cursor-pointer items-center gap-3 px-1 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelected(
                allSelected ? new Set() : new Set(rows.map((row) => row.id)),
              )
            }
            className="size-5 cursor-pointer accent-brand"
          />
          {text.selectAll}
        </label>
        <span
          aria-live="polite"
          className="text-small font-semibold text-muted sm:ml-auto"
        >
          {text.selected(selected.size)}
        </span>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          {(["approve", "reject", "delete"] as const).map((operation) => (
            <Button
              key={operation}
              variant="secondary"
              size="sm"
              disabled={selected.size === 0 || pending}
              onClick={() => setConfirming(operation)}
              className={cn(operation === "delete" && dangerButtonClasses)}
            >
              {text.bulk[operation]}
            </Button>
          ))}
        </div>
      </div>

      {state.message && (
        <FormAlert tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormAlert>
      )}

      <DataTable caption={text.title}>
        <THead>
          <Th className="w-12">
            <span className="sr-only">{text.columns.select}</span>
          </Th>
          <Th>{text.columns.name}</Th>
          <Th>{text.columns.contact}</Th>
          <Th>{text.columns.type}</Th>
          <Th>{text.columns.status}</Th>
          <Th>{text.columns.joined}</Th>
        </THead>
        <TBody>
          {rows.length === 0 && <EmptyRow colSpan={6}>{emptyText}</EmptyRow>}
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td className="max-md:order-first max-md:-mb-1">
                <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center md:-m-2">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    aria-label={text.selectRow(row.name)}
                    className="size-5 cursor-pointer accent-brand"
                  />
                </label>
              </Td>
              <Td>
                <span className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/users/${row.id}`}
                    className="font-bold break-words text-brand hover:underline"
                  >
                    {row.name}
                  </Link>
                  {row.role === "admin" && (
                    <Badge variant="blue">{text.adminBadge}</Badge>
                  )}
                  {row.id === currentUserId && (
                    <span className="text-xs font-bold text-muted">
                      ({text.you})
                    </span>
                  )}
                </span>
              </Td>
              <Td label={text.columns.contact}>
                <span className="flex min-w-0 flex-col">
                  <span className="break-all">
                    {row.email ?? (
                      <span className="text-muted">{text.noEmail}</span>
                    )}
                  </span>
                  <span className="text-small text-muted">
                    {row.phoneNumber
                      ? formatIndianPhone(row.phoneNumber)
                      : text.noPhone}
                  </span>
                </span>
              </Td>
              <Td label={text.columns.type}>{row.userTypeLabel}</Td>
              <Td label={text.columns.status}>
                <VerificationBadge status={row.verificationStatus} />
              </Td>
              <Td label={text.columns.joined} className="whitespace-nowrap">
                {formatDate(row.createdAt)}
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>

      <Modal
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        {confirming && (
          <ModalContent
            title={text.bulk.confirmTitle[confirming](selected.size)}
            description={text.bulk.confirmBody[confirming]}
          >
            {confirming !== "delete" && (
              <label className="mb-5 flex flex-col text-xs font-extrabold text-ink">
                <span className="mb-1.5">{text.bulk.noteLabel}</span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  placeholder={text.bulk.notePlaceholder}
                  className={inputClasses}
                />
              </label>
            )}
            <div className="flex flex-wrap gap-3 max-sm:*:w-full">
              <Button
                loading={pending}
                onClick={() => formRef.current?.requestSubmit()}
                variant={confirming === "delete" ? "secondary" : "primary"}
                className={cn(confirming === "delete" && dangerButtonClasses)}
              >
                {text.bulk[confirming]}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(null)}>
                {copy.common.cancel}
              </Button>
            </div>
          </ModalContent>
        )}
      </Modal>
    </form>
  );
}
