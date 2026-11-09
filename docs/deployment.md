# Production deployment runbook

Production runs in AWS `us-east-1`:

| Piece | Name |
|---|---|
| ECS cluster / service | `oddtopsy-reports` / `oddtopsy-reports-service-n4x1jp3v` (Fargate, rolling, circuit-breaker rollback, 60 s health-check grace) |
| Task definition family | `oddtopsy-reports` (image pinned by digest) |
| Container registry | ECR `oddtopsy-reports` (immutable tags) |
| Database | RDS PostgreSQL `oddtopsy-reports` (private; deletion protection) |
| Media | S3 `oddtopsy-reports-media` |
| Email | SES domain identity `oddtopsies.org`, from `editorial@oddtopsies.org` |
| Sign-in | Cognito user pool `us-east-1_kAPBrKuJ7`, managed login at `https://auth.oddtopsies.org` (required MFA: email, or SMS for editors who opt in; Essentials plan) |
| DNS | Route 53 hosted zone `oddtopsies.org` (`Z01082401CFKXG0W0E1CJ`); Squarespace is the registrar only |
| Logs | CloudWatch `/ecs/oddtopsy-reports` (30-day retention) |
| Secrets | Secrets Manager `oddtopsy-reports/app` (PAYLOAD_SECRET, COGNITO_CLIENT_SECRET, ...) and the RDS-managed secret |

IAM policy documents are kept out of Git (`deploy/aws/iam/`, gitignored).

## Production environment

Set in the task definition (secrets come from Secrets Manager):

```
NODE_ENV=production
SITE_URL=https://oddtopsies.org
AUTH_PROVIDERS=cognito
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_kAPBrKuJ7
COGNITO_CLIENT_ID=4ggd90nvvebiooe16q9v33fdbt
COGNITO_DOMAIN=https://auth.oddtopsies.org
COGNITO_CLIENT_SECRET=<secret>
EMAIL_FROM_ADDRESS=editorial@oddtopsies.org
SES_REGION=us-east-1
S3_ENABLED=true
S3_BUCKET=oddtopsy-reports-media
DATABASE_SSL=true
DB_HOST / DB_PORT / DB_NAME, DB_USER / DB_PASSWORD (secret)
PAYLOAD_SECRET (secret)
```

`SUBSCRIPTIONS_ENABLED` is not set, so subscriptions are off: Subscribe is hidden and `/subscribe` returns 404 (see `src/lib/features.ts`). Setting it to `true` in a new task definition revision turns them on without a rebuild.

The Cognito app client allows only the callback `https://oddtopsies.org/auth/callback` and sign-out URL `https://oddtopsies.org/`.

## Release steps

Use the `oddtopsy` AWS profile. In Git Bash set `MSYS_NO_PATHCONV=1` (for `/ecs/...` names) and `PYTHONUTF8=1` (for log output).

1. **Test locally**: `pnpm test:int`, `pnpm test:smoke`, `npx tsc --noEmit`.
2. **Commit**. The build refuses uncommitted changes.
3. **Snapshot the database** before any significant deployment (automatic backups are kept for 1 day only):
   `aws rds create-db-snapshot --db-instance-identifier oddtopsy-reports --db-snapshot-identifier oddtopsy-reports-pre-<name>-<date>`, then `aws rds wait db-snapshot-available ...`.
4. **Build and push** a versioned image: `bash deploy/aws/build-push.sh --tag <yyyymmdd>-<name>-<sha>`. Note the digest it prints.
5. **Register a task definition** copied from the current revision with only the intended changes (image digest, environment). Diff it against the current revision before registering.
6. **Migrate** with a one-off task on the new revision, using the service's network configuration:
   `node_modules/.bin/payload migrate:status && node_modules/.bin/payload migrate && node_modules/.bin/payload migrate:status`.
   Check the exit code and the task's log stream.
7. **Deploy**: `aws ecs update-service --cluster oddtopsy-reports --service oddtopsy-reports-service-n4x1jp3v --task-definition oddtopsy-reports:<rev>` and wait until the deployment is `COMPLETED`.
8. **Verify**: public pages, `/sitemap.xml`, `/auth/login` redirects to `auth.oddtopsies.org`, password APIs return 403, CloudWatch shows no new errors. Optionally run `tsx src/scripts/sendTestEmail.ts` as a one-off task to confirm SES delivery.

Rollback: update the service to the previous revision. Database changes roll back with `payload migrate:down` or by restoring the snapshot to a new instance.

