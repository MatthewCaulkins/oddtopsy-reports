'use client'

import { useState } from 'react'
import type { FocusArea, Media, Submission } from '@/payload-types'
import { FileUpload, type ExistingFile } from '../FileUpload'
import { ManuscriptEditor } from './ManuscriptEditor'

type CoAuthor = {
  name: string
  affiliation: string
}

type FormError = {
  name: string
  label: string
}

type SubmissionFormProps = {
  mode: 'create' | 'edit'
  focusAreas: FocusArea[]
  submission?: Submission
  action: (formData: FormData) => void | Promise<void>
  submitLabel?: string
}

function getSelectedFocusIDs(submission?: Submission) {
  if (!submission?.focusArea || !Array.isArray(submission.focusArea)) return []

  return submission.focusArea
    .map((area) => (typeof area === 'object' ? String(area.id) : String(area)))
    .filter(Boolean)
}

function keywordsToString(submission?: Submission) {
  return submission?.keywords?.map((item) => item.keyword).filter(Boolean).join(', ') || ''
}

function mediaToExistingFile(media: number | Media | null | undefined) {
  if (!media || typeof media !== 'object') return []

  return [
    {
      id: media.id,
      url: media.sizes?.card?.url || media.url,
      filename: media.filename,
      alt: media.alt,
      mimeType: media.mimeType,
    },
  ]
}

function supportingImagesToExistingFiles(submission?: Submission): ExistingFile[] {
  const files =
    submission?.supportingImages?.map((item, index): ExistingFile | null => {
      const image = item.image

      if (!image || typeof image !== 'object') return null

      return {
        id: image.id ?? `supporting-${index}`,
        url: image.sizes?.card?.url || image.url,
        filename: image.filename,
        alt: image.alt || item.caption,
        mimeType: image.mimeType,
      }
    }) || []

  return files.filter((item): item is ExistingFile => item !== null)
}

