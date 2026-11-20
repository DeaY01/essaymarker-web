"use client";

import { useFormStatus } from "react-dom";
import { deleteReport } from "@/app/(app)/history/actions";
import { TrashIcon } from "@/components/icons";

function SubmitDelete() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button button-ghost button-sm danger-text" disabled={pending}>
      <TrashIcon size={14} />
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

export function DeleteReportButton({ id }: { id: string }) {
  return (
    <form
      action={deleteReport}
      onSubmit={(event) => {
        if (!window.confirm("Delete this report? This can’t be undone.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitDelete />
    </form>
  );
}
