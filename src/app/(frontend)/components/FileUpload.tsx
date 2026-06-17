'use client'

import { useRef, useState } from 'react'

type UploadFile = {
  id: string
  file: File
  preview?: string
}

type FileUploadProps = {
  name: string
  label: string
  accept?: string
  multiple?: boolean
}

export function FileUpload({ name, label, accept, multiple = false }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<UploadFile[]>([])

  function handleFiles(selected: FileList | null) {
    if (!selected) return

    const next = Array.from(selected).map((file) => ({
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
  }

  return (
    <div className="form-row file-upload-row">
      <label htmlFor={name}>{label}</label>

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
          onChange={(event) => handleFiles(event.target.files)}
        />

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
      </div>
    </div>
  )
}
