import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "submissions" ADD COLUMN "submission_key" varchar;
  ALTER TABLE "_submissions_v" ADD COLUMN "version_submission_key" varchar;
  CREATE UNIQUE INDEX "submissions_submission_key_idx" ON "submissions" USING btree ("submission_key");
  CREATE INDEX "_submissions_v_version_version_submission_key_idx" ON "_submissions_v" USING btree ("version_submission_key");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "submissions_submission_key_idx";
  DROP INDEX "_submissions_v_version_version_submission_key_idx";
  ALTER TABLE "submissions" DROP COLUMN "submission_key";
  ALTER TABLE "_submissions_v" DROP COLUMN "version_submission_key";`)
}
