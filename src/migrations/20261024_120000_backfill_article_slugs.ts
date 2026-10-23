import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

import { uniqueSlug } from '@/lib/slugs'

/*
 * Data only (no schema change): gives every published paper that has no
 * slug a permanent one from its title, so old /articles/<id> links can
 * redirect to it. Papers that already have a slug are left alone.
 * Safe to run again.
 */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const papers = await payload.find({
    collection: 'submissions',
    where: {
      and: [
        { workflowStatus: { equals: 'published' } },
        { or: [{ slug: { exists: false } }, { slug: { equals: '' } }] },
      ],
    },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })

  for (const paper of papers.docs) {
    const slug = await uniqueSlug(payload, paper.title, { excludeID: paper.id, req })

    await payload.update({
      collection: 'submissions',
      id: paper.id,
      data: { slug },
      depth: 0,
      overrideAccess: true,
      req,
    })

    payload.logger.info({ submissionID: paper.id, slug }, 'Assigned article slug')
  }

  payload.logger.info(`Article slugs backfilled for ${papers.docs.length} published paper(s)`)
}

// Slugs are kept on the way down: removing them would break published links.
export async function down(_args: MigrateDownArgs): Promise<void> {}