## DNS (Route 53)

**Route 53 is authoritative for `oddtopsies.org`** (hosted zone `Z01082401CFKXG0W0E1CJ`). The `.org` registry has delegated to it since 2026-10-25 17:01 UTC. Squarespace remains the registrar only; its DNS panel no longer has any effect. **Make all DNS changes in Route 53.**

Nameservers: `ns-1566.awsdns-03.co.uk`, `ns-302.awsdns-37.com`, `ns-1287.awsdns-32.org`, `ns-532.awsdns-02.net`.

The apex is an alias A record to the load balancer, so it follows the load balancer's IP changes automatically. Before the move, Squarespace's manual A records had to be updated by hand each time those IPs changed.

The zone's records are kept in [`deploy/aws/dns/oddtopsies.org-records.json`](../deploy/aws/dns/oddtopsies.org-records.json):

- the apex alias, `www` (CNAME to the load balancer) and `auth` (Cognito managed login, CNAME to CloudFront)
- SPF `v=spf1 -all` and a single DMARC record `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s`
- the 3 SES DKIM CNAMEs and the 3 ACM validation CNAMEs (needed for certificate renewal)
- Squarespace's `_domainconnect`

There are no MX records: the domain receives no mail.

To change a record, edit the JSON file and apply it with `aws route53 change-resource-record-sets --hosted-zone-id Z01082401CFKXG0W0E1CJ --change-batch file://deploy/aws/dns/oddtopsies.org-records.json`. Every change in it is an `UPSERT`, so reapplying is safe; deleting a record needs a separate `DELETE` change. Commit the file so it stays the record of what is live.

**Email authentication.** App email and Cognito email (`EmailSendingAccount: DEVELOPER`) both go through the SES identity `oddtopsies.org`, which signs with Easy DKIM (`d=oddtopsies.org`). There is no custom MAIL FROM domain, so the envelope sender is an `amazonses.com` address, and SPF is checked (and passes) against Amazon's domain, not ours. DMARC therefore passes through strict DKIM alignment alone. This makes `v=spf1 -all` on the apex correct: nothing sends with `oddtopsies.org` as its envelope domain. If a custom MAIL FROM (e.g. `mail.oddtopsies.org`) is added later, that subdomain needs its own MX record and `v=spf1 include:amazonses.com -all`; the apex record stays as it is.

**Migration history (2026-10-23 to 2026-10-25).**

1. The records were copied from Squarespace. Of its two conflicting DMARC records, the strict one was kept.
2. They were loaded into Route 53 and verified on all four nameservers before the switch.
3. The nameservers were then changed in Squarespace. After propagation, the site, `auth`, SES DKIM and both ACM certificates were checked.

Rollback, if ever needed: in Squarespace, set the nameservers back to `nsa1`–`nsa4.squarespacedns.com`. This works only while the old Squarespace records still exist, and they must be checked first: the apex A records there are manual IPs that will go stale.

## SMS MFA (Editorial > MFA Agreement)

Editors can choose text-message sign-in codes instead of email at `/editorial/account/security`. Email MFA stays the default and remains enabled as the backup method for anyone who turns SMS on.

**How it works.** Cognito managed login still runs every sign-in challenge (`EMAIL_OTP` or `SMS_MFA`); the app never handles codes at sign-in. To change MFA settings, the page asks for a fresh step-up sign-in: `/auth/login?reauth=1` requests the extra scope `aws.cognito.signin.user.admin` and `prompt=login` (managed login v2). The callback keeps that access token for 10 minutes only, in an httpOnly cookie scoped to `/editorial/account`. Normal sign-in never requests the scope. With that token the server:

1. sets `phone_number` (`UpdateUserAttributes`) and has Cognito text a code (`GetUserAttributeVerificationCode`; this pool does not auto-verify phone numbers);
2. checks the code (`VerifyUserAttribute`);
3. sets SMS as preferred with email still enabled (`SetUserMFAPreference`), then reads the result back (`GetUser`);
4. only then saves the agreement on the Payload user (`smsMfaEnabled`, `smsMfaPhoneNumber`, `smsMfaConsentedAt`, `smsMfaTermsAccepted`).

Turning SMS off is a single `SetUserMFAPreference` call (SMS off, email on and preferred), then `DeleteUserAttributes` for `phone_number` only (so it stops working for account recovery). The agreement fields are cleared after Cognito confirms. Both changes email the account holder. The page reads Cognito's state with `AdminGetUser` (task role, already allowed). If Cognito no longer uses SMS, the page clears the agreement. If Cognito uses SMS without a matching agreement, or with a different number, the page flags it.

