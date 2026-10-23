import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "cognito_sub" varchar;
  CREATE UNIQUE INDEX "users_cognito_sub_idx" ON "users" USING btree ("cognito_sub");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "users_cognito_sub_idx";
  ALTER TABLE "users" DROP COLUMN "cognito_sub";`)
}
