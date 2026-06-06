import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET() {
  const cookieStore = await cookies()

  cookieStore.delete('payload-token')
  cookieStore.delete('payload-token.sig')

  redirect('/')
}
