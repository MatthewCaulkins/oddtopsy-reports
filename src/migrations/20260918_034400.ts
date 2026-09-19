import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_editor_notes_note_type" AS ENUM('internal', 'revision_request', 'publication_note');
  CREATE TYPE "public"."enum_submissions_submission_type" AS ENUM('upload', 'editor');
  CREATE TYPE "public"."enum_submissions_workflow_status" AS ENUM('submitted', 'under_review', 'in_progress', 'revision_requested', 'accepted', 'rejected', 'published');
  CREATE TYPE "public"."enum_submissions_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__submissions_v_version_submission_type" AS ENUM('upload', 'editor');
  CREATE TYPE "public"."enum__submissions_v_version_workflow_status" AS ENUM('submitted', 'under_review', 'in_progress', 'revision_requested', 'accepted', 'rejected', 'published');
  CREATE TYPE "public"."enum__submissions_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_site_content_page" AS ENUM('papers', 'submit', 'about', 'subscribe');
  CREATE TYPE "public"."enum_site_content_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__site_content_v_version_page" AS ENUM('papers', 'submit', 'about', 'subscribe');
  CREATE TYPE "public"."enum__site_content_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_users_role" AS ENUM('pending', 'editor', 'manager', 'admin');
  CREATE TABLE "editor_notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"submission_id" integer NOT NULL,
  	"created_by_id" integer NOT NULL,
  	"note_type" "enum_editor_notes_note_type" DEFAULT 'internal' NOT NULL,
  	"note" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "focus_areas" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"description" varchar,
  	"display_order" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_square_url" varchar,
  	"sizes_square_width" numeric,
  	"sizes_square_height" numeric,
  	"sizes_square_mime_type" varchar,
  	"sizes_square_filesize" numeric,
  	"sizes_square_filename" varchar,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar
  );
  
  CREATE TABLE "submissions_keywords" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"keyword" varchar
  );
  
  CREATE TABLE "submissions_co_authors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"affiliation" varchar
  );
  
  CREATE TABLE "submissions_supporting_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar
  );
  
  CREATE TABLE "submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"subtitle" varchar,
  	"slug" varchar,
  	"abstract" varchar,
  	"finding_date" timestamp(3) with time zone,
  	"location" varchar,
  	"media_notes" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"featured_image_id" integer,
  	"published_date" timestamp(3) with time zone,
  	"featured" boolean DEFAULT false,
  	"corresponding_author_name" varchar,
  	"corresponding_author_email" varchar,
  	"corresponding_author_affiliation" varchar,
  	"lead_author_name" varchar,
  	"lead_author_affiliation" varchar,
  	"submission_type" "enum_submissions_submission_type" DEFAULT 'upload',
  	"manuscript_p_d_f_id" integer,
  	"manuscript_body" varchar,
  	"author_message" varchar,
  	"workflow_status" "enum_submissions_workflow_status" DEFAULT 'submitted',
  	"trashed" boolean DEFAULT false,
  	"trashed_at" timestamp(3) with time zone,
  	"trashed_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_submissions_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "submissions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"focus_areas_id" integer
  );
  
  CREATE TABLE "_submissions_v_version_keywords" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"keyword" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_submissions_v_version_co_authors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"affiliation" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_submissions_v_version_supporting_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_submissions_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_subtitle" varchar,
  	"version_slug" varchar,
  	"version_abstract" varchar,
  	"version_finding_date" timestamp(3) with time zone,
  	"version_location" varchar,
  	"version_media_notes" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_featured_image_id" integer,
  	"version_published_date" timestamp(3) with time zone,
  	"version_featured" boolean DEFAULT false,
  	"version_corresponding_author_name" varchar,
  	"version_corresponding_author_email" varchar,
  	"version_corresponding_author_affiliation" varchar,
  	"version_lead_author_name" varchar,
  	"version_lead_author_affiliation" varchar,
  	"version_submission_type" "enum__submissions_v_version_submission_type" DEFAULT 'upload',
  	"version_manuscript_p_d_f_id" integer,
  	"version_manuscript_body" varchar,
  	"version_author_message" varchar,
  	"version_workflow_status" "enum__submissions_v_version_workflow_status" DEFAULT 'submitted',
  	"version_trashed" boolean DEFAULT false,
  	"version_trashed_at" timestamp(3) with time zone,
  	"version_trashed_by_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__submissions_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_submissions_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"focus_areas_id" integer
  );
  
  CREATE TABLE "site_content_editorial_board" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"photo_id" integer,
  	"name" varchar,
  	"title" varchar,
  	"affiliation" varchar,
  	"biography" varchar
  );
  
  CREATE TABLE "site_content" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"page" "enum_site_content_page",
  	"hero_title" varchar,
  	"hero_body" varchar,
  	"content" varchar,
  	"secondary_title" varchar,
  	"secondary_content" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_site_content_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_site_content_v_version_editorial_board" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"photo_id" integer,
  	"name" varchar,
  	"title" varchar,
  	"affiliation" varchar,
  	"biography" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_content_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_page" "enum__site_content_v_version_page",
  	"version_hero_title" varchar,
  	"version_hero_body" varchar,
  	"version_content" varchar,
  	"version_secondary_title" varchar,
  	"version_secondary_content" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__site_content_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum_users_role" DEFAULT 'pending' NOT NULL,
  	"profile_display_name" varchar,
  	"profile_title" varchar,
  	"profile_affiliation" varchar,
  	"profile_photo_id" integer,
  	"profile_biography" varchar,
  	"profile_display_on_about_page" boolean DEFAULT false,
  	"profile_display_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"editor_notes_id" integer,
  	"focus_areas_id" integer,
  	"media_id" integer,
  	"submissions_id" integer,
  	"site_content_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "about" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'About Oddtopsy Reports' NOT NULL,
  	"intro" varchar,
  	"why_we_exist" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "editor_notes" ADD CONSTRAINT "editor_notes_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "editor_notes" ADD CONSTRAINT "editor_notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions_keywords" ADD CONSTRAINT "submissions_keywords_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "submissions_co_authors" ADD CONSTRAINT "submissions_co_authors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "submissions_supporting_images" ADD CONSTRAINT "submissions_supporting_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions_supporting_images" ADD CONSTRAINT "submissions_supporting_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_manuscript_p_d_f_id_media_id_fk" FOREIGN KEY ("manuscript_p_d_f_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_trashed_by_id_users_id_fk" FOREIGN KEY ("trashed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions_rels" ADD CONSTRAINT "submissions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "submissions_rels" ADD CONSTRAINT "submissions_rels_focus_areas_fk" FOREIGN KEY ("focus_areas_id") REFERENCES "public"."focus_areas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_submissions_v_version_keywords" ADD CONSTRAINT "_submissions_v_version_keywords_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_submissions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_submissions_v_version_co_authors" ADD CONSTRAINT "_submissions_v_version_co_authors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_submissions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_submissions_v_version_supporting_images" ADD CONSTRAINT "_submissions_v_version_supporting_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_submissions_v_version_supporting_images" ADD CONSTRAINT "_submissions_v_version_supporting_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_submissions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_submissions_v" ADD CONSTRAINT "_submissions_v_parent_id_submissions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_submissions_v" ADD CONSTRAINT "_submissions_v_version_featured_image_id_media_id_fk" FOREIGN KEY ("version_featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_submissions_v" ADD CONSTRAINT "_submissions_v_version_manuscript_p_d_f_id_media_id_fk" FOREIGN KEY ("version_manuscript_p_d_f_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_submissions_v" ADD CONSTRAINT "_submissions_v_version_trashed_by_id_users_id_fk" FOREIGN KEY ("version_trashed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_submissions_v_rels" ADD CONSTRAINT "_submissions_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_submissions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_submissions_v_rels" ADD CONSTRAINT "_submissions_v_rels_focus_areas_fk" FOREIGN KEY ("focus_areas_id") REFERENCES "public"."focus_areas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_content_editorial_board" ADD CONSTRAINT "site_content_editorial_board_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_content_editorial_board" ADD CONSTRAINT "site_content_editorial_board_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_content_v_version_editorial_board" ADD CONSTRAINT "_site_content_v_version_editorial_board_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_content_v_version_editorial_board" ADD CONSTRAINT "_site_content_v_version_editorial_board_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_content_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_content_v" ADD CONSTRAINT "_site_content_v_parent_id_site_content_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."site_content"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_profile_photo_id_media_id_fk" FOREIGN KEY ("profile_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_editor_notes_fk" FOREIGN KEY ("editor_notes_id") REFERENCES "public"."editor_notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_focus_areas_fk" FOREIGN KEY ("focus_areas_id") REFERENCES "public"."focus_areas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_submissions_fk" FOREIGN KEY ("submissions_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_site_content_fk" FOREIGN KEY ("site_content_id") REFERENCES "public"."site_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "editor_notes_submission_idx" ON "editor_notes" USING btree ("submission_id");
  CREATE INDEX "editor_notes_created_by_idx" ON "editor_notes" USING btree ("created_by_id");
  CREATE INDEX "editor_notes_updated_at_idx" ON "editor_notes" USING btree ("updated_at");
  CREATE INDEX "editor_notes_created_at_idx" ON "editor_notes" USING btree ("created_at");
  CREATE UNIQUE INDEX "focus_areas_slug_idx" ON "focus_areas" USING btree ("slug");
  CREATE INDEX "focus_areas_updated_at_idx" ON "focus_areas" USING btree ("updated_at");
  CREATE INDEX "focus_areas_created_at_idx" ON "focus_areas" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_square_sizes_square_filename_idx" ON "media" USING btree ("sizes_square_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "media" USING btree ("sizes_hero_filename");
  CREATE INDEX "submissions_keywords_order_idx" ON "submissions_keywords" USING btree ("_order");
  CREATE INDEX "submissions_keywords_parent_id_idx" ON "submissions_keywords" USING btree ("_parent_id");
  CREATE INDEX "submissions_co_authors_order_idx" ON "submissions_co_authors" USING btree ("_order");
  CREATE INDEX "submissions_co_authors_parent_id_idx" ON "submissions_co_authors" USING btree ("_parent_id");
  CREATE INDEX "submissions_supporting_images_order_idx" ON "submissions_supporting_images" USING btree ("_order");
  CREATE INDEX "submissions_supporting_images_parent_id_idx" ON "submissions_supporting_images" USING btree ("_parent_id");
  CREATE INDEX "submissions_supporting_images_image_idx" ON "submissions_supporting_images" USING btree ("image_id");
  CREATE UNIQUE INDEX "submissions_slug_idx" ON "submissions" USING btree ("slug");
  CREATE INDEX "submissions_featured_image_idx" ON "submissions" USING btree ("featured_image_id");
  CREATE INDEX "submissions_manuscript_p_d_f_idx" ON "submissions" USING btree ("manuscript_p_d_f_id");
  CREATE INDEX "submissions_trashed_by_idx" ON "submissions" USING btree ("trashed_by_id");
  CREATE INDEX "submissions_updated_at_idx" ON "submissions" USING btree ("updated_at");
  CREATE INDEX "submissions_created_at_idx" ON "submissions" USING btree ("created_at");
  CREATE INDEX "submissions__status_idx" ON "submissions" USING btree ("_status");
  CREATE INDEX "submissions_rels_order_idx" ON "submissions_rels" USING btree ("order");
  CREATE INDEX "submissions_rels_parent_idx" ON "submissions_rels" USING btree ("parent_id");
  CREATE INDEX "submissions_rels_path_idx" ON "submissions_rels" USING btree ("path");
  CREATE INDEX "submissions_rels_focus_areas_id_idx" ON "submissions_rels" USING btree ("focus_areas_id");
  CREATE INDEX "_submissions_v_version_keywords_order_idx" ON "_submissions_v_version_keywords" USING btree ("_order");
  CREATE INDEX "_submissions_v_version_keywords_parent_id_idx" ON "_submissions_v_version_keywords" USING btree ("_parent_id");
  CREATE INDEX "_submissions_v_version_co_authors_order_idx" ON "_submissions_v_version_co_authors" USING btree ("_order");
  CREATE INDEX "_submissions_v_version_co_authors_parent_id_idx" ON "_submissions_v_version_co_authors" USING btree ("_parent_id");
  CREATE INDEX "_submissions_v_version_supporting_images_order_idx" ON "_submissions_v_version_supporting_images" USING btree ("_order");
  CREATE INDEX "_submissions_v_version_supporting_images_parent_id_idx" ON "_submissions_v_version_supporting_images" USING btree ("_parent_id");
  CREATE INDEX "_submissions_v_version_supporting_images_image_idx" ON "_submissions_v_version_supporting_images" USING btree ("image_id");
  CREATE INDEX "_submissions_v_parent_idx" ON "_submissions_v" USING btree ("parent_id");
  CREATE INDEX "_submissions_v_version_version_slug_idx" ON "_submissions_v" USING btree ("version_slug");
  CREATE INDEX "_submissions_v_version_version_featured_image_idx" ON "_submissions_v" USING btree ("version_featured_image_id");
  CREATE INDEX "_submissions_v_version_version_manuscript_p_d_f_idx" ON "_submissions_v" USING btree ("version_manuscript_p_d_f_id");
  CREATE INDEX "_submissions_v_version_version_trashed_by_idx" ON "_submissions_v" USING btree ("version_trashed_by_id");
  CREATE INDEX "_submissions_v_version_version_updated_at_idx" ON "_submissions_v" USING btree ("version_updated_at");
  CREATE INDEX "_submissions_v_version_version_created_at_idx" ON "_submissions_v" USING btree ("version_created_at");
  CREATE INDEX "_submissions_v_version_version__status_idx" ON "_submissions_v" USING btree ("version__status");
  CREATE INDEX "_submissions_v_created_at_idx" ON "_submissions_v" USING btree ("created_at");
  CREATE INDEX "_submissions_v_updated_at_idx" ON "_submissions_v" USING btree ("updated_at");
  CREATE INDEX "_submissions_v_latest_idx" ON "_submissions_v" USING btree ("latest");
  CREATE INDEX "_submissions_v_rels_order_idx" ON "_submissions_v_rels" USING btree ("order");
  CREATE INDEX "_submissions_v_rels_parent_idx" ON "_submissions_v_rels" USING btree ("parent_id");
  CREATE INDEX "_submissions_v_rels_path_idx" ON "_submissions_v_rels" USING btree ("path");
  CREATE INDEX "_submissions_v_rels_focus_areas_id_idx" ON "_submissions_v_rels" USING btree ("focus_areas_id");
  CREATE INDEX "site_content_editorial_board_order_idx" ON "site_content_editorial_board" USING btree ("_order");
  CREATE INDEX "site_content_editorial_board_parent_id_idx" ON "site_content_editorial_board" USING btree ("_parent_id");
  CREATE INDEX "site_content_editorial_board_photo_idx" ON "site_content_editorial_board" USING btree ("photo_id");
  CREATE UNIQUE INDEX "site_content_page_idx" ON "site_content" USING btree ("page");
  CREATE INDEX "site_content_updated_at_idx" ON "site_content" USING btree ("updated_at");
  CREATE INDEX "site_content_created_at_idx" ON "site_content" USING btree ("created_at");
  CREATE INDEX "site_content__status_idx" ON "site_content" USING btree ("_status");
  CREATE INDEX "_site_content_v_version_editorial_board_order_idx" ON "_site_content_v_version_editorial_board" USING btree ("_order");
  CREATE INDEX "_site_content_v_version_editorial_board_parent_id_idx" ON "_site_content_v_version_editorial_board" USING btree ("_parent_id");
  CREATE INDEX "_site_content_v_version_editorial_board_photo_idx" ON "_site_content_v_version_editorial_board" USING btree ("photo_id");
  CREATE INDEX "_site_content_v_parent_idx" ON "_site_content_v" USING btree ("parent_id");
  CREATE INDEX "_site_content_v_version_version_page_idx" ON "_site_content_v" USING btree ("version_page");
  CREATE INDEX "_site_content_v_version_version_updated_at_idx" ON "_site_content_v" USING btree ("version_updated_at");
  CREATE INDEX "_site_content_v_version_version_created_at_idx" ON "_site_content_v" USING btree ("version_created_at");
  CREATE INDEX "_site_content_v_version_version__status_idx" ON "_site_content_v" USING btree ("version__status");
  CREATE INDEX "_site_content_v_created_at_idx" ON "_site_content_v" USING btree ("created_at");
  CREATE INDEX "_site_content_v_updated_at_idx" ON "_site_content_v" USING btree ("updated_at");
  CREATE INDEX "_site_content_v_latest_idx" ON "_site_content_v" USING btree ("latest");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_profile_profile_photo_idx" ON "users" USING btree ("profile_photo_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_editor_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("editor_notes_id");
  CREATE INDEX "payload_locked_documents_rels_focus_areas_id_idx" ON "payload_locked_documents_rels" USING btree ("focus_areas_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("submissions_id");
  CREATE INDEX "payload_locked_documents_rels_site_content_id_idx" ON "payload_locked_documents_rels" USING btree ("site_content_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "editor_notes" CASCADE;
  DROP TABLE "focus_areas" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "submissions_keywords" CASCADE;
  DROP TABLE "submissions_co_authors" CASCADE;
  DROP TABLE "submissions_supporting_images" CASCADE;
  DROP TABLE "submissions" CASCADE;
  DROP TABLE "submissions_rels" CASCADE;
  DROP TABLE "_submissions_v_version_keywords" CASCADE;
  DROP TABLE "_submissions_v_version_co_authors" CASCADE;
  DROP TABLE "_submissions_v_version_supporting_images" CASCADE;
  DROP TABLE "_submissions_v" CASCADE;
  DROP TABLE "_submissions_v_rels" CASCADE;
  DROP TABLE "site_content_editorial_board" CASCADE;
  DROP TABLE "site_content" CASCADE;
  DROP TABLE "_site_content_v_version_editorial_board" CASCADE;
  DROP TABLE "_site_content_v" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "about" CASCADE;
  DROP TYPE "public"."enum_editor_notes_note_type";
  DROP TYPE "public"."enum_submissions_submission_type";
  DROP TYPE "public"."enum_submissions_workflow_status";
  DROP TYPE "public"."enum_submissions_status";
  DROP TYPE "public"."enum__submissions_v_version_submission_type";
  DROP TYPE "public"."enum__submissions_v_version_workflow_status";
  DROP TYPE "public"."enum__submissions_v_version_status";
  DROP TYPE "public"."enum_site_content_page";
  DROP TYPE "public"."enum_site_content_status";
  DROP TYPE "public"."enum__site_content_v_version_page";
  DROP TYPE "public"."enum__site_content_v_version_status";
  DROP TYPE "public"."enum_users_role";`)
}
