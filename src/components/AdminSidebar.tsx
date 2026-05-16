'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

type NavItem = { href: string; label: string; icon: string; exact?: boolean }

const navItems: { section: string; items: NavItem[] }[] = [
    {
        section: 'Principal',
        items: [
            { href: '/admin', label: 'Dashboard', icon: '📊', exact: true },
        ],
    },
    {
        section: 'Cadastros',
        items: [
            { href: '/admin/produtos', label: 'Produtos', icon: '🧴' },
            { href: '/admin/insumos', label: 'Insumos', icon: '🌿' },
            { href: '/admin/categorias', label: 'Categorias', icon: '🏷️' },
            { href: '/admin/parceiros', label: 'Parceiros', icon: '🤝' },
            { href: '/admin/clientes', label: 'Clientes', icon: '👥' },
            { href: '/admin/usuarios', label: 'Usuários', icon: '👤' },
        ],
    },
    {
        section: 'Operação',
        items: [
            { href: '/admin/compras', label: 'Compras', icon: '🛒' },
            { href: '/admin/producao', label: 'Produção', icon: '⚗️' },
            { href: '/admin/estoque', label: 'Estoque', icon: '📦' },
            { href: '/admin/vendas-diretas', label: 'Vendas Diretas', icon: '🛍' },
        ],
    },
    {
        section: 'Consignação',
        items: [
            { href: '/admin/consignacao/remessas', label: 'Remessas', icon: '🚚' },
            { href: '/admin/consignacao/devolucoes', label: 'Devoluções', icon: '↩️' },
        ],
    },
    {
        section: 'Financeiro',
        items: [
            { href: '/admin/fechamentos', label: 'Fechamentos', icon: '📅' },
            { href: '/admin/financeiro', label: 'Contas a Receber', icon: '💰' },
        ],
    },
]

export function AdminSidebar() {
    const pathname = usePathname()
    const { data: session } = useSession()

    const isActive = (href: string, exact = false) => {
        if (exact) return pathname === href
        return pathname.startsWith(href)
    }

    const initials = (name?: string | null) =>
        (name ?? 'A').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-title">HAUXHAUX</div>
                <div className="sidebar-logo-sub">Sistema de Gestão</div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((section) => (
                    <div key={section.section}>
                        <div className="sidebar-section-label">{section.section}</div>
                        {section.items.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`sidebar-item ${isActive(item.href, item.exact) ? 'active' : ''}`}
                            >
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="sidebar-avatar">{initials(session?.user?.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="sidebar-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {session?.user?.name ?? 'Administrador'}
                        </div>
                        <div className="sidebar-user-role">Admin</div>
                    </div>
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="btn-icon"
                        title="Sair"
                        style={{ color: 'rgba(255,255,255,0.45)' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>
            </div>
        </aside>
    )
}
