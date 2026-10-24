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
| Sign-in | Cognito user pool `us-east-1_kAPBrKuJ7`, managed login at `https://auth.oddtopsies.org` (required email MFA, Essentials plan) |
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

## Known infrastructure follow-up

`oddtopsies.org` (the apex) is served by A records that point at the load balancer's current IP addresses, because Squarespace DNS cannot alias the apex to a load balancer name. Load-balancer IPs change without notice, which would take the apex offline (`www` is a CNAME and is unaffected). See the options in the release notes; the durable fixes are Route 53 DNS (alias records) or static IPs via AWS Global Accelerator.
