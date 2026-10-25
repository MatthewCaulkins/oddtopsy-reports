import * as migration_20260918_034400 from './20260918_034400';
import * as migration_20261022_024423_rbac_media_audience_revisions from './20261022_024423_rbac_media_audience_revisions';
import * as migration_20261022_210138_access_requests_account_status from './20261022_210138_access_requests_account_status';
import * as migration_20261023_033327_users_cognito_sub from './20261023_033327_users_cognito_sub';
import * as migration_20261023_192751_submissions_submission_key from './20261023_192751_submissions_submission_key';
import * as migration_20261024_130000_editor_notes_decision from './20261024_130000_editor_notes_decision';
import * as migration_20261024_120000_backfill_article_slugs from './20261024_120000_backfill_article_slugs';

export const migrations = [
  {
    up: migration_20260918_034400.up,
    down: migration_20260918_034400.down,
    name: '20260918_034400',
  },
  {
    up: migration_20261022_024423_rbac_media_audience_revisions.up,
    down: migration_20261022_024423_rbac_media_audience_revisions.down,
    name: '20261022_024423_rbac_media_audience_revisions',
  },
  {
    up: migration_20261022_210138_access_requests_account_status.up,
    down: migration_20261022_210138_access_requests_account_status.down,
    name: '20261022_210138_access_requests_account_status',
  },
  {
    up: migration_20261023_033327_users_cognito_sub.up,
    down: migration_20261023_033327_users_cognito_sub.down,
    name: '20261023_033327_users_cognito_sub',
  },
  {
    up: migration_20261023_192751_submissions_submission_key.up,
    down: migration_20261023_192751_submissions_submission_key.down,
    name: '20261023_192751_submissions_submission_key',
  },
  {
    up: migration_20261024_120000_backfill_article_slugs.up,
    down: migration_20261024_120000_backfill_article_slugs.down,
    name: '20261024_120000_backfill_article_slugs',
  },
  {
    up: migration_20261024_130000_editor_notes_decision.up,
    down: migration_20261024_130000_editor_notes_decision.down,
    name: '20261024_130000_editor_notes_decision',
  },
];
