# Oddtopsy Reports notification matrix

Every email the system sends, what triggers it, and who receives it.
Application emails are defined in `src/lib/notifications.ts` and sent
through Amazon SES (`src/lib/email/sesAdapter.ts`); Cognito sends its own
account emails.

**Rules for all application emails**

- Sent only after the change they describe has been saved, and outside
  the request (`next/server` `after`), so delivery can never fail or slow
  down the action. Failures are logged (`event`, counts, SES message IDs,
  no addresses or tokens) and never shown to the person acting.
- One message per recipient. "Staff" means **active** users with the
  listed roles; invited and disabled accounts receive nothing.
- Repeats do not resend: each row notes what stops duplicates.

| Event | Trigger | Recipients | Actor excluded? | Subject | Link | Duplicate guard | Status |
|---|---|---|---|---|---|---|---|
| Access requested | Visitor submits Request Access | Active managers and admins | n/a (anonymous) | Access request: *name* | `/editorial/users` | One open request per email; known emails ignored | Implemented, tested |
| Access approved (production) | Manager/admin approves | Applicant | n/a | Cognito invitation (console template) | `oddtopsies.org` sign-in | Provisioning record; Resend Invite is explicit | Implemented (Cognito) |
| Access approved (local) | Manager/admin approves | Applicant | n/a | Set up your Oddtopsy Reports account | `/reset-password?…&invite=1` | Provisioning record | Implemented, tested |
| Access rejected | Manager/admin rejects | Applicant (internal note never included) | n/a | Your Oddtopsy Reports access request | `/submit` | Only pending requests can be rejected | Implemented, tested |
| Sign-in invite, existing account | Admin/manager presses Send Sign-in Invite | That user | n/a | Cognito invitation | Cognito sign-in | Button hidden once linked | Implemented (Cognito) |
| Manuscript submitted | Visitor submits a paper | Active editors, managers, admins | n/a (anonymous) | New submission: *title* | `/editorial/submissions/:id` | Per-form submission key | Implemented, tested |
| Submission receipt | Visitor submits a paper | Corresponding author | n/a | Submission received: *title* | none | Per-form submission key | Implemented, tested |
| Revisions requested | Editor sends Request Revisions | Corresponding author | n/a | Revisions requested: *title* | Private `/revise/…` link (60 days) | Same message within 2 minutes is ignored | Implemented, tested |
| Revision resubmitted | Author submits via link | Active editors, managers, admins | n/a (author) | Revised submission: *title* | `/editorial/submissions/:id` | Link is spent on resubmit | Implemented, tested |
| Accepted | Editor records the decision Accept | Corresponding author (with the editors' message, if any) | n/a | Accepted: *title* | none | Only when the status changes; repeating the current decision does nothing | Implemented, tested |
| Rejected | Editor records the decision Reject (message required) | Corresponding author (with the editors' message) | n/a | Decision on your submission: *title* | none | Only when the status changes | Implemented, tested |
| Published | Editor uses Approve & Publish | Corresponding author | n/a | Published: *title* | `/articles/:slug` | Only on a transition to Published | Implemented, tested |
| Published (team notice) | Editor uses Approve & Publish | Active editors, managers, admins | **Yes** | Published: *title* | `/articles/:slug` | Only on a transition to Published | Implemented, tested |
| Unpublished | Editor unpublishes | nobody | n/a | n/a | n/a | n/a | Not sent (deliberate: internal) |
| Status changes in Payload Admin | Admin edits the status field directly | nobody | n/a | n/a | n/a | n/a | Not sent (deliberate: use Record Decision to notify the author) |
| Account disabled / re-enabled / role changed / deleted | Admin/manager on the Users page | nobody | n/a | n/a | n/a | n/a | Not sent (deliberate) |
| Sign-in code (MFA) | Cognito sign-in | That user | n/a | Your Oddtopsy Reports sign-in code | none | Cognito | Cognito (console template) |
| Password reset / verification code | Cognito "Forgot password" | That user | n/a | Your Oddtopsy Reports verification code | none | Cognito | Cognito (console template) |
| Email test | `src/scripts/sendTestEmail.ts` | Active admins (or one address) | n/a | Oddtopsy Reports email test | `/editorial` | Manual | Implemented |

## Candidates for later

- **Unpublished notice to the author**, if unpublishing ever needs to be
  explained to them.
- **Daily digest for staff** instead of one email per submission, if
  volume grows.