These self-service calls are authorized by the user's token, not IAM, so neither the task role nor the deployment user needs new permissions.

### Deployment plan

Prerequisites, in the AWS console (none of these affects normal sign-in on its own):

1. **App client** `4ggd90nvvebiooe16q9v33fdbt` (User pool > App clients > Login pages, and Attribute permissions). Edit it in the console. The CLI's `update-user-pool-client` resets every setting you leave out.
   - Add the OAuth scope **`aws.cognito.signin.user.admin`** to the allowed scopes. Without it, the step-up sign-in returns `invalid_scope`, and the page shows "The confirmation sign-in did not complete". Normal sign-in is unaffected.
   - Give the app client read access to `phone_number` and `phone_number_verified`, and write access to `phone_number`.
2. **Pool MFA:** no change needed. As of 2026-11-08 the pool already has MFA `ON`, email MFA, and SMS MFA through End User Messaging (`EumsSms`, role `oddtopsies-sms-role`). Optionally brand the SMS texts: the authentication message is currently "Your authentication code is {####}." Set it and the phone verification message to something like "Oddtopsy Reports code: {####}". Toll-free registration usually requires the brand name in messages.
3. **End User Messaging SMS:** while the account is in the SMS sandbox, only verified destination numbers receive texts. Add each enrolling editor's number as a sandbox destination, or wait for toll-free registration and production access. If an unverified number is used, the code never arrives and enrollment simply cannot finish; nothing is turned on. Check the monthly SMS spend limit.
4. **Policy pages:** `/terms` and `/privacy` (updated 2026-11-08) describe the web opt-in at `/editorial/account/security`. The toll-free registration's opt-in description (and any screenshot) should match them.
5. **Ribbon link:** the MFA Agreement link in `EditorialNav.tsx` is commented out until SMS can be delivered (originator number approved). The page itself is deployed and reachable by URL. Un-comment the link to launch.

Release (the usual recipe; one migration, no new environment variables):

1. Manual RDS snapshot `oddtopsy-reports-pre-sms-mfa-<date>`.
2. Build from a clean worktree, register a task definition copied from the current revision with only the image digest changed, and diff it.
3. Run the one-off migration task: `20261108_210731_users_sms_mfa_agreement` adds four columns to `users`. Existing users get `false` for the two booleans and `NULL` for the phone number and consent time.
4. Update the service and wait for `COMPLETED`.

Production smoke test (by an admin, on their own account, with a sandbox-verified phone):

- **Without SMS:** sign out and in again. The email code still arrives, and (once the link is un-commented) the ribbon shows MFA Agreement after Trash.
- **Before step-up:** the page shows "Off: sign-in codes are sent by email" and asks you to sign in again. The sign-in requires a fresh code, then the form appears, with both boxes unchecked and the button disabled.
- **Enroll:** you receive a text code, and the status turns on only after it is entered. A security email arrives.
- **Sign in by SMS:** sign out and in. Cognito asks for an SMS code. Check whether managed login offers email as an alternative.
- **Disable:** the status shows email, the security email arrives, and the next sign-in asks for an email code. In the Cognito console the user has no `phone_number`.
- **Logs:** CloudWatch shows `sms_mfa.*` events with user IDs only, never numbers or codes.

### Recovery and rollback

- **An editor cannot receive SMS codes** (lost phone, replied STOP, carrier problem): an operator switches them back to email. The deployment user would need `cognito-idp:AdminSetUserMFAPreference` and `cognito-idp:AdminDeleteUserAttributes` on the pool, or the operator uses the console.
  `aws cognito-idp admin-set-user-mfa-preference --user-pool-id us-east-1_kAPBrKuJ7 --username <sub> --sms-mfa-settings Enabled=false,PreferredMfa=false --email-mfa-settings Enabled=true,PreferredMfa=true`
  The next time they open MFA Agreement, the page clears their agreement to match.
- **App rollback:** update the service to the previous revision. The new columns are harmless to the old image, so leave them. Editors who turned SMS on keep SMS in Cognito, which the old image cannot change; switch them back as above if needed.
- **Schema rollback:** `payload migrate:down` drops the four columns and their agreements, or restore the snapshot.
- **App client:** removing the scope again disables only the step-up sign-in.
