import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Access requests + account status.
 *
 * Users now have a role (editor | manager | admin) and a separate
 * accountStatus (invited | active | disabled). People who signed up
 * but were never approved ("pending" users) become AccessRequests.
 *
 * Existing user records:
 * - editor / manager / admin            -> unchanged, accountStatus 'active'
 * - pending, never did any editorial work -> copied to an AccessRequest
 *   (name, email, affiliation, original request date), then removed from
 *   users; the full original row is kept in migration_backup_pending_users
 * - pending, but has editorial history (wrote a note, trashed a paper) ->
 *   a former editor disabled with the old "Pending / Disable Login"
 *   option: kept as role 'editor', accountStatus 'disabled', so their
 *   history stays linked
 *
 * Nothing else about existing users or their relationships changes.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ---------------------------------------------------------------- A: schema
  await db.execute(sql`
  CREATE TYPE "public"."enum_access_requests_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "public"."enum_access_requests_source" AS ENUM('form', 'migrated');
  CREATE TYPE "public"."enum_access_requests_granted_role" AS ENUM('editor', 'manager');
  CREATE TYPE "public"."enum_access_requests_provisioning_status" AS ENUM('not_started', 'in_progress', 'complete', 'failed');
  CREATE TYPE "public"."enum_users_account_status" AS ENUM('invited', 'active', 'disabled');
  CREATE TABLE "access_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"affiliation" varchar,
  	"status" "enum_access_requests_status" DEFAULT 'pending' NOT NULL,
  	"source" "enum_access_requests_source" DEFAULT 'form' NOT NULL,
  	"granted_role" "enum_access_requests_granted_role",
  	"reviewer_id" integer,
  	"decision_date" timestamp(3) with time zone,
  	"rejection_note" varchar,
  	"user_id" integer,
  	"provisioning_status" "enum_access_requests_provisioning_status" DEFAULT 'not_started',
  	"provisioning_attempts" numeric DEFAULT 0,
  	"provisioning_last_attempt_at" timestamp(3) with time zone,
  	"provisioning_last_error" varchar,
  	"provisioning_invite_sent_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "users" ADD COLUMN "account_status" "enum_users_account_status" DEFAULT 'invited' NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "access_requests_id" integer;
  ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_access_requests_fk" FOREIGN KEY ("access_requests_id") REFERENCES "public"."access_requests"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "access_requests_email_idx" ON "access_requests" USING btree ("email");
  CREATE INDEX "access_requests_status_idx" ON "access_requests" USING btree ("status");
  CREATE INDEX "access_requests_reviewer_idx" ON "access_requests" USING btree ("reviewer_id");
  CREATE INDEX "access_requests_user_idx" ON "access_requests" USING btree ("user_id");
  CREATE INDEX "access_requests_updated_at_idx" ON "access_requests" USING btree ("updated_at");
  CREATE INDEX "access_requests_created_at_idx" ON "access_requests" USING btree ("created_at");
  CREATE INDEX "users_account_status_idx" ON "users" USING btree ("account_status");
  CREATE INDEX "payload_locked_documents_rels_access_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("access_requests_id");`)

  // ------------------------------------------------------- B: existing users
  await db.execute(sql`
  -- 1. Everyone already approved keeps access.
  UPDATE "users" SET "account_status" = 'active' WHERE "role" <> 'pending';

  -- Pending users who have any editorial history are former staff, not applicants.
  CREATE TEMP TABLE "_pending_with_history" ON COMMIT DROP AS
    SELECT u."id" FROM "users" u
    WHERE u."role" = 'pending' AND (
      EXISTS (SELECT 1 FROM "editor_notes" n WHERE n."created_by_id" = u."id")
      OR EXISTS (SELECT 1 FROM "submissions" s WHERE s."trashed_by_id" = u."id")
      OR EXISTS (SELECT 1 FROM "_submissions_v" v WHERE v."version_trashed_by_id" = u."id")
    );

  -- 2. Former staff: keep the account and its history, disabled, least-privileged role.
  UPDATE "users" SET "role" = 'editor', "account_status" = 'disabled'
    WHERE "id" IN (SELECT "id" FROM "_pending_with_history");

  -- 3. Applicants: keep a full copy of the original rows before converting them.
  CREATE TABLE "migration_backup_pending_users" AS
    SELECT u.*, now() AS "migrated_at" FROM "users" u
    WHERE u."role" = 'pending';
  -- Plain text, so the backup does not pin the enum types changed below.
  ALTER TABLE "migration_backup_pending_users"
    ALTER COLUMN "role" SET DATA TYPE text,
    ALTER COLUMN "account_status" SET DATA TYPE text;

  INSERT INTO "access_requests" ("name", "email", "affiliation", "status", "source", "created_at", "updated_at")
    SELECT
      COALESCE(NULLIF(TRIM(u."profile_display_name"), ''), u."email"),
      LOWER(TRIM(u."email")),
      NULLIF(TRIM(u."profile_affiliation"), ''),
      'pending',
      'migrated',
      u."created_at",
      now()
    FROM "users" u
    WHERE u."role" = 'pending';

  -- Their sessions, preferences and document locks are removed with them (ON DELETE CASCADE).
  DELETE FROM "users" WHERE "role" = 'pending';`)

  // ------------------------------------------------- C: drop the 'pending' role
  await db.execute(sql`
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'editor'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('editor', 'manager', 'admin');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'editor'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";`)
}

/*
 * Restores the previous schema and the converted pending users (from
 * the backup table). Former staff disabled by the migration go back to
 * 'pending'; disabled accounts become 'pending' too, since that is how
 * the old schema expressed "disabled". AccessRequests are dropped.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('pending', 'editor', 'manager', 'admin');

  UPDATE "users" SET "role" = 'pending' WHERE "account_status" = 'disabled';

  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'pending'::"public"."enum_users_role";

  INSERT INTO "users" ("id", "role", "profile_display_name", "profile_title", "profile_affiliation",
    "profile_photo_id", "profile_biography", "profile_display_on_about_page", "profile_display_order",
    "updated_at", "created_at", "email", "reset_password_token", "reset_password_expiration",
    "salt", "hash", "login_attempts", "lock_until")
    SELECT "id", 'pending', "profile_display_name", "profile_title", "profile_affiliation",
      "profile_photo_id", "profile_biography", "profile_display_on_about_page", "profile_display_order",
      "updated_at", "created_at", "email", "reset_password_token", "reset_password_expiration",
      "salt", "hash", "login_attempts", "lock_until"
    FROM "migration_backup_pending_users"
    ON CONFLICT ("id") DO NOTHING;
  DROP TABLE "migration_backup_pending_users";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_access_requests_fk";
  DROP INDEX "payload_locked_documents_rels_access_requests_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "access_requests_id";
  DROP TABLE "access_requests" CASCADE;
  DROP INDEX "users_account_status_idx";
  ALTER TABLE "users" DROP COLUMN "account_status";
  DROP TYPE "public"."enum_access_requests_status";
  DROP TYPE "public"."enum_access_requests_source";
  DROP TYPE "public"."enum_access_requests_granted_role";
  DROP TYPE "public"."enum_access_requests_provisioning_status";
  DROP TYPE "public"."enum_users_account_status";`)
}
