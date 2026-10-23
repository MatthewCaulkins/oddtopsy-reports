import {
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider'

import type { CognitoConfig } from '@/lib/auth/config'

/*
 * Server-side Cognito user management, using the ECS task role
 * (see deploy/aws/iam/oddtopsy-ecs-task-role-cognito-policy.json).
 * Cognito accounts are never deleted from the app.
 *
 * The pool signs in with email, so a user is created with their email
 * as the username and afterwards addressed by their immutable sub.
 */

let client: CognitoIdentityProviderClient | null = null

function getClient(config: CognitoConfig) {
  client ??= new CognitoIdentityProviderClient({ region: config.region })

  return client
}

/*
 * Creates the Cognito user and has Cognito email the invitation.
 * Returns the new user's sub, which is the only link we trust.
 */
export async function createInvitedCognitoUser(config: CognitoConfig, email: string) {
  try {
    const result = await getClient(config).send(
      new AdminCreateUserCommand({
        UserPoolId: config.userPoolId,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          // The invitation itself goes to this address; signing in proves it.
          { Name: 'email_verified', Value: 'true' },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      }),
    )

    const sub = result.User?.Attributes?.find((attribute) => attribute.Name === 'sub')?.Value

    if (!sub) {
      throw new Error('Cognito created the user but did not return its sub.')
    }

    return sub
  } catch (error) {
    if (error instanceof Error && error.name === 'UsernameExistsException') {
      // Never link an existing Cognito account by email.
      throw new Error(
        'A Cognito account already exists for this email but is not linked to this user. Resolve it in the Cognito console (for example, delete the stray account), then retry.',
      )
    }

    throw error
  }
}

export async function resendCognitoInvite(config: CognitoConfig, email: string) {
  await getClient(config).send(
    new AdminCreateUserCommand({
      UserPoolId: config.userPoolId,
      Username: email,
      MessageAction: 'RESEND',
      DesiredDeliveryMediums: ['EMAIL'],
    }),
  )
}

export async function disableCognitoUser(config: CognitoConfig, sub: string) {
  await getClient(config).send(new AdminDisableUserCommand({ UserPoolId: config.userPoolId, Username: sub }))
  await getClient(config).send(
    new AdminUserGlobalSignOutCommand({ UserPoolId: config.userPoolId, Username: sub }),
  )
}

export async function enableCognitoUser(config: CognitoConfig, sub: string) {
  await getClient(config).send(new AdminEnableUserCommand({ UserPoolId: config.userPoolId, Username: sub }))
}
