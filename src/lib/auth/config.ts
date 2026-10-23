/*
 * Which sign-in methods this deployment offers, chosen by environment
 * rather than NODE_ENV:
 *
 *   AUTH_PROVIDERS=password           local development (the default)
 *   AUTH_PROVIDERS=password,cognito   production, during the transition
 *   AUTH_PROVIDERS=cognito            production, Cognito only
 *
 * Either way Payload owns user records, roles and account status;
 * a provider only proves who someone is.
 *
 * Misconfiguration fails at startup instead of locking everyone out.
 */

export type AuthProvider = 'password' | 'cognito'

export type CognitoConfig = {
  region: string
  userPoolId: string
  clientId: string
  clientSecret: string
  // Hosted (managed login) domain, e.g. https://example.auth.us-east-1.amazoncognito.com
  domain: string
  // Must exactly match the app client's allowed callback and sign-out URLs.
  redirectURI: string
  logoutURI: string
}

export type AuthConfig = {
  providers: AuthProvider[]
  password: boolean
  cognito: CognitoConfig | null
}

const knownProviders: AuthProvider[] = ['password', 'cognito']

function required(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`AUTH_PROVIDERS includes cognito, but ${name} is not set.`)
  }

  return value
}

function normalizeDomain(value: string) {
  const withScheme = /^https?:\/\//.test(value) ? value : `https://${value}`

  return withScheme.replace(/\/+$/, '')
}

function readAuthConfig(): AuthConfig {
  const providers = (process.env.AUTH_PROVIDERS || 'password')
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean)

  for (const provider of providers) {
    if (!knownProviders.includes(provider as AuthProvider)) {
      throw new Error(`Unknown AUTH_PROVIDERS entry '${provider}'. Use password and/or cognito.`)
    }
  }

  if (providers.length === 0) {
    throw new Error('AUTH_PROVIDERS must include at least one sign-in method.')
  }

  const unique = [...new Set(providers)] as AuthProvider[]

  let cognito: CognitoConfig | null = null

  if (unique.includes('cognito')) {
    const siteURL = required('SITE_URL').replace(/\/+$/, '')

    cognito = {
      region: process.env.COGNITO_REGION?.trim() || process.env.AWS_REGION?.trim() || 'us-east-1',
      userPoolId: required('COGNITO_USER_POOL_ID'),
      clientId: required('COGNITO_CLIENT_ID'),
      clientSecret: required('COGNITO_CLIENT_SECRET'),
      domain: normalizeDomain(required('COGNITO_DOMAIN')),
      redirectURI: `${siteURL}/auth/callback`,
      logoutURI: `${siteURL}/`,
    }
  }

  return {
    providers: unique,
    password: unique.includes('password'),
    cognito,
  }
}

let cached: AuthConfig | null = null

export function getAuthConfig(): AuthConfig {
  cached ??= readAuthConfig()

  return cached
}
