/*
 * One responsive, lightly branded layout for every Oddtopsy Reports
 * email, with a matching plain-text alternative. Table layout and
 * inline styles, because many mail clients ignore <style> blocks.
 */

export type EmailContent = {
  // Shown by inbox previews; not visible in the message body.
  preheader: string
  heading: string
  greeting?: string
  paragraphs?: string[]
  details?: { label: string; value: string | null | undefined }[]
  // A block of someone's own words, e.g. the editors' revision instructions.
  quote?: { label: string; text: string }
  action?: { label: string; url: string }
  closing?: string[]
}

export type RenderedEmail = {
  html: string
  text: string
}

const brand = {
  name: 'Oddtopsy Reports',
  accent: '#285f73',
  text: '#172026',
  muted: '#5f6f78',
  surface: '#ffffff',
  background: '#eef2f3',
  border: '#d9e1e4',
}

/*
 * The site icon as a PNG (many clients block SVG), served publicly from
 * the site. With images blocked, the alt text shows in brand colour and
 * the name beside it still reads correctly.
 */
const siteURL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
const logoURL = /^https:\/\//.test(siteURL) ? `${siteURL}/branding/icon.png` : ''

function escapeHTML(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function paragraphsHTML(text: string) {
  return text
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 12px;">${escapeHTML(paragraph.trim()).replaceAll('\n', '<br />')}</p>`,
    )
    .join('')
}

export function renderEmail(content: EmailContent): RenderedEmail {
  const details = (content.details || []).filter((detail) => detail.value)

  const p = (text: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${brand.text};">${escapeHTML(text)}</p>`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHTML(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${brand.background};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHTML(content.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.background};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${brand.surface};border:1px solid ${brand.border};border-radius:12px;font-family:Georgia,'Times New Roman',serif;">
<tr><td style="padding:18px 28px;border-bottom:3px solid ${brand.accent};">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
${
  logoURL
    ? `<td style="padding-right:12px;vertical-align:middle;"><img src="${escapeHTML(logoURL)}" width="36" height="37" alt="Oddtopsy logo" style="display:block;width:36px;height:37px;border:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${brand.accent};" /></td>`
    : ''
}
<td style="vertical-align:middle;"><span style="font-size:20px;font-weight:bold;letter-spacing:0.5px;color:${brand.accent};">${brand.name}</span></td>
</tr></table>
</td></tr>
<tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;">
<h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:${brand.text};">${escapeHTML(content.heading)}</h1>
${content.greeting ? p(content.greeting) : ''}
${(content.paragraphs || []).map(p).join('\n')}
${
  details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid ${brand.border};border-radius:8px;">
${details
  .map(
    (detail, index) =>
      `<tr><td style="padding:10px 14px;width:35%;font-size:14px;color:${brand.muted};vertical-align:top;${index ? `border-top:1px solid ${brand.border};` : ''}">${escapeHTML(detail.label)}</td><td style="padding:10px 14px;font-size:14px;color:${brand.text};vertical-align:top;word-break:break-word;${index ? `border-top:1px solid ${brand.border};` : ''}">${escapeHTML(String(detail.value))}</td></tr>`,
  )
  .join('\n')}
</table>`
    : ''
}
${
  content.quote
    ? `<p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:${brand.muted};">${escapeHTML(content.quote.label)}</p>
<div style="margin:0 0 20px;padding:14px 16px;border-left:4px solid ${brand.accent};background:${brand.background};font-size:15px;line-height:1.6;color:${brand.text};">${paragraphsHTML(content.quote.text)}</div>`
    : ''
}
${
  content.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="border-radius:8px;background:${brand.accent};">
<a href="${escapeHTML(content.action.url)}" style="display:inline-block;padding:12px 22px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHTML(content.action.label)}</a>
</td></tr></table>
<p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:${brand.muted};">If the button doesn't work, copy this link into your browser:<br /><a href="${escapeHTML(content.action.url)}" style="color:${brand.accent};word-break:break-all;">${escapeHTML(content.action.url)}</a></p>`
    : ''
}
${(content.closing || []).map(p).join('\n')}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid ${brand.border};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${brand.muted};">
${brand.name} publishes unusual anatomical and autopsy findings. This message was sent by the editorial system at oddtopsies.org.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const textParts = [
    content.heading,
    '',
    ...(content.greeting ? [content.greeting, ''] : []),
    ...(content.paragraphs || []).flatMap((paragraph) => [paragraph, '']),
    ...(details.length ? [...details.map((detail) => `${detail.label}: ${detail.value}`), ''] : []),
    ...(content.quote ? [`${content.quote.label}:`, content.quote.text, ''] : []),
    ...(content.action ? [`${content.action.label}: ${content.action.url}`, ''] : []),
    ...(content.closing || []).flatMap((paragraph) => [paragraph, '']),
    '--',
    `${brand.name} · oddtopsies.org`,
  ]

  return { html, text: textParts.join('\n') }
}
