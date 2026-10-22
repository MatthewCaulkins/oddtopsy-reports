import * as migration_20260918_034400 from './20260918_034400';
import * as migration_20261022_024423_rbac_media_audience_revisions from './20261022_024423_rbac_media_audience_revisions';

export const migrations = [
  {
    up: migration_20260918_034400.up,
    down: migration_20260918_034400.down,
    name: '20260918_034400',
  },
  {
    up: migration_20261022_024423_rbac_media_audience_revisions.up,
    down: migration_20261022_024423_rbac_media_audience_revisions.down,
    name: '20261022_024423_rbac_media_audience_revisions'
  },
];
