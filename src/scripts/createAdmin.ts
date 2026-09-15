import { getPayload } from 'payload'
import config from '@/payload.config'

const payload = await getPayload({ config })

const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD

if (!email || !password) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required.')
}

const existing = await payload.find({
  collection: 'users',
  where: {
    email: {
      equals: email,
    },
  },
  limit: 1,
})

if (!existing.docs.length) {
  await payload.create({
    collection: 'users',
    data: {
      email,
      password,
      role: 'admin',
      profile: {
        displayName: 'Matt',
      },
    },
  })

  console.log(`Created admin user: ${email}`)
} else {
  console.log(`Admin already exists: ${email}`)
}
