import { permanentRedirect } from 'next/navigation'

// Old signup links now go to the Request Access form.
export default function SignupPage() {
  permanentRedirect('/request-access')
}
