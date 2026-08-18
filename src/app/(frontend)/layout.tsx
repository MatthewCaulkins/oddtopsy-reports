import React from 'react'
import './styles.css'
import '@/styles/editor.css'

import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions } from '@payloadcms/next/layouts'

import config from '@/payload.config'
import { importMap } from '@/app/(payload)/admin/importMap'

import { PayloadFrontendProviders } from './components/PayloadFrontendProviders'

const serverFunction: ServerFunctionClient = async (args) => {
  'use server'

  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

export const metadata = {
  description: 'A low-barrier publication home for unusual anatomical findings and case reports.',
  title: 'Oddtopsy Reports',
  icons: {
    icon: '/branding/icon.svg',
  },
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PayloadFrontendProviders serverFunction={serverFunction}>
          {children}
        </PayloadFrontendProviders>
      </body>
    </html>
  )
}
