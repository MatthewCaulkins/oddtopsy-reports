import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "sms_mfa_enabled" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "sms_mfa_phone_number" varchar;
  ALTER TABLE "users" ADD COLUMN "sms_mfa_consented_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "sms_mfa_terms_accepted" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "sms_mfa_enabled";
  ALTER TABLE "users" DROP COLUMN "sms_mfa_phone_number";
  ALTER TABLE "users" DROP COLUMN "sms_mfa_consented_at";
  ALTER TABLE "users" DROP COLUMN "sms_mfa_terms_accepted";`)
}
