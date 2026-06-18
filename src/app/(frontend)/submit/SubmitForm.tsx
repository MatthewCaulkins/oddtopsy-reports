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
      <input type="hidden" name="manuscriptBody" value={html} required />
    </div>
  )
}

export function SubmitForm({ focusAreas }: SubmitFormProps) {
  const [submissionType, setSubmissionType] = useState<'upload' | 'editor'>('upload')
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([])
  type FormError = {
    name: string
    label: string
  }

  const [errors, setErrors] = useState<FormError[]>([])
  function hasError(name: string) {
    return errors.some((error) => error.name === name)
  }

  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateCoAuthor(index: number, key: keyof CoAuthor, value: string) {
    setCoAuthors((current) =>
      current.map((author, i) => (i === index ? { ...author, [key]: value } : author)),
    )
  }

  function validateForm(form: HTMLFormElement) {
    const nextErrors: FormError[] = []

    const requiredFields = [
      { name: 'title', label: 'Paper title' },
      { name: 'featuredImage', label: 'Featured image' },
      { name: 'abstract', label: 'Abstract / summary' },
      { name: 'focusArea', label: 'Focus areas' },
      { name: 'correspondingAuthorEmail', label: 'Corresponding author email' },
      { name: 'correspondingAuthorName', label: 'Corresponding author name' },
      { name: 'leadAuthorName', label: 'Lead author name' },
    ]

    requiredFields.forEach((field) => {
      const input = form.elements.namedItem(field.name)

      if (input instanceof HTMLInputElement) {
        if (input.type === 'file') {
          if (!input.files || input.files.length === 0) {
            nextErrors.push(field)
          }
        } else if (!input.value.trim()) {
          nextErrors.push(field)
        }
      }

      if (input instanceof HTMLTextAreaElement) {
        if (!input.value.trim()) nextErrors.push(field)
      }

      if (input instanceof HTMLSelectElement) {
        if (input.multiple) {
          const selected = Array.from(input.selectedOptions).filter((option) => option.value)

          if (selected.length === 0) nextErrors.push(field)
        } else if (!input.value) {
          nextErrors.push(field)
        }
      }
    })

    if (submissionType === 'upload') {
      const fileInput = form.elements.namedItem('manuscriptPDF')

      if (
        fileInput instanceof HTMLInputElement &&
        (!fileInput.files || fileInput.files.length === 0)
      ) {
        nextErrors.push({ name: 'manuscriptPDF', label: 'Manuscript PDF' })
      }
    }

    if (submissionType === 'editor') {
      const manuscriptBody = form.elements.namedItem('manuscriptBody')

      const bodyValue =
        manuscriptBody instanceof HTMLInputElement
          ? manuscriptBody.value
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, '')
              .trim()
          : ''

      if (!bodyValue) {
        nextErrors.push({
          name: 'manuscriptBody',
          label: 'Manuscript body',
        })
      }
    }

    return nextErrors
  }

  return (
    <form
      className="submit-form"
      action={submitPaper}
      noValidate
      onSubmit={(event) => {
        const nextErrors = validateForm(event.currentTarget)

        if (nextErrors.length > 0) {
          event.preventDefault()
          setErrors(nextErrors)

          document.querySelector('.form-error-summary')?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          })

          return
        }

        setErrors([])
        setIsSubmitting(true)
      }}
    >
      {errors.length > 0 && (
        <div className="form-error-summary">
          <h3>Please complete the required fields.</h3>
          <ul>
            {errors.map((error) => (
              <li key={error.name}>{error.label}</li>
            ))}
          </ul>
        </div>
      )}
      <section className="form-section">
        <div className="section-heading-rule">
          <h2>Paper Details</h2>
        </div>

        <div className={`form-row ${hasError('title') ? 'is-invalid' : ''}`}>
          <label htmlFor="title">
            Paper title <span className="required">*</span>
          </label>
          <div>
            <input id="title" name="title" required />
            {hasError('title') && (
              <p className="field-error">Please complete this required field.</p>
            )}
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="title">Subtitle</label>
          <input id="subtitle" name="subtitle" />
        </div>

        <FileUpload
          name="featuredImage"
          label="Featured Image"
          accept="image/*"
          required
          invalid={hasError('featuredImage')}
        />

        <div className={`form-row ${hasError('abstract') ? 'is-invalid' : ''}`}>
          <label htmlFor="abstract">
            Abstract <span className="required">*</span>
          </label>
          <div>
            <textarea id="abstract" name="abstract" rows={5} required />
            {hasError('abstract') && (
              <p className="field-error">Please complete this required field.</p>
            )}
          </div>
        </div>

        <div className={`form-row ${hasError('focusArea') ? 'is-invalid' : ''}`}>
          <label htmlFor="focusArea">
            Focus areas <span className="required">*</span>
          </label>
          <div>
            <select id="focusArea" name="focusArea" multiple required>
              {focusAreas.map((focusArea) => (
                <option key={focusArea.id} value={focusArea.id}>
                  {focusArea.name}
                </option>
              ))}
            </select>
            {hasError('focusArea') && (
              <p className="field-error">Please complete this required field.</p>
            )}
          </div>
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
          <h3>Corresponding Author</h3>

          <div className={`form-row ${hasError('correspondingAuthorName') ? 'is-invalid' : ''}`}>
            <label htmlFor="correspondingAuthorName">
              Name <span className="required">*</span>
            </label>
            <div>
              <input id="correspondingAuthorName" name="correspondingAuthorName" required />
              {hasError('correspondingAuthorName') && (
                <p className="field-error">Please complete this required field.</p>
              )}
            </div>
          </div>

          <div className={`form-row ${hasError('correspondingAuthorEmail') ? 'is-invalid' : ''}`}>
            <label htmlFor="correspondingAuthorEmail">
              Email <span className="required">*</span>
            </label>
            <div>
              <input id="correspondingAuthorEmail" name="correspondingAuthorEmail" required />
              {hasError('correspondingAuthorEmail') && (
                <p className="field-error">Please complete this required field.</p>
              )}
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="correspondingAuthorAffiliation">Affiliation</label>
            <input id="correspondingAuthorAffiliation" name="correspondingAuthorAffiliation" />
          </div>
        </div>

        <div className="author-card">
          <h3>Lead Author</h3>

          <div className={`form-row ${hasError('leadAuthorName') ? 'is-invalid' : ''}`}>
            <label htmlFor="leadAuthorName">
              Name <span className="required">*</span>
            </label>
            <div>
              <input id="leadAuthorName" name="leadAuthorName" required />
              {hasError('leadAuthorName') && (
                <p className="field-error">Please complete this required field.</p>
              )}
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="leadAuthorAffiliation">Affiliation</label>
            <input id="leadAuthorAffiliation" name="affiliation" />
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
          <FileUpload
            name="manuscriptPDF"
            label="Manuscript PDF"
            accept="application/pdf"
            required
            invalid={hasError('manuscriptPDF')}
          />
        )}

        {submissionType === 'editor' && (
          <div className={`form-row ${hasError('manuscriptBody') ? 'is-invalid' : ''}`}>
            <label htmlFor="manuscriptBody">
              Manuscript body <span className="required">*</span>
            </label>
            <div>
              <div className="editor-field">
                <ManuscriptEditor />
                {hasError('manuscriptBody') && (
                  <p className="field-error">Please complete this required field.</p>
                )}
              </div>
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

      <button className="button primary submit-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting…' : 'Submit Paper'}
      </button>
    </form>
  )
}
