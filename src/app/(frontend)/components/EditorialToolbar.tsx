import { Submission } from "@/payload-types";
import { approveSubmission } from "../editorial/submissions/[id]/actions";

type EditorialToolbarProps = {
  submission: Submission
  mode: 'preview' | 'edit'
}

export function EditorialToolbar({ submission, mode }: EditorialToolbarProps) {
  const id = submission.id

  return (
    <section className="editorial-toolbar">
      <div className="editorial-toolbar-tabs">
        <a
          className={`button secondary ${mode === 'preview' ? 'is-active' : ''}`}
          href={`/editorial/submissions/${id}?mode=preview`}
        >
          Preview
        </a>

        <a
          className={`button secondary ${mode === 'edit' ? 'is-active' : ''}`}
          href={`/editorial/submissions/${id}?mode=edit`}
        >
          Edit
        </a>
      </div>

      <form action={approveSubmission}>
        <input type="hidden" name="id" value={id} />

        <button className="button primary" type="submit">
          Approve & Publish
        </button>
      </form>
    </section>
  )
}