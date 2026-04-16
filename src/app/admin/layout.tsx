import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await auth()
    const role = (session?.user as { role?: string })?.role
    if (!session || role !== 'ADMIN') redirect('/login')

    return (
        <div className="app-shell">
            <AdminSidebar />
            <div className="main-content">
                {children}
            </div>
        </div>
    )
}
