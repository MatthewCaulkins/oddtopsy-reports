import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Submissions can carry a manuscript PDF plus a dozen or more figures.
      bodySizeLimit: '100mb',
    },
  },

  output: 'standalone',

  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },

  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig, {
  devBundleServerPackages: false,
})
