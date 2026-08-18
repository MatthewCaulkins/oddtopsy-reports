import { postgresAdapter } from '@payloadcms/db-postgres'

import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { EditorNotes } from './collections/EditorNotes'
import { FocusAreas } from './collections/FocusAreas'
import { Media } from './collections/Media'
import { Submissions } from './collections/Submissions'
import { Users } from './collections/Users'
import { About } from './globals/About'

import { richTextEditor } from '@/editor/richTextEditor'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

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
  collections: [EditorNotes, FocusAreas, Media, Submissions, Users],
  editor: richTextEditor,
  globals: [About],
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [],
})
