import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function RootPage() {
    const session = await auth()
    if (!session) redirect('/login')
    const role = (session.user as { role?: string })?.role
    if (role === 'ADMIN') redirect('/admin')
    redirect('/portal')
}
