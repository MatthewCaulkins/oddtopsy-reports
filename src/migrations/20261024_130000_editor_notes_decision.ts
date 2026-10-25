import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_editor_notes_note_type" ADD VALUE 'decision' BEFORE 'publication_note';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Decision notes are kept as internal notes (their text starts with the decision).
  await db.execute(sql`
   ALTER TABLE "editor_notes" ALTER COLUMN "note_type" SET DATA TYPE text;
  UPDATE "editor_notes" SET "note_type" = 'internal' WHERE "note_type" = 'decision';
  ALTER TABLE "editor_notes" ALTER COLUMN "note_type" SET DEFAULT 'internal'::text;
  DROP TYPE "public"."enum_editor_notes_note_type";
  CREATE TYPE "public"."enum_editor_notes_note_type" AS ENUM('internal', 'revision_request', 'publication_note');
  ALTER TABLE "editor_notes" ALTER COLUMN "note_type" SET DEFAULT 'internal'::"public"."enum_editor_notes_note_type";
  ALTER TABLE "editor_notes" ALTER COLUMN "note_type" SET DATA TYPE "public"."enum_editor_notes_note_type" USING "note_type"::"public"."enum_editor_notes_note_type";`)
}
