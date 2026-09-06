type Props = {
  page: 'papers' | 'submit' | 'about' | 'subscribe'
}

export function EditPageButton({ page }: Props) {
  return (
    <div className="paper-editor-actions">
      <a href={`/editorial/pages/${page}`} className="button secondary">
        Edit Page
      </a>
    </div>
  )
}
