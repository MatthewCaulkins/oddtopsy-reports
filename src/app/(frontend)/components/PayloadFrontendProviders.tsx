'use client'

import type { ServerFunctionClient } from 'payload'
import { ServerFunctionsProvider } from '@payloadcms/ui'

type Props = {
  children: React.ReactNode
  serverFunction: ServerFunctionClient
}

export function PayloadFrontendProviders({ children, serverFunction }: Props) {
  return (
    <ServerFunctionsProvider serverFunction={serverFunction}>{children}</ServerFunctionsProvider>
  )
}
