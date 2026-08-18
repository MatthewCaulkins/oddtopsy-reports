'use client'

import { useField } from '@payloadcms/ui'

import { OddtopsyEditor } from '@/components/editor/OddtopsyEditor'

type Props = {
  path: string
}

export default function JoditField({ path }: Props) {
  const { value, setValue } = useField<string>({
    path,
  })

  return <OddtopsyEditor value={value || ''} onChange={setValue} allowMediaLibrary />
}
