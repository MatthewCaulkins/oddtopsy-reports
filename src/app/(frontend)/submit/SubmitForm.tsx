'use client'

import React, { useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { submitPaper } from './actions'
import type { FocusArea } from '@/payload-types'
import { FileUpload } from '../components/FileUpload'

type SubmitFormProps = {
  focusAreas: FocusArea[]
}

type CoAuthor = {
  name: string
  affiliation: string
}

function ManuscriptEditor() {
  const [html, setHtml] = useState('')

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
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

export function SubmitForm({ focusAreas }: SubmitFormProps) {
  const [submissionType, setSubmissionType] = useState<'upload' | 'editor'>('upload')
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([])

  function updateCoAuthor(index: number, key: keyof CoAuthor, value: string) {
    setCoAuthors((current) =>
      current.map((author, i) => (i === index ? { ...author, [key]: value } : author)),
    )
  }

  return (
    <form className="submit-form" action={submitPaper}>
      <section className="form-section">
        <div className="section-heading-rule">
          <h2>Paper Details</h2>
        </div>

        <div className="form-row">
          <label htmlFor="title">Paper title</label>
          <input id="title" name="title" required />
        </div>

        <div className="form-row">
          <label htmlFor="subtitle">Subtitle</label>
          <input id="subtitle" name="subtitle" />
        </div>

        <FileUpload name="featuredImage" label="Featured Image" accept="image/*" />

        <div className="form-row">
          <label htmlFor="abstract">Abstract / summary</label>
          <textarea name="abstract" rows={5} />
        </div>

        <div className="form-row">
          <label htmlFor="focusArea">Focus areas</label>
          <select id="focusArea" name="focusArea" multiple required>
            {focusAreas.map((focusArea) => (
              <option key={focusArea.id} value={focusArea.id}>
                {focusArea.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="keywords">Suggested keywords</label>
          <input
            id="keywords"
            name="keywords"
            placeholder="muscular variation, cadaveric dissection, anatomy education"
          />
        </div>

        <div className="form-row">
          <label htmlFor="findingDate">Date of finding</label>
          <input id="findingDate" name="findingDate" type="date" />
        </div>

        <div className="form-row">
          <label htmlFor="location">Location</label>
          <input id="location" name="location" placeholder="Institution, city, state, or country" />
        </div>
      </section>

      <section className="form-section">
        <div className="section-heading-rule">
          <h2>Authors</h2>
        </div>

        <div className="author-card">
          <h3>Lead Author</h3>

          <div className="form-row">
            <label htmlFor="leadAuthorName">Name</label>
            <input id="leadAuthorName" name="authorName" required />
          </div>

          <div className="form-row">
            <label htmlFor="leadAuthorAffiliation">Affiliation</label>
            <input id="leadAuthorAffiliation" name="affiliation" />
          </div>
        </div>

        <div className="author-card">
          <h3>Corresponding Author</h3>

          <div className="form-row">
            <label htmlFor="correspondingAuthorName">Name</label>
            <input id="correspondingAuthorName" name="correspondingAuthorName" required />
          </div>

          <div className="form-row">
            <label htmlFor="correspondingAuthorEmail">Email</label>
            <input id="correspondingAuthorEmail" name="authorEmail" type="email" required />
          </div>

          <div className="form-row">
            <label htmlFor="correspondingAuthorAffiliation">Affiliation</label>
            <input id="correspondingAuthorAffiliation" name="correspondingAuthorAffiliation" />
          </div>
        </div>

        <div className="author-card">
          <div className="form-group-header">
            <h3>Co-authors</h3>

            <button
              type="button"
              className="button secondary"
              onClick={() => setCoAuthors([...coAuthors, { name: '', affiliation: '' }])}
            >
              Add co-author
            </button>
          </div>

          {coAuthors.length === 0 && (
            <p className="form-help">
              Add any additional authors who should appear on the published paper.
            </p>
          )}

          {coAuthors.map((author, index) => (
            <div className="coauthor-card" key={index}>
              <div className="form-group-header">
                <h4>Co-author {index + 1}</h4>

                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setCoAuthors(coAuthors.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>

              <div className="form-row">
                <label>Name</label>
                <input
                  value={author.name}
                  onChange={(event) => updateCoAuthor(index, 'name', event.target.value)}
                />
              </div>

              <div className="form-row">
                <label>Affiliation</label>
                <input
                  value={author.affiliation}
                  onChange={(event) => updateCoAuthor(index, 'affiliation', event.target.value)}
                />
              </div>
            </div>
          ))}

          <input type="hidden" name="coAuthors" value={JSON.stringify(coAuthors)} />
        </div>
      </section>

      <section className="form-section">
        <div className="section-heading-rule">
          <h2>Submission Content</h2>
        </div>

        <div className="form-row">
          <label htmlFor="submissionType">Submission type</label>
          <div className="select-wrap">
            <select
              id="submissionType"
              name="submissionType"
              required
              value={submissionType}
              onChange={(event) => setSubmissionType(event.target.value as 'upload' | 'editor')}
            >
              <option value="upload">Upload a completed PDF</option>
              <option value="editor">Write/paste manuscript in editor</option>
            </select>
          </div>
        </div>

        {submissionType === 'upload' && (
          <FileUpload name="manuscriptPDF" label="Manuscript PDF" accept="application/pdf" />
        )}

        {submissionType === 'editor' && (
          <div className="form-row editor-row">
            <label htmlFor="manuscriptBody">Manuscript body</label>

            <div className="editor-field">
              <ManuscriptEditor />
            </div>
          </div>
        )}

        <FileUpload name="supportingImages" label="Supporting Images" accept="image/*" multiple />
      </section>

      <section className="form-section">
        <div className="section-heading-rule">
          <h2>Editor Notes</h2>
        </div>

        <div className="form-row">
          <label htmlFor="mediaNotes">Image / figure notes</label>
          <textarea id="mediaNotes" name="mediaNotes" rows={4} />
        </div>

        <div className="form-row">
          <label htmlFor="authorMessage">Message to editors</label>
          <textarea id="authorMessage" name="authorMessage" rows={4} />
        </div>
      </section>

      <button className="button primary submit-button" type="submit">
        Submit Paper
      </button>
    </form>
  )
}
