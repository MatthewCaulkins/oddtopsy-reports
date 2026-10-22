import type { Payload } from 'payload'

/*
 * Reads the shared submission form (editorial edits and author
 * revisions) into update data, uploading any newly attached files.
 * It only produces content fields; callers decide workflow status.
 */

export type SubmissionUpdateData = {
  title: string
  subtitle: string
  abstract: string
  focusArea: number[]
  keywords: { keyword: string }[]
  findingDate: string | null
  location: string

  leadAuthor: {
    name: string
    affiliation: string
  }

  correspondingAuthor: {
    name: string
    email: string
    affiliation: string
  }

  coAuthors: {
    id?: string
    name: string
    affiliation: string
  }[]

  submissionType: 'upload' | 'editor'
  mediaNotes: string
  authorMessage: string

  featuredImage?: number
  manuscriptBody?: string | null
  manuscriptPDF?: number | null

  supportingImages?: {
    image: number
    caption?: string | null
  }[]
}

async function uploadMedia(payload: any, file: File, alt: string) {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const media = await payload.create({
    collection: 'media',
    data: { alt },
    file: {
      data: buffer,
      mimetype: file.type,
      name: file.name,
      size: file.size,
    },
  })

  return Number(media.id)
}

function parseJSON<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function parseNumericIDs(values: FormDataEntryValue[]): number[] {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
}

export async function buildSubmissionUpdate(
  payload: Payload,
  id: number | string,
  formData: FormData,
): Promise<SubmissionUpdateData> {
  const title = String(formData.get('title') || '').trim()
  const keywordsRaw = String(formData.get('keywords') || '').trim()

  const keywords = keywordsRaw
    ? keywordsRaw
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .map((keyword) => ({ keyword }))
    : []

  const coAuthors = parseJSON<
    {
      id?: string | null
      name: string
      affiliation: string
    }[]
  >(formData.get('coAuthors'), [])
    .map((author) => ({
      ...(author.id ? { id: author.id } : {}),
      name: String(author.name || '').trim(),
      affiliation: String(author.affiliation || '').trim(),
    }))
    .filter((author) => author.name)

  const findingDate = String(formData.get('findingDate') || '').trim()

  const submissionType = formData.get('submissionType') === 'editor' ? 'editor' : 'upload'

  const data: SubmissionUpdateData = {
    title,
    subtitle: String(formData.get('subtitle') || '').trim(),

    abstract: String(formData.get('abstract') || '').trim(),

    focusArea: parseNumericIDs(formData.getAll('focusArea')),

    keywords,

    findingDate: findingDate ? new Date(`${findingDate}T00:00:00`).toISOString() : null,

    location: String(formData.get('location') || '').trim(),

    leadAuthor: {
      name: String(formData.get('leadAuthorName') || '').trim(),

      affiliation: String(formData.get('leadAuthorAffiliation') || '').trim(),
    },

    correspondingAuthor: {
      name: String(formData.get('correspondingAuthorName') || '').trim(),

      email: String(formData.get('correspondingAuthorEmail') || '').trim(),

      affiliation: String(formData.get('correspondingAuthorAffiliation') || '').trim(),
    },

    coAuthors,
    submissionType,

    mediaNotes: String(formData.get('mediaNotes') || '').trim(),

    authorMessage: String(formData.get('authorMessage') || '').trim(),
  }

  const featuredImage = formData.get('featuredImage') as File | null

  if (featuredImage && featuredImage.size > 0) {
    data.featuredImage = await uploadMedia(payload, featuredImage, `${title} featured image`)
  }

  const manuscriptPDF = formData.get('manuscriptPDF') as File | null

  if (manuscriptPDF && manuscriptPDF.size > 0) {
    data.manuscriptPDF = await uploadMedia(payload, manuscriptPDF, `${title} manuscript PDF`)
  }

  if (submissionType === 'editor') {
    data.manuscriptBody = String(formData.get('manuscriptBody') || '').trim()

    data.manuscriptPDF = null
  }

  if (submissionType === 'upload') {
    data.manuscriptBody = null
  }

  const retainedSupportingImageIDs = parseJSON<Array<number | string>>(
    formData.get('retainedSupportingImageIDs'),
    [],
  )
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)

  const supportingImages = formData.getAll('supportingImages') as File[]

  const newSupportingImages = await Promise.all(
    supportingImages
      .filter((file) => file.size > 0)
      .map(async (file, index) => ({
        image: await uploadMedia(payload, file, `${title} supporting image ${index + 1}`),
        caption: '',
      })),
  )

  if (newSupportingImages.length > 0) {
    const existingSubmission = await payload.findByID({
      collection: 'submissions',
      id,
      depth: 0,
    })

    const retainedSupportingImages =
      existingSubmission.supportingImages
        ?.map((item) => {
          const imageID =
            typeof item.image === 'object' ? Number(item.image?.id) : Number(item.image)

          if (!imageID || !retainedSupportingImageIDs.includes(imageID)) {
            return null
          }

          return {
            image: imageID,
            caption: item.caption || '',
          }
        })
        .filter(
          (
            item,
          ): item is {
            image: number
            caption: string
          } => item !== null,
        ) || []

    data.supportingImages = [...retainedSupportingImages, ...newSupportingImages]
  }

  return data
}
