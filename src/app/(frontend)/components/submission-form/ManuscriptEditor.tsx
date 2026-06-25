'use client'

import { useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

type ManuscriptEditorProps = {
  initialHTML?: string
}

export function ManuscriptEditor({ initialHTML = '' }: ManuscriptEditorProps) {
  const [html, setHtml] = useState(initialHTML)

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialHTML,
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
        <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
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