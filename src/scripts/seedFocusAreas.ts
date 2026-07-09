import { getPayload } from 'payload'
import config from '../payload.config'

const focusAreas = [
  'Muscular',
  'Skeletal',
  'Vascular',
  'Neurological',
  'Cadaveric Technique',
  'Educational Case Report',
  'Anatomical Variation',
  'Other',
]

export async function seedFocusAreas() {
  const payload = await getPayload({ config })

  for (let index = 0; index < focusAreas.length; index++) {
    const name = focusAreas[index]

    const existing = await payload.find({
      collection: 'focus-areas',
      where: {
        name: {
          equals: name,
        },
      },
      limit: 1,
    })

    if (existing.docs.length > 0) continue

    await payload.create({
      collection: 'focus-areas',
      data: {
        name,
        displayOrder: index + 1,
      },
    })
  }

  console.log('Focus areas seeded.')
}

seedFocusAreas()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
