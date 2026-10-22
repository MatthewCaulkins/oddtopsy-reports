import type { Submission } from '@/payload-types'

export type WorkflowStatus = Submission['workflowStatus']

export const workflowStatusLabels: Record<WorkflowStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  in_progress: 'In Progress',
  revision_requested: 'Revision Requested',
  accepted: 'Accepted',
  rejected: 'Rejected',
  published: 'Published',
}

/*
 * Statuses staff can choose when taking a published paper offline.
 * Revision Requested goes through Request Revisions instead, so the
 * author is emailed a link.
 */
export const unpublishStatuses = ['in_progress', 'under_review', 'accepted', 'rejected'] as const

export type UnpublishStatus = (typeof unpublishStatuses)[number]

export function isUnpublishStatus(value: unknown): value is UnpublishStatus {
  return unpublishStatuses.includes(value as UnpublishStatus)
}
