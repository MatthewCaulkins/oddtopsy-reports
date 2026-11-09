import {
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  DeleteUserAttributesCommand,
  GetUserAttributeVerificationCodeCommand,
  GetUserCommand,
  SetUserMFAPreferenceCommand,
  UpdateUserAttributesCommand,
  VerifyUserAttributeCommand,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider'
import { CognitoJwtVerifier } from 'aws-jwt-verify'

import type { CognitoConfig } from '@/lib/auth/config'

/*
 * A signed-in user's own MFA settings in Cognito.
 *
 * Changes use Cognito's self-service API, authorized by the user's own
 * access token (no IAM permissions). The app only gets that token from
 * a fresh sign-in on the MFA Agreement page, a "step-up" that asks
 * Cognito for the aws.cognito.signin.user.admin scope and prompt=login
 * (see src/app/auth/login/route.ts). Normal sign-in never requests the
 * scope, and the token is kept only briefly, in an httpOnly cookie
 * scoped to /editorial/account.
 *
 * Reading the current state when no step-up token is at hand uses
 * AdminGetUser with the task role, which the app already has.
 */

export const selfServiceScope = 'aws.cognito.signin.user.admin'

// The step-up access token, and the enrollment waiting for its code.
export const mfaAccessCookie = 'oddtopsy-cognito-mfa'
export const smsEnrollmentCookie = 'oddtopsy-sms-enrollment'
export const mfaCookiePath = '/editorial/account'

// MFA changes need a sign-in this recent. The token cookie lives as long.
export const recentAuthSeconds = 10 * 60

export type CognitoMfaState = {
  smsEnabled: boolean
  emailEnabled: boolean
  preferred: string | null
  phoneNumber: string | null
  phoneVerified: boolean
}

export type StepUp = {
  sub: string
  authTime: number
  // When this token stops counting as a recent sign-in (ms since epoch).
  expiresAt: number
}

let client: CognitoIdentityProviderClient | null = null

function getClient(config: CognitoConfig) {
  client ??= new CognitoIdentityProviderClient({ region: config.region })

  return client
}

let accessVerifier: ReturnType<
  typeof CognitoJwtVerifier.create<{ userPoolId: string; tokenUse: 'access'; clientId: string; scope: string }>
> | null = null

export function getAccessTokenVerifier(config: CognitoConfig) {
  accessVerifier ??= CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'access',
    clientId: config.clientId,
    scope: selfServiceScope,
  })

  return accessVerifier
}

/*
 * A step-up access token: valid for our app client, carrying the
 * self-service scope, and from a sign-in in the last ten minutes.
 * Anything else is null.
 */
export async function verifyStepUpToken(config: CognitoConfig, token: string | null | undefined): Promise<StepUp | null> {
  if (!token) return null

  try {
    const claims = await getAccessTokenVerifier(config).verify(token)
    const authTime = typeof claims.auth_time === 'number' ? claims.auth_time : 0
    const expiresAt = Math.min((authTime + recentAuthSeconds) * 1000, claims.exp * 1000)

    if (expiresAt <= Date.now()) return null

    return { sub: claims.sub, authTime, expiresAt }
  } catch {
    return null
  }
}

function stateFrom(
  attributes: AttributeType[] | undefined,
  settings: string[] | undefined,
  preferred: string | undefined,
): CognitoMfaState {
  const attribute = (name: string) => attributes?.find((item) => item.Name === name)?.Value

  return {
    smsEnabled: Boolean(settings?.includes('SMS_MFA')),
    emailEnabled: Boolean(settings?.includes('EMAIL_OTP')),
    preferred: preferred || null,
    phoneNumber: attribute('phone_number') || null,
    phoneVerified: attribute('phone_number_verified') === 'true',
  }
}

export async function getOwnMfaState(config: CognitoConfig, accessToken: string) {
  const result = await getClient(config).send(new GetUserCommand({ AccessToken: accessToken }))

  return stateFrom(result.UserAttributes, result.UserMFASettingList, result.PreferredMfaSetting)
}

// Read-only, with the task role: what Cognito will actually do at the next sign-in.
export async function getMfaStateBySub(config: CognitoConfig, sub: string) {
  const result = await getClient(config).send(new AdminGetUserCommand({ UserPoolId: config.userPoolId, Username: sub }))

  return stateFrom(result.UserAttributes, result.UserMFASettingList, result.PreferredMfaSetting)
}

