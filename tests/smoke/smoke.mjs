/*
 * End-to-end smoke test for the local Docker stack (http://localhost:3000,
 * AUTH_PROVIDERS=password): access requests, roles and user management,
 * navigation, submissions, notifications, revisions, publication, article
 * URLs and media visibility.
 *
 *   pnpm test:smoke                 (needs the stack from docker compose)
 *   pnpm test:smoke --cleanup-only
 *
 * Only creates and removes smoke-*@example.com users and "SMOKE TEST"
 * papers. Request Access allows 10 per hour per IP, so restart the app
 * container between back-to-back runs.
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { chromium } from '@playwright/test'
import sharp from 'sharp'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.resolve(HERE, '../..')
const FIX = path.join(HERE, '.fixtures')
const OUTPUT = path.join(HERE, '.output')
const BASE = 'http://localhost:3000'
const PASSWORD = 'SmokeTest-Pass-123'
const MANAGER = 'smoke-manager@example.com'
const SMOKE_ADMIN = 'smoke-admin@example.com'
const EDITOR = 'smoke-editor@example.com'
const INVITEE = 'smoke-invitee@example.com'
const NEW_MANAGER = 'smoke-newmanager@example.com'
const REJECTED = 'smoke-rejected@example.com'
const AUTHOR = 'smoke-author@example.com'
const TITLE = 'SMOKE TEST'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

function sql(query) {
  return execSync(
    `docker compose exec -T postgres psql -U oddtopsy -d oddtopsy_reports -At -F "|" -c "${query.replace(/"/g, '\\"')}"`,
    { cwd: PROJECT, encoding: 'utf8' },
  ).trim()
}

function logsSince(since) {
  return execSync(`docker compose logs --no-color --since ${since} payload`, {
    cwd: PROJECT,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  })
}

const now = () => new Date().toISOString()
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(predicate, timeoutMs = 15_000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (predicate()) return true
    await pause(500)
  }
  return predicate()
}

// Remove anything a previous run created. Only touches SMOKE / smoke-* records.
function cleanup() {
  const papers = `(select id from submissions where title like '${TITLE}%')`
  sql(`delete from editor_notes where submission_id in ${papers}`)
  sql(`delete from _submissions_v where parent_id in ${papers}`)
  sql(`delete from submissions where id in ${papers}`)
  sql(`delete from media where alt like '${TITLE}%'`)
  sql(`delete from access_requests where email like 'smoke-%@example.com'`)
  sql(`delete from users where email like 'smoke-%@example.com'`)
  execSync(`rm -f media/smoke-*`, { cwd: PROJECT, shell: 'bash' })
}

// The test manager is created through Payload (there is no other approver to bootstrap from).
function seedManager() {
  const file = `${PROJECT}/.tmp-smoke-seed.ts`
  fs.writeFileSync(
    file,
    `import { getPayload } from 'payload'
import config from '@/payload.config'
const payload = await getPayload({ config })
await payload.create({ collection: 'users', data: { email: '${MANAGER}', password: '${PASSWORD}', role: 'manager', accountStatus: 'active', profile: { displayName: 'Smoke Manager' } } })
await payload.create({ collection: 'users', data: { email: '${SMOKE_ADMIN}', password: '${PASSWORD}', role: 'admin', accountStatus: 'active', profile: { displayName: 'Smoke Admin' } } })
process.exit(0)
`,
  )
  try {
    execSync(`docker compose exec -T payload sh -c "cd /home/node/app && npx tsx .tmp-smoke-seed.ts"`, {
      cwd: PROJECT,
      stdio: 'pipe',
    })
  } finally {
    fs.rmSync(file, { force: true })
  }
}

// Test images and a minimal PDF, generated so no binaries live in the repo.
async function makeFixtures() {
  fs.mkdirSync(FIX, { recursive: true })
  fs.mkdirSync(OUTPUT, { recursive: true })

  const png = (name, color) =>
    sharp({ create: { width: 1200, height: 800, channels: 3, background: color } }).png().toFile(path.join(FIX, name))

  await Promise.all([
    png('smoke-featured.png', '#285f73'),
    png('smoke-figure-1.png', '#9f3a38'),
    png('smoke-figure-2.png', '#696d6f'),
    png('smoke-revised-featured.png', '#1381a9'),
  ])

  fs.writeFileSync(
    path.join(FIX, 'smoke-manuscript.pdf'),
    [
      '%PDF-1.4',
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj',
      'trailer<</Root 1 0 R>>',
      '%%EOF',
      '',
    ].join('\n'),
  )
}

cleanup()
if (process.argv.includes('--cleanup-only')) process.exit(0)
seedManager()
await makeFixtures()

// The local admin who receives staff notifications (not a smoke account).
const ADMIN_EMAIL = sql(
  `select email from users where role = 'admin' and account_status = 'active' and email not like 'smoke-%' order by id limit 1`,
)

const browser = await chromium.launch()

// Dev mode compiles each page on first visit, which can take a while.
const newContext = browser.newContext.bind(browser)
browser.newContext = async (options) => {
  const context = await newContext(options)
  context.setDefaultTimeout(180_000)
  context.setDefaultNavigationTimeout(180_000)
  return context
}

async function login(email, password = PASSWORD) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${BASE}/login`)
  await page.fill('input[name=email]', email)
  await page.fill('input[name=password]', password)
  await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForURL(`${BASE}/`)
  return { context, page }
}

async function loginFails(email, password = PASSWORD) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${BASE}/login`)
  await page.fill('input[name=email]', email)
  await page.fill('input[name=password]', password)
  await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForSelector('.form-error')
  const stayed = page.url().includes('/login')
  await context.close()
  return stayed
}

async function requestAccess({ name, email, affiliation = 'Smoke University', honeypot = false, fast = false }) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${BASE}/request-access`)
  if (!fast) await pause(3500)
  await page.fill('input[name=name]', name)
  await page.fill('input[name=email]', email)
  await page.fill('input[name=affiliation]', affiliation)
  if (honeypot) await page.locator('input[name=website]').evaluate((input) => (input.value = 'http://spam.example'))
  await page.locator('form button[type=submit]').click()
  await page.waitForSelector('text=Request received')
  await context.close()
}

async function status(context, method, url, data) {
  return context.request.fetch(`${BASE}${url}`, { method, data, failOnStatusCode: false, maxRedirects: 0 })
}

async function approve(managerPage, email, role) {
  await managerPage.goto(`${BASE}/editorial/users`)
  const row = managerPage.locator('article.editorial-user-row', { hasText: email }).filter({
    has: managerPage.getByRole('button', { name: 'Approve' }),
  })
  await row.locator('select[name=role]').selectOption(role)
  await row.getByRole('button', { name: 'Approve' }).click()
  await managerPage.waitForLoadState('networkidle')
}

function inviteToken(logs, email) {
  const at = logs.lastIndexOf(`To: ${email}`)
  if (at < 0) return null
  return logs.slice(at).match(/reset-password\?token=([^&\s]+)&invite=1/)?.[1] || null
}

const requestRow = (email) =>
  sql(
    `select status || '|' || source || '|' || coalesce(granted_role::text, '') || '|' || coalesce(reviewer_id::text, '') || '|' || coalesce(user_id::text, '') || '|' || coalesce(provisioning_status::text, '') || '|' || provisioning_attempts || '|' || (provisioning_invite_sent_at is not null) || '|' || coalesce(rejection_note, '') from access_requests where email = '${email}' order by id desc limit 1`,
  )

const shot = async (page, name) => page.screenshot({ path: path.join(OUTPUT, `fail-${name}.png`), fullPage: true })

try {
  const adminID = sql(`select id from users where role = 'admin' limit 1`)
  const managerID = sql(`select id from users where email = '${MANAGER}'`)
  check('Test manager seeded', Boolean(managerID))

  // ------------------------------------------------------ request access
  {
    const anon = await browser.newContext()
    const page = await anon.newPage()
    await page.goto(`${BASE}/`)
    check('Header shows Request Access when logged out', (await page.locator('a.nav-request-access').count()) === 1)
    const r = await status(anon, 'GET', '/signup')
    check('/signup redirects to /request-access', [307, 308].includes(r.status()) && r.headers()['location']?.endsWith('/request-access'), `HTTP ${r.status()} -> ${r.headers()['location']}`)
    await anon.close()
  }

  let since = now()
  await requestAccess({ name: 'Smoke Editor', email: EDITOR })
  check(
    'Request Access records a pending request',
    await waitFor(() => requestRow(EDITOR).startsWith('pending|form|')),
    requestRow(EDITOR),
  )
  await waitFor(() => logsSince(since).includes('Subject: Access request: Smoke Editor'))
  let logs = logsSince(since)
  check('Admin is emailed about the request', logs.includes(`To: ${ADMIN_EMAIL}, Subject: Access request: Smoke Editor`))
  check(
    'Active managers are emailed about the request (one message each)',
    logs.includes('To: smoke-manager@example.com, Subject: Access request: Smoke Editor'),
  )

  // Abuse protection and non-disclosure: all of these show the same "Request received".
  await requestAccess({ name: 'Bot', email: 'smoke-bot@example.com', honeypot: true })
  await requestAccess({ name: 'Fast Bot', email: 'smoke-fast@example.com', fast: true })
  await requestAccess({ name: 'Smoke Editor Again', email: EDITOR.toUpperCase() })
  await requestAccess({ name: 'Existing', email: MANAGER })
  await pause(5000)
  check('Honeypot submission is silently dropped', sql(`select count(*) from access_requests where email = 'smoke-bot@example.com'`) === '0')
  check('Too-fast submission is silently dropped', sql(`select count(*) from access_requests where email = 'smoke-fast@example.com'`) === '0')
  check('Duplicate open request is not created', sql(`select count(*) from access_requests where email = '${EDITOR}'`) === '1')
  check('Existing user email creates no request', sql(`select count(*) from access_requests where email = '${MANAGER}'`) === '0')

  // ----------------------------------------------------------- API rules
  const anonAPI = await browser.newContext()
  const manager = await login(MANAGER)
  let r = await status(anonAPI, 'GET', '/api/access-requests')
  check('Anonymous cannot read access requests', r.status() === 403, `HTTP ${r.status()}`)
  r = await status(anonAPI, 'POST', '/api/access-requests', { name: 'x', email: 'smoke-x@example.com' })
  check('Anonymous cannot create access requests via API', r.status() === 403, `HTTP ${r.status()}`)
  r = await status(manager.context, 'GET', '/api/access-requests')
  check('Manager can read access requests', r.status() === 200, `HTTP ${r.status()}`)
  const requestID = sql(`select id from access_requests where email = '${EDITOR}'`)
  r = await status(manager.context, 'PATCH', `/api/access-requests/${requestID}`, { status: 'approved', grantedRole: 'manager' })
  check('Nobody can edit the audit trail via API', r.status() === 403 && requestRow(EDITOR).startsWith('pending|'), `HTTP ${r.status()}`)

  // --------------------------------------------------- approve + invite
  since = now()
  await approve(manager.page, EDITOR, 'editor')
  const editorID = sql(`select id from users where email = '${EDITOR}'`)
  check(
    'Approval creates an invited User',
    sql(`select role || '|' || account_status from users where email = '${EDITOR}'`) === 'editor|invited',
  )
  check(
    'Approval records reviewer, role, user and invite',
    requestRow(EDITOR) === `approved|form|editor|${managerID}|${editorID}|complete|1|true|`,
    requestRow(EDITOR),
  )
  logs = logsSince(since)
  const token = inviteToken(logs, EDITOR)
  check('Invite email with a set-up link is sent', Boolean(token))

  r = await status(manager.context, 'GET', '/editorial')
  {
    const invitedCanLogIn = !(await loginFails(EDITOR, 'not-the-password'))
    check('Invited user cannot sign in before setting a password', !invitedCanLogIn)
  }

  {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${BASE}/reset-password?token=${encodeURIComponent(token)}&invite=1`)
    check('Invite link shows Set Up Your Account', (await page.locator('h1').textContent())?.includes('Set Up Your Account'))
    await page.fill('#password', PASSWORD)
    await page.fill('#confirmPassword', PASSWORD)
    await page.getByRole('button', { name: 'Reset Password' }).click()
    await page.waitForSelector('text=Password updated')
    await context.close()
  }
  check('Setting the password activates the account', sql(`select account_status from users where id = ${editorID}`) === 'active')

  // Second approval as Manager: managers may grant Manager, but then cannot manage that account.
  await requestAccess({ name: 'Smoke New Manager', email: NEW_MANAGER })
  await waitFor(() => requestRow(NEW_MANAGER).startsWith('pending|'))
  await approve(manager.page, NEW_MANAGER, 'manager')
  check('Manager can grant Manager on approval', sql(`select role || '|' || account_status from users where email = '${NEW_MANAGER}'`) === 'manager|invited')
  await manager.page.goto(`${BASE}/editorial/users`)
  const newManagerRow = manager.page.locator('article.editorial-user-row', { hasText: NEW_MANAGER }).filter({ hasText: 'Invited' })
  check('Manager cannot manage the manager they approved', (await newManagerRow.locator('button, select').count()) === 0)

  // Resend invite.
  await requestAccess({ name: 'Smoke Invitee', email: INVITEE })
  await waitFor(() => requestRow(INVITEE).startsWith('pending|'))
  await approve(manager.page, INVITEE, 'editor')
  since = now()
  await manager.page.goto(`${BASE}/editorial/users`)
  await manager.page
    .locator('article.editorial-user-row', { hasText: INVITEE })
    .filter({ has: manager.page.getByRole('button', { name: 'Resend Invite' }) })
    .getByRole('button', { name: 'Resend Invite' })
    .click()
  await manager.page.waitForLoadState('networkidle')
  check('Resend Invite sends a new invite and counts the attempt', requestRow(INVITEE).includes('|complete|2|true|') && Boolean(inviteToken(logsSince(since), INVITEE)), requestRow(INVITEE))

  // Reject.
  await requestAccess({ name: 'Smoke Rejected', email: REJECTED })
  await waitFor(() => requestRow(REJECTED).startsWith('pending|'))
  await manager.page.goto(`${BASE}/editorial/users`)
  const rejectRow = manager.page.locator('article.editorial-user-row', { hasText: REJECTED })
  await rejectRow.locator('summary', { hasText: 'Reject' }).click()
  await rejectRow.locator('textarea[name=rejectionNote]').fill('Not part of the editorial team.')
  since = now()
  await rejectRow.getByRole('button', { name: 'Reject Request' }).click()
  await manager.page.waitForLoadState('networkidle')
  // Sent after the response, so give it a moment to appear in the log.
  const rejectionLogged = await waitFor(() => logsSince(since).includes(`To: ${REJECTED}, Subject: Your Oddtopsy Reports access request`))
  check(
    'Rejected applicant is emailed, without the internal note',
    rejectionLogged && !logsSince(since).includes('Not part of the editorial team.'),
  )
  check(
    'Rejection records reviewer and note, creates no user',
    requestRow(REJECTED) === `rejected|form||${managerID}||not_started|0|false|Not part of the editorial team.` &&
      sql(`select count(*) from users where email = '${REJECTED}'`) === '0',
    requestRow(REJECTED),
  )
  await manager.page.goto(`${BASE}/editorial/users`)
  check('Recent Decisions lists the outcomes', (await manager.page.locator('text=Not part of the editorial team.').count()) === 1)

  // ---------------------------------------------- manager guard rails
  await manager.page.goto(`${BASE}/editorial/users`)
  const adminRow = manager.page.locator('article.editorial-user-row', { hasText: ADMIN_EMAIL })
  check('Manager has no controls for admin', (await adminRow.locator('button, select').count()) === 0)
  const selfRow = manager.page.locator('article.editorial-user-row', { hasText: MANAGER }).filter({ hasText: 'Active' })
  check('Manager has no controls for self', (await selfRow.locator('button, select').count()) === 0)
  r = await status(manager.context, 'PATCH', `/api/users/${managerID}`, { role: 'admin' })
  check('Manager cannot make self admin via API', sql(`select role from users where id = ${managerID}`) === 'manager', `HTTP ${r.status()}`)
  r = await status(manager.context, 'PATCH', `/api/users/${adminID}`, { profile: { displayName: 'hacked' } })
  check('Manager cannot edit admin via API', r.status() === 403, `HTTP ${r.status()}`)
  r = await status(manager.context, 'POST', `/api/users`, { email: 'smoke-x@example.com', password: PASSWORD, role: 'admin' })
  check('Manager cannot create users via API', r.status() === 403, `HTTP ${r.status()}`)
  await manager.page.goto(`${BASE}/admin`)
  await manager.page.waitForLoadState('networkidle')
  check('Manager is denied Payload admin', /unauthorized|login/.test(manager.page.url()), manager.page.url())

  // ------------------------------------- admin powers and auth routes (password-only mode)
  {
    const managerRoleOptions = await manager.page
      .locator('article.editorial-user-row', { hasText: EDITOR })
      .locator('select[name=role] option')
      .allTextContents()
    check('Managers are not offered Admin', !managerRoleOptions.includes('Admin'), managerRoleOptions.join(', '))

    const smokeAdmin = await login(SMOKE_ADMIN)
    const smokeAdminID = sql(`select id from users where email = '${SMOKE_ADMIN}'`)
    await smokeAdmin.page.goto(`${BASE}/editorial/users`)
    const adminSelfRow = smokeAdmin.page.locator('article.editorial-user-row', { hasText: SMOKE_ADMIN })
    check('Admin has no controls for their own account', (await adminSelfRow.locator('button, select').count()) === 0)

    const editorRow = smokeAdmin.page.locator('article.editorial-user-row', { hasText: EDITOR }).filter({
      has: smokeAdmin.page.getByRole('button', { name: 'Update Role' }),
    })
    await editorRow.locator('select[name=role]').selectOption('admin')
    await editorRow.getByRole('button', { name: 'Update Role' }).click()
    await smokeAdmin.page.waitForLoadState('networkidle')
    check('Admin can promote another user to admin', sql(`select role from users where email = '${EDITOR}'`) === 'admin')

    await smokeAdmin.page.goto(`${BASE}/editorial/users`)
    const promotedRow = smokeAdmin.page.locator('article.editorial-user-row', { hasText: EDITOR }).filter({
      has: smokeAdmin.page.getByRole('button', { name: 'Update Role' }),
    })
    await promotedRow.locator('select[name=role]').selectOption('editor')
    await promotedRow.getByRole('button', { name: 'Update Role' }).click()
    await smokeAdmin.page.waitForLoadState('networkidle')
    check('Admin can demote another admin (others remain)', sql(`select role from users where email = '${EDITOR}'`) === 'editor')

    r = await status(smokeAdmin.context, 'PATCH', `/api/users/${smokeAdminID}`, { role: 'editor' })
    check('Admin cannot change their own role via API', sql(`select role from users where id = ${smokeAdminID}`) === 'admin', `HTTP ${r.status()}`)

    // Navigation: the profile menu knows where you are; the ribbon returns to the site.
    await smokeAdmin.page.goto(`${BASE}/editorial`)
    await smokeAdmin.page.locator('.user-menu summary').click()
    check(
      'In Editorial, the menu shows Editorial as current and offers Frontend',
      (await smokeAdmin.page.locator('.user-menu-current').textContent()) === 'Editorial' &&
        (await smokeAdmin.page.locator('.user-menu-panel a[href="/"]').count()) === 1 &&
        (await smokeAdmin.page.locator('.user-menu-panel a[href="/admin"]').count()) === 1,
    )
    check(
      'The editorial ribbon has Return to Frontend',
      (await smokeAdmin.page.locator('.editorial-nav a.editorial-nav-return[href="/"]').count()) === 1,
    )
    await smokeAdmin.page.goto(`${BASE}/`)
    await smokeAdmin.page.locator('.user-menu summary').click()
    check(
      'On the site, the menu offers Editorial',
      (await smokeAdmin.page.locator('.user-menu-panel a[href="/editorial"]').count()) === 1 &&
        (await smokeAdmin.page.locator('.user-menu-current').count()) === 0,
    )

    // Sign-in returns to the protected page you asked for; otherwise home.
    {
      const returning = await browser.newContext()
      const page = await returning.newPage()
      await page.goto(`${BASE}/editorial/users`)
      check('A protected page sends you to sign in with a return path', page.url().endsWith('/login?next=%2Feditorial%2Fusers'), page.url())
      await page.fill('input[name=email]', SMOKE_ADMIN)
      await page.fill('input[name=password]', PASSWORD)
      await page.getByRole('button', { name: 'Login' }).click()
      await page.waitForURL(`${BASE}/editorial/users`)
      check('After signing in you land on that page', page.url() === `${BASE}/editorial/users`)
      await returning.close()
    }

    // Delete: admin-only, confirmed by typing the email, history kept, email reusable.
    await smokeAdmin.page.goto(`${BASE}/editorial/users`)
    const selfDeleteRow = smokeAdmin.page.locator('article.editorial-user-row', { hasText: SMOKE_ADMIN }).filter({ hasText: 'Active' })
    check('Admins cannot delete themselves', (await selfDeleteRow.getByRole('button', { name: 'Delete' }).count()) === 0)
    await manager.page.goto(`${BASE}/editorial/users`)
    check('Managers are not offered Delete', (await manager.page.getByRole('button', { name: 'Delete', exact: true }).count()) === 0)

    const inviteeRequestID = sql(`select id from access_requests where email = '${INVITEE}' order by id desc limit 1`)
    const inviteeRow = smokeAdmin.page
      .locator('article.editorial-user-row', { hasText: INVITEE })
      .filter({ has: smokeAdmin.page.locator('.editorial-user-actions button') })
    await inviteeRow.getByRole('button', { name: 'Delete', exact: true }).click()
    const confirmButton = inviteeRow.getByRole('button', { name: 'Delete permanently' })
    check('Delete needs the email typed to confirm', await confirmButton.isDisabled())
    await inviteeRow.locator('.editorial-user-delete input').fill(INVITEE)
    await confirmButton.click()
    // The page refresh may replace the "deleted" row before we see it; wait for the outcome instead.
    await waitFor(() => sql(`select count(*) from users where email = '${INVITEE}'`) === '0', 60_000)
    await smokeAdmin.page.waitForLoadState('networkidle')
    check(
      'The deleted account leaves the Users list',
      (await smokeAdmin.page.locator('article.editorial-user-row:not(.is-deleted)', { hasText: INVITEE }).filter({ hasText: 'Invited' }).count()) === 0,
    )
    check(
      'Admin deletes the account; its access-request history is kept',
      sql(`select count(*) from users where email = '${INVITEE}'`) === '0' &&
        sql(`select status || '|' || coalesce(user_id::text, 'none') from access_requests where id = ${inviteeRequestID}`) === 'approved|none',
    )
    r = await status(smokeAdmin.context, 'GET', `/api/users?where[email][equals]=${encodeURIComponent(INVITEE)}`)
    check('The deleted account is gone from the API', (await r.json()).totalDocs === 0)

    await requestAccess({ name: 'Smoke Invitee Again', email: INVITEE })
    check(
      'The deleted email can request access again',
      await waitFor(() => sql(`select count(*) from access_requests where email = '${INVITEE}' and status = 'pending'`) === '1'),
    )

    await smokeAdmin.context.close()

    const anonAuth = await browser.newContext()
    r = await status(anonAuth, 'GET', '/auth/login')
    check('Cognito sign-in route is off in password-only mode', r.status() === 303 && r.headers()['location'] === '/login', `HTTP ${r.status()} -> ${r.headers()['location']}`)
    r = await status(anonAuth, 'POST', '/auth/logout')
    check('Logout route returns home in password-only mode', r.status() === 200 && (await r.json()).redirect === '/')
    const loginPage = await anonAuth.newPage()
    await loginPage.goto(`${BASE}/login`)
    check(
      'Login page shows only the password form locally',
      (await loginPage.locator('a[href^="/auth/login"]').count()) === 0 &&
        (await loginPage.locator('details.legacy-login').count()) === 0 &&
        (await loginPage.locator('input[name=password]').count()) === 1,
    )
    await loginPage.goto(`${BASE}/admin/login`)
    await loginPage.waitForLoadState('networkidle')
    check(
      'Payload admin login shows no Cognito button locally',
      (await loginPage.locator('.cognito-admin-login').count()) === 0 && (await loginPage.locator('input[type=password]').count()) >= 1,
    )
    await anonAuth.close()
  }

  // ------------------------------------------------------- anonymous submit
  const anon = await browser.newContext()
  const anonPage = await anon.newPage()
  // Count showPicker() calls instead of opening the native calendar.
  await anonPage.addInitScript(() => {
    window.__pickerCalls = 0
    HTMLInputElement.prototype.showPicker = function () {
      window.__pickerCalls++
    }
  })
  await anonPage.goto(`${BASE}/submit`)

  // Date of finding: opens from anywhere in the field, by mouse or keyboard; typing still works.
  // Wait for React to attach its handlers before interacting.
  await anonPage.waitForFunction(() => Object.keys(document.querySelector('#findingDate') || {}).some((key) => key.startsWith('__reactProps')))
  // Click the left edge of the text, well away from the calendar icon.
  await anonPage.locator('#findingDate').scrollIntoViewIfNeeded()
  const dateBox = await anonPage.locator('#findingDate').boundingBox()
  await anonPage.locator('#findingDate').click({ position: { x: 12, y: dateBox.height / 2 } })
  const callsAfterClick = await anonPage.evaluate(() => window.__pickerCalls)
  check('Clicking anywhere in Date of finding opens the picker', callsAfterClick === 1, `showPicker calls: ${callsAfterClick}`)
  await anonPage.keyboard.press('Enter')
  check('Enter opens the date picker (and does not submit the form)', (await anonPage.evaluate(() => window.__pickerCalls)) === 2 && anonPage.url().endsWith('/submit'))
  await anonPage.locator('#title').focus()
  await anonPage.keyboard.press('Tab')
  await anonPage.locator('#findingDate').focus()
  check('Tabbing into the field does not pop the picker open', (await anonPage.evaluate(() => window.__pickerCalls)) === 2)
  await anonPage.keyboard.type('01152026')
  check('Typing a date by hand still works', (await anonPage.locator('#findingDate').inputValue()) === '2026-01-15')

  await anonPage.fill('input[name=title]', TITLE)
  await anonPage.locator('input[name=featuredImage]').setInputFiles(`${FIX}/smoke-featured.png`)
  await anonPage.fill('textarea[name=abstract]', 'Smoke test abstract.')
  await anonPage.locator('select[name=focusArea] option').first().evaluate((option) => (option.selected = true))
  await anonPage.fill('input[name=correspondingAuthorName]', 'Smoke Author')
  await anonPage.fill('input[name=correspondingAuthorEmail]', AUTHOR)
  await anonPage.fill('input[name=leadAuthorName]', 'Smoke Author')
  await anonPage.locator('select[name=submissionType]').selectOption('upload')
  await anonPage.locator('input[name=manuscriptPDF]').setInputFiles(`${FIX}/smoke-manuscript.pdf`)
  await anonPage.locator('input[name=supportingImages]').setInputFiles([`${FIX}/smoke-figure-1.png`, `${FIX}/smoke-figure-2.png`])

  // The production failure: an address browsers accept but Payload rejects.
  const mediaBefore = sql(`select count(*) from media`)
  await anonPage.fill('input[name=correspondingAuthorEmail]', 'smoke-author@example')
  await anonPage.getByRole('button', { name: 'Submit Paper' }).click()
  await anonPage.waitForSelector('.form-error-summary')
  check(
    'Incomplete author email is caught on the form, nothing uploaded or saved',
    (await anonPage.locator('.form-error-summary').textContent()).includes('complete address') &&
      sql(`select count(*) from media`) === mediaBefore &&
      sql(`select count(*) from submissions where title = '${TITLE}'`) === '0' &&
      anonPage.url().endsWith('/submit'),
  )
  check('The form keeps the chosen files after the error', (await anonPage.locator('input[name=featuredImage]').evaluate((input) => input.files.length)) === 1)

  await anonPage.fill('input[name=correspondingAuthorEmail]', AUTHOR)
  since = now()
  await anonPage.getByRole('button', { name: 'Submit Paper' }).click()
  await anonPage.waitForURL(/\/submit\/thank-you/)
  check(
    'Editorial staff are emailed about the new submission',
    await waitFor(() => /To: [^\n]*smoke-manager@example\.com, Subject: New submission: SMOKE TEST/.test(logsSince(since))),
  )
  check(
    'The author gets a submission receipt',
    await waitFor(() => logsSince(since).includes(`To: ${AUTHOR}, Subject: Submission received: SMOKE TEST`)),
  )
  const submissionID = sql(`select id from submissions where title = '${TITLE}' order by id desc limit 1`)
  check('Anonymous visitor can submit a paper (no account needed)', Boolean(submissionID), `submission ${submissionID}`)

  const featured = sql(`select filename from media where alt = '${TITLE} featured image' order by id desc limit 1`)
  const pdf = sql(`select filename from media where alt like '${TITLE}%' and mime_type = 'application/pdf' order by id desc limit 1`)
  if (!pdf) throw new Error('Manuscript PDF not found in media')

  r = await status(anon, 'GET', `/api/media/file/${encodeURIComponent(featured)}`)
  check('Anonymous cannot view unpublished image', r.status() === 403, `HTTP ${r.status()}`)
  r = await status(anon, 'GET', `/api/media/file/${encodeURIComponent(pdf)}`)
  check('Anonymous cannot view unpublished PDF', r.status() === 403, `HTTP ${r.status()}`)
  r = await status(anon, 'GET', `/api/submissions?limit=100`)
  check('Anonymous cannot list unpublished papers', !(await r.json()).docs.some((doc) => doc.title === TITLE))
  for (const url of ['/api/users', '/api/editor-notes']) {
    r = await status(anon, 'GET', url)
    check(`Anonymous cannot read ${url}`, r.status() === 403, `HTTP ${r.status()}`)
  }

  // ---------------------------------------------------------------- editor
  const editor = await login(EDITOR)
  r = await status(editor.context, 'GET', `/api/media/file/${encodeURIComponent(featured)}`)
  check('Newly approved editor can view unpublished image', r.status() === 200, `HTTP ${r.status()}`)
  r = await status(editor.context, 'GET', '/api/access-requests')
  check('Editor cannot read access requests', r.status() === 403, `HTTP ${r.status()}`)
  await editor.page.goto(`${BASE}/editorial/users`)
  check('Editor is kept out of user management', !editor.page.url().includes('/editorial/users'), editor.page.url())

  since = now()
  await editor.page.goto(`${BASE}/editorial/submissions/${submissionID}`)
  await editor.page.locator('.editorial-toolbar-panel summary').click()
  await editor.page.fill('textarea[name=message]', 'Please replace the featured image and clarify the title.')
  await editor.page.getByRole('button', { name: 'Send to Author' }).click()
  await editor.page.waitForURL(/revisions=sent/)
  logs = logsSince(since)
  const revisionToken = logs.match(/\/revise\/([A-Za-z0-9_-]{20,})/)?.[1]
  check('Editor requests revisions; author is emailed a link', Boolean(revisionToken))

  const author = await browser.newContext()
  const authorPage = await author.newPage()
  await authorPage.goto(`${BASE}/revise/${revisionToken}`)
  await authorPage.waitForURL(`${BASE}/revise`)
  since = now()
  await authorPage.fill('input[name=title]', `${TITLE} (revised)`)
  await authorPage.locator('input[name=featuredImage]').setInputFiles(`${FIX}/smoke-revised-featured.png`)
  await authorPage.getByRole('button', { name: 'Submit Revision' }).click()
  await authorPage.waitForURL(/submitted=1/)
  check('Author resubmits through the link', sql(`select workflow_status from submissions where id = ${submissionID}`) === 'under_review')
  check('Resubmission email reaches the new editor', /To: [^\n]*smoke-editor@example\.com[^\n]*Subject: Revised submission/.test(logsSince(since)))

  const newFeatured = sql(`select filename from media where alt = '${TITLE} (revised) featured image' order by id desc limit 1`)
  await editor.page.goto(`${BASE}/editorial/submissions/${submissionID}`)
  since = now()
  await editor.page.getByRole('button', { name: 'Approve & Publish' }).click()
  await editor.page.waitForURL(/\/articles\//)
  r = await status(anon, 'GET', `/api/media/file/${encodeURIComponent(newFeatured)}`)
  check('Published paper image is public', r.status() === 200, `HTTP ${r.status()}`)

  // Article URLs: a readable slug from the title, and old numeric links redirect to it.
  const slug = sql(`select slug from submissions where id = ${submissionID}`)
  check('Publishing gives the article a slug from its title', slug === 'smoke-test-revised', slug)
  check('Publishing lands on the slug URL', editor.page.url() === `${BASE}/articles/${slug}`, editor.page.url())
  r = await status(anon, 'GET', `/articles/${submissionID}`)
  check(
    'The old numeric URL redirects permanently to the slug',
    r.status() === 308 && r.headers()['location']?.endsWith(`/articles/${slug}`),
    `HTTP ${r.status()} -> ${r.headers()['location']}`,
  )
  r = await status(anon, 'GET', `/articles/${slug}`)
  const articleHTML = await r.text()
  check(
    'The article page has its canonical URL',
    r.status() === 200 && articleHTML.includes(`rel="canonical" href="http://localhost:3000/articles/${slug}"`),
  )
  r = await status(anon, 'GET', '/sitemap.xml')
  check('The sitemap lists the article by slug', (await r.text()).includes(`/articles/${slug}</loc>`))
  check(
    'The author is told their paper is published, with its link',
    await waitFor(() => logsSince(since).includes(`To: ${AUTHOR}, Subject: Published: SMOKE TEST (revised)`)),
  )
  logs = logsSince(since)
  check(
    'The rest of the team is told, but not the editor who published it',
    logs.includes('To: smoke-manager@example.com, Subject: Published: SMOKE TEST (revised)') &&
      !logs.includes('To: smoke-editor@example.com, Subject: Published:'),
  )
  await editor.page.goto(`${BASE}/editorial/submissions/${submissionID}`)
  check('The editor toolbar links to the slug URL', (await editor.page.locator(`a[href="/articles/${slug}"]`).count()) >= 1)

  await editor.page.goto(`${BASE}/editorial/submissions/${submissionID}`)
  await editor.page.locator('.editorial-toolbar-unpublish select').selectOption('in_progress')
  await editor.page.getByRole('button', { name: 'Unpublish' }).click()
  await editor.page.waitForLoadState('networkidle')
  r = await status(anon, 'GET', `/api/media/file/${encodeURIComponent(newFeatured)}`)
  check('Unpublished paper image is hidden again', r.status() === 403, `HTTP ${r.status()}`)
  r = await status(anon, 'GET', `/articles/${slug}`)
  const bySlug = r.status()
  r = await status(anon, 'GET', `/articles/${submissionID}`)
  check('An unpublished paper is not served by slug or number', bySlug === 404 && r.status() === 404, `slug ${bySlug}, id ${r.status()}`)
  check('The slug is kept for when it is published again', sql(`select slug from submissions where id = ${submissionID}`) === slug)

  // ------------------------------------------- disable / re-enable account
  await manager.page.goto(`${BASE}/editorial/users`)
  const editorAccountRow = manager.page
    .locator('article.editorial-user-row', { hasText: EDITOR })
    .filter({ has: manager.page.locator('.editorial-user-actions button') })
  await editorAccountRow.getByRole('button', { name: 'Disable' }).click()
  // No reload: the row's own state hides the role controls straight away.
  await editorAccountRow.getByRole('button', { name: 'Re-enable' }).waitFor()
  check(
    'Disabling hides the role controls immediately, without a reload',
    (await editorAccountRow.locator('select[name=role]').count()) === 0 &&
      (await editorAccountRow.getByRole('button', { name: 'Update Role' }).count()) === 0,
  )
  await waitFor(() => sql(`select account_status from users where id = ${editorID}`) === 'disabled')
  check('Manager can disable an editor', sql(`select role || '|' || account_status from users where id = ${editorID}`) === 'editor|disabled')
  await editorAccountRow.getByRole('button', { name: 'Re-enable' }).click()
  await editorAccountRow.locator('select[name=role]').waitFor()
  check('Re-enabling brings the role controls back immediately', (await editorAccountRow.getByRole('button', { name: 'Update Role' }).count()) === 1)
  await waitFor(() => sql(`select account_status from users where id = ${editorID}`) === 'active')
  await editorAccountRow.getByRole('button', { name: 'Disable' }).click()
  await waitFor(() => sql(`select account_status from users where id = ${editorID}`) === 'disabled')
  r = await status(editor.context, 'GET', `/api/users/me`)
  check('Disabled editor is signed out immediately', !(await r.json()).user)
  check('Disabled editor cannot sign in', await loginFails(EDITOR))

  await manager.page.goto(`${BASE}/editorial/users`)
  await manager.page
    .locator('article.editorial-user-row', { hasText: EDITOR })
    .filter({ has: manager.page.getByRole('button', { name: 'Re-enable' }) })
    .getByRole('button', { name: 'Re-enable' })
    .click()
  await waitFor(() => sql(`select account_status from users where id = ${editorID}`) === 'active')
  check('Re-enabled editor can sign in again', sql(`select account_status from users where id = ${editorID}`) === 'active' && Boolean(await login(EDITOR)))

  // ------------------------------------- permanent delete of a paper with notes
  await manager.page.goto(`${BASE}/editorial/submissions/${submissionID}`)
  await manager.page.getByRole('button', { name: 'Move to Trash' }).click()
  await manager.page.waitForURL(/\/editorial\/trash/)
  await manager.page.goto(`${BASE}/editorial/submissions/${submissionID}`)
  await manager.page.getByRole('button', { name: 'Delete Permanently' }).click()
  await manager.page.waitForLoadState('networkidle')
  check(
    'Manager can permanently delete a paper that has notes',
    sql(`select count(*) from submissions where id = ${submissionID}`) === '0',
  )

  // ---------------------------------------------------------------- logout
  await manager.page.goto(`${BASE}/`)
  await manager.page.locator('.user-menu summary').click()
  await Promise.all([
    manager.page.waitForResponse((response) => response.url().endsWith('/api/users/logout')),
    manager.page.getByRole('button', { name: 'Logout' }).click(),
  ])
  await manager.page.waitForLoadState('networkidle')
  r = await status(manager.context, 'GET', `/api/users/me`)
  check('Logout button signs out', !(await r.json()).user)
} catch (error) {
  console.error('ABORTED:', error.message)
  for (const context of browser.contexts()) {
    for (const page of context.pages()) await shot(page, `${Date.now()}`).catch(() => {})
  }
  results.push({ name: 'Script completed', ok: false, detail: error.message.split('\n')[0] })
} finally {
  await browser.close()
}

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
