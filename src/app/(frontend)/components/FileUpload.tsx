'use client'

import { useRef, useState } from 'react'

type UploadFile = {
  id: string
  file: File
  preview?: string
}

export type ExistingFile = {
  id: number | string
  url?: string | null
  filename?: string | null
  alt?: string | null
  mimeType?: string | null
}

type FileUploadProps = {
  name: string
  label: string
  accept?: string
  multiple?: boolean
  required?: boolean
  invalid?: boolean
  errorMessage?: string
  maxSize?: number
  existingFiles?: ExistingFile[]
  onRemoveExisting?: (id: number | string) => void
}

export function FileUpload({
  name,
  label,
  accept,
  multiple = false,
  required = false,
  invalid = false,
  errorMessage = 'Please complete this required field.',
  maxSize,
  existingFiles = [],
  onRemoveExisting,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<UploadFile[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)

  function handleFiles(selected: FileList | null) {
    if (!selected) return

    const selectedFiles = Array.from(selected)

    if (maxSize) {
      const oversized = selectedFiles.find((file) => file.size > maxSize)

      if (oversized) {
        setUploadError(
          `${oversized.name} is too large. Maximum file size is ${(maxSize / 1024 / 1024).toFixed(0)} MB.`,
        )

        if (inputRef.current) {
          inputRef.current.value = ''
        }

        return
      }
    }

    setUploadError(null)

    const next = selectedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))

    setFiles(multiple ? [...files, ...next] : next.slice(0, 1))
  }

  function removeFile(id: string) {
    setFiles((current) => current.filter((item) => item.id !== id))

    if (inputRef.current) {
      inputRef.current.value = ''
    }

    setUploadError(null)
  }

  return (
    <div className={`form-row file-upload-row ${invalid || uploadError ? 'is-invalid' : ''}`}>
      <label htmlFor={name}>
        {label} {required && <span className="required">*</span>}
      </label>

      <div className="file-upload">
        <label className="button secondary file-button" htmlFor={name}>
          Choose File{multiple ? 's' : ''}
        </label>

        <input
          ref={inputRef}
          id={name}
          name={name}
          hidden
          type="file"
          accept={accept}
          multiple={multiple}
          required={required}
          onChange={(event) => handleFiles(event.target.files)}
        />

        {existingFiles.length > 0 && (
          <div className="file-preview-list existing-file-list">
            {existingFiles.map((item) => {
              const isImage =
                item.mimeType?.startsWith('image/') ||
                item.url?.match(/\.(jpg|jpeg|png|webp|gif)$/i)

              return (
                <div className="file-preview existing-file-preview" key={item.id}>
                  {isImage && item.url ? (
                    <img src={item.url} alt={item.alt || ''} />
                  ) : (
                    <div className="file-preview-icon">PDF</div>
                  )}

                  <div className="file-preview-content">
                    <strong>{item.filename || item.alt || 'Existing file'}</strong>

                    <small>Current upload</small>
                  </div>

                  {onRemoveExisting && (
                    <button
                      type="button"
                      className="file-remove"
                      aria-label={`Remove ${item.filename || 'existing file'}`}
                      onClick={() => onRemoveExisting(item.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {files.length > 0 && (
          <div className="file-preview-list">
            {files.map((item) => (
              <div className="file-preview" key={item.id}>
                {item.preview ? (
                  <img src={item.preview} alt="" />
                ) : (
                  <div className="file-preview-icon">PDF</div>
                )}

                <div className="file-preview-content">
                  <strong>{item.file.name}</strong>

                  <small>{(item.file.size / 1024 / 1024).toFixed(1)} MB</small>
                </div>

                <button type="button" className="file-remove" onClick={() => removeFile(item.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {uploadError && <p className="field-error">{uploadError}</p>}

        {!uploadError && invalid && <p className="field-error">{errorMessage}</p>}
      </div>
    </div>
  )
}
