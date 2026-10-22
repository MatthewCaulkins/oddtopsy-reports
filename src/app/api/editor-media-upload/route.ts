import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { hasRole } from '@/access/roles'
import { signedCookieOptions } from '@/lib/signedCookies'
import { createUploadGrantValue, uploadGrantCookie, uploadGrantMaxAge } from '@/lib/uploadGrants'

/*
 * Editors and anonymous authors (the public Submit form and
 * revision links) can both upload. Every upload starts staff-only
 * and becomes public when a published paper or page uses it.
 */
export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    const isEditor = hasRole(user, 'editor')
    const formData = await request.formData()
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024

    const uploadedFiles = Array.from(formData.values()).filter(
      (value): value is File => value instanceof File && value.size > 0,
    )

    if (uploadedFiles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 1,
          message: 'No file was uploaded.',
          files: [],
        },
        { status: 400 },
      )
    }

    const uploadedMedia: {
      id: number | string
      url: string
      filename?: string | null
      alt?: string | null
    }[] = []

    for (const file of uploadedFiles) {
      if (!allowedTypes.has(file.type)) {
        return NextResponse.json(
          {
            success: false,
            error: 1,
            message: 'Only JPG, PNG, WebP, and GIF images are allowed.',
            files: [],
          },
          { status: 400 },
        )
      }

      if (file.size > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            error: 1,
            message: 'Images must be 10 MB or smaller.',
            files: [],
          },
          { status: 400 },
        )
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const media = await payload.create({
        collection: 'media',
        data: {
          alt: file.name.replace(/\.[^.]+$/, ''),
        },
        file: {
          data: buffer,
          mimetype: file.type,
          name: file.name,
          size: file.size,
        },
        // Access was checked above; anonymous authors have no Payload user.
        overrideAccess: true,
      })

      if (media.url) {
        uploadedMedia.push({
          id: media.id,
          url: media.url,
          filename: media.filename,
          alt: media.alt,
        })
      }
    }

    if (uploadedMedia.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 1,
          message: 'No valid image files were uploaded.',
          files: [],
        },
        { status: 400 },
      )
    }

    const response = NextResponse.json({
      success: true,
      error: 0,
      message: '',
      files: uploadedMedia,
    })

    // Let an anonymous author keep seeing their own private uploads in the editor.
    if (!isEditor) {
      response.cookies.set(
        uploadGrantCookie,
        createUploadGrantValue(
          request.headers,
          uploadedMedia.map((media) => Number(media.id)),
        ),
        { ...signedCookieOptions, maxAge: uploadGrantMaxAge },
      )
    }

    return response
  } catch (error) {
    console.error('Jodit media upload failed:', error)

    return NextResponse.json(
      {
        success: false,
        error: 1,
        message: 'Image upload failed.',
        files: [],
      },
      { status: 500 },
    )
  }
}
