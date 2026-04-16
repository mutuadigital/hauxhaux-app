import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignOutButton } from '@/components/SignOutButton'

const portalNav = [
    { href: '/portal', label: '🏠 Início', exact: true },
    { href: '/portal/estoque', label: '📦 Meu Estoque' },
    { href: '/portal/vendas', label: '🛒 Registrar Venda' },
    { href: '/portal/consumo', label: '📝 Declarar Consumo' },
    { href: '/portal/historico', label: '📋 Histórico' },
]

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
    const session = await auth()
    const role = (session?.user as { role?: string })?.role
    if (!session || role !== 'PARTNER') redirect('/login')

    return (
        <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
            {/* Portal Header */}
            <header style={{
                background: 'var(--color-bg-dark)',
                borderBottom: '2px solid var(--color-accent)',
                padding: '0 var(--space-6)',
                height: 'var(--header-height)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 100,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', color: 'var(--color-accent)', letterSpacing: '2px' }}>
                        HAUXHAUX
                    </span>
                    <nav style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {portalNav.map((item) => (
                            <Link key={item.href} href={item.href} style={{
                                color: 'rgba(255,255,255,0.75)',
                                padding: '6px 14px',
                                borderRadius: 'var(--radius)',
                                fontSize: 'var(--text-sm)',
                                fontWeight: 500,
                                transition: 'var(--transition)',
                            }}>
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--text-sm)' }}>
                        {session.user?.name}
                    </span>
                    <SignOutButton />
                </div>
            </header>
            <main style={{ padding: 'var(--space-6)', maxWidth: '1100px', margin: '0 auto' }}>
                {children}
            </main>
        </div>
    )
}
