// src/app/api/editor-media/route.ts

import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers as getHeaders } from 'next/headers'

import config from '@/payload.config'

export async function GET() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({
    headers,
  })

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        message: 'Authentication required.',
        files: [],
      },
      {
        status: 401,
      },
    )
  }
  try {
    const payload = await getPayload({ config })

    const media = await payload.find({
      collection: 'media',
      where: {
        mimeType: {
          contains: 'image/',
        },
      },
      sort: '-createdAt',
      limit: 100,
      depth: 0,
    })

    return NextResponse.json({
      success: true,

      files: media.docs
        .filter((item) => item.url)
        .map((item) => ({
          id: item.id,
          url: item.url,
          thumbnail: item.sizes?.square?.url || item.sizes?.card?.url || item.url,
          filename: item.filename || item.alt || 'Image',
          alt: item.alt || '',
        })),
    })
  } catch (error) {
    console.error('Failed to load editor media:', error)

    return NextResponse.json(
      {
        success: false,
        files: [],
      },
      {
        status: 500,
      },
    )
  }
}
