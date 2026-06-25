import type { FocusArea, Submission } from '@/payload-types'

export type SubmissionFormMode = 'create' | 'edit'

export type SubmissionFormProps = {
  mode: SubmissionFormMode
  focusAreas: FocusArea[]
  submission?: Submission
  action: (formData: FormData) => void | Promise<void>
  submitLabel?: string
}