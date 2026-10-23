import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import type { EmailAdapter, SendEmailOptions } from 'payload'

/*
 * Payload email adapter for Amazon SES (v2) using "simple" content.
 *
 * Why not nodemailer: its SES transport sends raw MIME, which SES
 * authorizes as ses:SendRawEmail. Simple content needs only
 * ses:SendEmail (granted to the ECS task role on the oddtopsies.org
 * identity and its default configuration set), supports HTML with a
 * plain-text alternative, and returns SES's message ID for logging.
 */

type AddressLike = string | { name?: string; address: string } | undefined | null

function addressList(value: AddressLike | AddressLike[]): string[] {
  const values = Array.isArray(value) ? value : [value]

  return values
    .flatMap((item) => {
      if (!item) return []
      if (typeof item === 'string') return item.split(',')
      return [item.name ? `${quoteName(item.name)} <${item.address}>` : item.address]
    })
    .map((item) => item.trim())
    .filter(Boolean)
}

function quoteName(name: string) {
  return `"${name.replace(/["\\]/g, '')}"`
}

function asText(value: unknown) {
  return typeof value === 'string' ? value : value instanceof Buffer ? value.toString('utf8') : undefined
}

export type SESAdapterOptions = {
  fromAddress: string
  fromName: string
  region: string
  // Injected in tests.
  client?: Pick<SESv2Client, 'send'>
}

export function sesEmailAdapter({ fromAddress, fromName, region, client }: SESAdapterOptions): EmailAdapter<{
  messageId?: string
}> {
  const ses = client ?? new SESv2Client({ region })

  return () => ({
    name: 'ses',
    defaultFromAddress: fromAddress,
    defaultFromName: fromName,
    async sendEmail(message: SendEmailOptions) {
      const to = addressList(message.to as AddressLike | AddressLike[])
      const cc = addressList(message.cc as AddressLike | AddressLike[])
      const bcc = addressList(message.bcc as AddressLike | AddressLike[])

      if (to.length + cc.length + bcc.length === 0) {
        throw new Error('Email has no recipients.')
      }

      const html = asText(message.html)
      const text = asText(message.text)

      if (!html && !text) {
        throw new Error('Email has no body.')
      }

      const from = message.from
        ? addressList(message.from as AddressLike)[0]
        : `${quoteName(fromName)} <${fromAddress}>`

      const result = await ses.send(
        new SendEmailCommand({
          FromEmailAddress: from,
          Destination: {
            ToAddresses: to,
            ...(cc.length ? { CcAddresses: cc } : {}),
            ...(bcc.length ? { BccAddresses: bcc } : {}),
          },
          ...(message.replyTo ? { ReplyToAddresses: addressList(message.replyTo as AddressLike) } : {}),
          Content: {
            Simple: {
              Subject: { Data: String(message.subject ?? ''), Charset: 'UTF-8' },
              Body: {
                ...(html ? { Html: { Data: html, Charset: 'UTF-8' } } : {}),
                ...(text ? { Text: { Data: text, Charset: 'UTF-8' } } : {}),
              },
            },
          },
        }),
      )

      return { messageId: result.MessageId }
    },
  })
}
