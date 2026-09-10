export function hasRichContent(value?: string | null): boolean {
  if (!value) return false

  const text = value
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, '')
    .replace(/&#160;/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()

  const hasMedia = /<(img|video|audio|iframe|figure)\b/i.test(value)

  return text.length > 0 || hasMedia
}
