'use client'

import React, { useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { submitPaper } from './actions'

function ManuscriptEditor() {
  const [html, setHtml] = useState('')

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setHtml(editor.getHTML())
    },
  })

  return (
    <div className="editor-wrap">
      <div className="editor-toolbar">
        <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()}>
          Bold
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()}>
          Italic
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          Heading
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          Bullets
        </button>
      </div>

      <EditorContent editor={editor} className="rich-editor" />
      <input type="hidden" name="manuscriptHTML" value={html} required />
    </div>
  )
}

export function SubmitForm() {
  const [submissionType, setSubmissionType] = useState<'upload' | 'editor'>('upload')

  return (
    <form className="submit-form" action={submitPaper}>
      <label>
        Paper title
        <input name="title" required />
      </label>

      <label>
        Abstract / summary
        <textarea name="abstract" rows={5} />
      </label>

      <label>
        Corresponding author name
        <input name="authorName" required />
      </label>

      <label>
        Corresponding author email
        <input name="authorEmail" type="email" required />
      </label>

      <label>
        Affiliation
        <input name="affiliation" />
      </label>

      <label>
        Submission type
        <select
          name="submissionType"
          required
          value={submissionType}
          onChange={(event) => setSubmissionType(event.target.value as 'upload' | 'editor')}
        >
          <option value="upload">Upload a completed PDF</option>
          <option value="editor">Write/paste manuscript in editor</option>
        </select>
      </label>

      {submissionType === 'upload' && (
        <label>
          Manuscript PDF
          <input name="manuscriptPDF" type="file" accept="application/pdf" required />
        </label>
      )}

      {submissionType === 'editor' && (
        <label>
          Manuscript body
          <ManuscriptEditor />
        </label>
      )}

      <label>
        Message to editors
        <textarea name="authorMessage" rows={4} />
      </label>

      <button className="button primary" type="submit">
        Submit Paper
      </button>
    </form>
  )
}
