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