export function SubmissionForm({
  mode,
  focusAreas,
  submission,
  action,
  submitLabel = mode === 'edit' ? 'Save Changes' : 'Submit Paper',
}: SubmissionFormProps) {
  const isEdit = mode === 'edit'
  const hasExistingFeaturedImage = Boolean(submission?.featuredImage)
  const hasExistingPDF = Boolean(submission?.manuscriptPDF)

  const selectedFocusIDs = getSelectedFocusIDs(submission)

  const [submissionType, setSubmissionType] = useState<'upload' | 'editor'>(
    submission?.submissionType || 'upload',
  )

  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>(
    submission?.coAuthors?.map((author) => ({
      name: author.name || '',
      affiliation: author.affiliation || '',
    })) || [],
  )

  const [errors, setErrors] = useState<FormError[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  function hasError(name: string) {
    return errors.some((error) => error.name === name)
  }

  function updateCoAuthor(index: number, key: keyof CoAuthor, value: string) {
    setCoAuthors((current) =>
      current.map((author, i) => (i === index ? { ...author, [key]: value } : author)),
    )
  }

  function validateForm(form: HTMLFormElement) {
    const nextErrors: FormError[] = []

    const requiredFields: FormError[] = [
      { name: 'title', label: 'Paper title' },
      { name: 'abstract', label: 'Abstract / summary' },
      { name: 'focusArea', label: 'Focus areas' },
      { name: 'correspondingAuthorEmail', label: 'Corresponding author email' },
      { name: 'correspondingAuthorName', label: 'Corresponding author name' },
      { name: 'leadAuthorName', label: 'Lead author name' },
    ]

    if (!isEdit || !hasExistingFeaturedImage) {
      requiredFields.splice(1, 0, { name: 'featuredImage', label: 'Featured image' })
    }

    requiredFields.forEach((field) => {
      const input = form.elements.namedItem(field.name)

      if (input instanceof HTMLInputElement) {
        if (input.type === 'file') {
          if (!input.files || input.files.length === 0) nextErrors.push(field)
        } else if (!input.value.trim()) {
          nextErrors.push(field)
        }
      }

      if (input instanceof HTMLTextAreaElement && !input.value.trim()) {
        nextErrors.push(field)
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

    if (submissionType === 'upload' && (!isEdit || !hasExistingPDF)) {
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
          ? manuscriptBody.value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim()
          : ''

      if (!bodyValue) {
        nextErrors.push({ name: 'manuscriptBody', label: 'Manuscript body' })
      }
    }

    return nextErrors
  }

  return (
    <form
      className="submit-form"
      action={action}
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
      {isEdit && submission?.id && <input type="hidden" name="id" value={submission.id} />}

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
            <input id="title" name="title" defaultValue={submission?.title || ''} required />
            {hasError('title') && <p className="field-error">Please complete this required field.</p>}
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="subtitle">Subtitle</label>
          <input id="subtitle" name="subtitle" defaultValue={submission?.subtitle || ''} />
        </div>

        <FileUpload
          name="featuredImage"
          label="Featured Image"
          accept="image/*"
          required={!isEdit || !hasExistingFeaturedImage}
            invalid={hasError('featuredImage')}
            existingFiles={mediaToExistingFile(submission?.featuredImage)}
        />

        <div className={`form-row ${hasError('abstract') ? 'is-invalid' : ''}`}>
          <label htmlFor="abstract">
            Abstract <span className="required">*</span>
          </label>
          <div>
            <textarea
              id="abstract"
              name="abstract"
              rows={5}
              defaultValue={submission?.abstract || ''}
              required
            />
            {hasError('abstract') && <p className="field-error">Please complete this required field.</p>}
          </div>
        </div>

        <div className={`form-row ${hasError('focusArea') ? 'is-invalid' : ''}`}>
          <label htmlFor="focusArea">
            Focus areas <span className="required">*</span>
          </label>
          <div>
            <select id="focusArea" name="focusArea" multiple required defaultValue={selectedFocusIDs}>
              {focusAreas.map((focusArea) => (
                <option key={focusArea.id} value={focusArea.id}>
                  {focusArea.name}
                </option>
              ))}
            </select>
            {hasError('focusArea') && <p className="field-error">Please complete this required field.</p>}
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="keywords">Suggested keywords</label>
          <input
            id="keywords"
            name="keywords"
            defaultValue={keywordsToString(submission)}
            placeholder="muscular variation, cadaveric dissection, anatomy education"
          />
        </div>

        <div className="form-row">
          <label htmlFor="findingDate">Date of finding</label>
          <input
            id="findingDate"
            name="findingDate"
            type="date"
            defaultValue={submission?.findingDate ? submission.findingDate.slice(0, 10) : ''}
          />
        </div>

        <div className="form-row">
          <label htmlFor="location">Location</label>
          <input
            id="location"
            name="location"
            defaultValue={submission?.location || ''}
            placeholder="Institution, city, state, or country"
          />
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
              <input
                id="correspondingAuthorName"
                name="correspondingAuthorName"
                defaultValue={submission?.correspondingAuthor?.name || ''}
                required
              />
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
              <input
                id="correspondingAuthorEmail"
                name="correspondingAuthorEmail"
                type="email"
                defaultValue={submission?.correspondingAuthor?.email || ''}
                required
              />
              {hasError('correspondingAuthorEmail') && (
                <p className="field-error">Please complete this required field.</p>
              )}
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="correspondingAuthorAffiliation">Affiliation</label>
            <input
              id="correspondingAuthorAffiliation"
              name="correspondingAuthorAffiliation"
              defaultValue={submission?.correspondingAuthor?.affiliation || ''}
            />
          </div>
        </div>

        <div className="author-card">
          <h3>Lead Author</h3>

          <div className={`form-row ${hasError('leadAuthorName') ? 'is-invalid' : ''}`}>
            <label htmlFor="leadAuthorName">
              Name <span className="required">*</span>
            </label>
            <div>
              <input
                id="leadAuthorName"
                name="leadAuthorName"
                defaultValue={submission?.leadAuthor?.name || ''}
                required
              />
              {hasError('leadAuthorName') && (
                <p className="field-error">Please complete this required field.</p>
              )}
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="leadAuthorAffiliation">Affiliation</label>
            <input
              id="leadAuthorAffiliation"
              name="leadAuthorAffiliation"
              defaultValue={submission?.leadAuthor?.affiliation || ''}
            />
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
            <p className="form-help">Add any additional authors who should appear on the published paper.</p>
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
                <input value={author.name} onChange={(event) => updateCoAuthor(index, 'name', event.target.value)} />
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
            required={!isEdit || !hasExistingPDF}
            invalid={hasError('manuscriptPDF')}
            existingFiles={mediaToExistingFile(submission?.manuscriptPDF)}
          />
        )}

        {submissionType === 'editor' && (
          <div className={`form-row ${hasError('manuscriptBody') ? 'is-invalid' : ''}`}>
            <label htmlFor="manuscriptBody">
              Manuscript body <span className="required">*</span>
            </label>
            <div>
              <ManuscriptEditor />
              {hasError('manuscriptBody') && (
                <p className="field-error">Please complete this required field.</p>
              )}
            </div>
          </div>
        )}

        <FileUpload
            name="supportingImages"
            label="Supporting Images"
            accept="image/*"
            multiple
            existingFiles={supportingImagesToExistingFiles(submission)}
        />
      </section>

      <section className="form-section">
        <div className="section-heading-rule">
          <h2>Editor Notes</h2>
        </div>

        <div className="form-row">
          <label htmlFor="mediaNotes">Image / figure notes</label>
          <textarea id="mediaNotes" name="mediaNotes" rows={4} defaultValue={submission?.mediaNotes || ''} />
        </div>

        <div className="form-row">
          <label htmlFor="authorMessage">Message to editors</label>
          <textarea id="authorMessage" name="authorMessage" rows={4} defaultValue={submission?.authorMessage || ''} />
        </div>
      </section>

      <button className="button primary submit-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting…' : submitLabel}
      </button>
    </form>
  )
}