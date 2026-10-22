import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_audience" AS ENUM('staff', 'public');
  ALTER TABLE "editor_notes" ALTER COLUMN "created_by_id" DROP NOT NULL;
  ALTER TABLE "media" ADD COLUMN "audience" "enum_media_audience" DEFAULT 'staff';
  ALTER TABLE "submissions" ADD COLUMN "revision_access_token_hash" varchar;
  ALTER TABLE "submissions" ADD COLUMN "revision_access_expires_at" timestamp(3) with time zone;
  ALTER TABLE "_submissions_v" ADD COLUMN "version_revision_access_token_hash" varchar;
  ALTER TABLE "_submissions_v" ADD COLUMN "version_revision_access_expires_at" timestamp(3) with time zone;
  CREATE INDEX "media_audience_idx" ON "media" USING btree ("audience");
  CREATE INDEX "submissions_revision_access_revision_access_token_hash_idx" ON "submissions" USING btree ("revision_access_token_hash");
  CREATE INDEX "_submissions_v_version_revision_access_version_revision__idx" ON "_submissions_v" USING btree ("version_revision_access_token_hash");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "media_audience_idx";
  DROP INDEX "submissions_revision_access_revision_access_token_hash_idx";
  DROP INDEX "_submissions_v_version_revision_access_version_revision__idx";
  ALTER TABLE "editor_notes" ALTER COLUMN "created_by_id" SET NOT NULL;
  ALTER TABLE "media" DROP COLUMN "audience";
  ALTER TABLE "submissions" DROP COLUMN "revision_access_token_hash";
  ALTER TABLE "submissions" DROP COLUMN "revision_access_expires_at";
  ALTER TABLE "_submissions_v" DROP COLUMN "version_revision_access_token_hash";
  ALTER TABLE "_submissions_v" DROP COLUMN "version_revision_access_expires_at";
  DROP TYPE "public"."enum_media_audience";`)
}