/*
 * Sets the number and has Cognito text a verification code to it.
 * The number starts out unverified. This pool does not auto-verify
 * phone numbers, so the code is requested explicitly unless Cognito
 * already sent one. Returns Cognito's masked destination.
 */
export async function sendPhoneVerification(config: CognitoConfig, accessToken: string, phoneNumber: string) {
  const update = await getClient(config).send(
    new UpdateUserAttributesCommand({
      AccessToken: accessToken,
      UserAttributes: [{ Name: 'phone_number', Value: phoneNumber }],
    }),
  )

  const delivery = update.CodeDeliveryDetailsList?.find((item) => item.AttributeName === 'phone_number')

  if (delivery) return delivery.Destination || null

  return resendPhoneVerification(config, accessToken)
}

export async function resendPhoneVerification(config: CognitoConfig, accessToken: string) {
  const result = await getClient(config).send(
    new GetUserAttributeVerificationCodeCommand({ AccessToken: accessToken, AttributeName: 'phone_number' }),
  )

  return result.CodeDeliveryDetails?.Destination || null
}

export async function confirmPhoneVerification(config: CognitoConfig, accessToken: string, code: string) {
  await getClient(config).send(
    new VerifyUserAttributeCommand({ AccessToken: accessToken, AttributeName: 'phone_number', Code: code }),
  )
}

/*
 * SMS becomes the preferred method; email stays enabled alongside it.
 * Only called once the number has been verified.
 */
export async function preferSmsMfa(config: CognitoConfig, accessToken: string) {
  await getClient(config).send(
    new SetUserMFAPreferenceCommand({
      AccessToken: accessToken,
      SMSMfaSettings: { Enabled: true, PreferredMfa: true },
      EmailMfaSettings: { Enabled: true, PreferredMfa: false },
    }),
  )
}

/*
 * Back to email codes, in one call: SMS off, email on and preferred,
 * so there is no moment without a working method.
 */
export async function preferEmailMfa(config: CognitoConfig, accessToken: string) {
  await getClient(config).send(
    new SetUserMFAPreferenceCommand({
      AccessToken: accessToken,
      SMSMfaSettings: { Enabled: false, PreferredMfa: false },
      EmailMfaSettings: { Enabled: true, PreferredMfa: true },
    }),
  )
}

/*
 * Removes only the phone number (and with it phone_number_verified),
 * so it no longer works for account recovery either. Nothing else is
 * touched.
 */
export async function removePhoneNumber(config: CognitoConfig, accessToken: string) {
  await getClient(config).send(
    new DeleteUserAttributesCommand({ AccessToken: accessToken, UserAttributeNames: ['phone_number'] }),
  )
}

const cognitoMessages: Record<string, string> = {
  CodeMismatchException: 'That code is not correct. Check the latest text message and try again.',
  ExpiredCodeException: 'That code has expired. Send a new code and try again.',
  LimitExceededException: 'Too many attempts. Wait a few minutes and try again.',
  TooManyRequestsException: 'Too many attempts. Wait a few minutes and try again.',
  TooManyFailedAttemptsException: 'Too many incorrect codes. Wait a few minutes, then send a new code.',
  CodeDeliveryFailureException:
    'Cognito could not deliver a text message to that number. While SMS is in sandbox mode, only pre-approved numbers receive messages.',
  InvalidSmsRoleAccessPolicyException: 'Text messaging is not set up correctly for sign-in yet. Ask an administrator.',
  InvalidSmsRoleTrustRelationshipException: 'Text messaging is not set up correctly for sign-in yet. Ask an administrator.',
  AliasExistsException: 'That number is already in use by another account.',
  InvalidParameterException: 'Cognito did not accept this change. Check the number and try again.',
  NotAuthorizedException: 'Your confirmation sign-in is no longer valid. Sign in again to continue.',
  UserNotFoundException: 'Your sign-in account could not be found. Ask an administrator.',
}

export function isReauthError(error: unknown) {
  return error instanceof Error && error.name === 'NotAuthorizedException'
}

// Safe to show: a fixed message chosen by the error's name, never Cognito's own text.
export function describeCognitoError(error: unknown) {
  const name = error instanceof Error ? error.name : ''

  return cognitoMessages[name] || 'Cognito could not complete this change. Try again in a few minutes.'
}
