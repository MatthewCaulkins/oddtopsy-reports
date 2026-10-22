import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { s3Storage } from '@payloadcms/storage-s3'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import nodemailer from 'nodemailer'

import path from 'path'
import { buildConfig, type EmailAdapter } from 'payload'
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

/*
 * Email goes through Amazon SES using the server's AWS credentials
 * (the ECS task role in production). Without EMAIL_FROM_ADDRESS,
 * as in local development, emails are printed to the server log
 * instead; bodies (which hold reset and revision links) are only
 * printed outside production.
 */
const emailFromAddress = process.env.EMAIL_FROM_ADDRESS

const logEmailAdapter: EmailAdapter = ({ payload }) => ({
  name: 'log',
  defaultFromAddress: 'no-reply@localhost',
  defaultFromName: 'Oddtopsy Reports',
  sendEmail: async (message) => {
    const to = Array.isArray(message.to) ? message.to.join(', ') : String(message.to)
    const body =
      process.env.NODE_ENV === 'production' ? '' : `\n\n${message.text || message.html || ''}`

    payload.logger.info(
      `Email not sent (EMAIL_FROM_ADDRESS is not set). To: ${to}, Subject: ${message.subject}${body}`,
    )
  },
})

const email = emailFromAddress
  ? nodemailerAdapter({
      defaultFromAddress: emailFromAddress,
      defaultFromName: process.env.EMAIL_FROM_NAME || 'Oddtopsy Reports',
      skipVerify: true,
      transport: nodemailer.createTransport({
        SES: {
          sesClient: new SESv2Client({
            region: process.env.SES_REGION || process.env.AWS_REGION || 'us-east-1',
          }),
          SendEmailCommand,
        },
      }),
    })
  : logEmailAdapter

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
  email,
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
