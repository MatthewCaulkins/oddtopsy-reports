import { postgresAdapter } from '@payloadcms/db-postgres'
import { s3Storage } from '@payloadcms/storage-s3'

import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { About } from './globals/About'
import { EditorNotes } from './collections/EditorNotes'
import { FocusAreas } from './collections/FocusAreas'
import { Media } from './collections/Media'
import { Submissions } from './collections/Submissions'
import { SiteContent } from './collections/SiteContent'
import { Users } from './collections/Users'

import { richTextEditor } from '@/editor/richTextEditor'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const useS3 = process.env.S3_ENABLED === 'true'
// const s3Bucket = process.env.S3_BUCKET

const useDatabaseSSL = process.env.DATABASE_SSL === 'true'

const databaseURL =
  process.env.DATABASE_URL ||
  (process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_HOST && process.env.DB_NAME
    ? `postgresql://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_HOST}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME}`
    : '')

export default buildConfig({
  admin: {
    components: {
      actions: ['@/components/admin/AdminUserMenu'],
    },
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [EditorNotes, FocusAreas, Media, Submissions, SiteContent, Users],
  editor: richTextEditor,
  globals: [About],
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: databaseURL,
      ...(useDatabaseSSL
        ? {
            ssl: {
              rejectUnauthorized: false,
            },
          }
        : {}),
    },
  }),
  sharp,
  plugins: [
    s3Storage({
      enabled: useS3,

      collections: {
        media: true,
      },

      bucket: process.env.S3_BUCKET || '',

      config: {
        region: process.env.AWS_REGION || 'us-east-1',
      },
    }),
  ],
})
