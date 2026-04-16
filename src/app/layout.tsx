import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from 'next-auth/react'

export const metadata: Metadata = {
    title: { default: 'HAUXHAUX — Sistema de Gestão', template: '%s | HAUXHAUX' },
    description: 'Sistema de gestão de produção, estoque, consignação e faturamento da HAUXHAUX.',
    robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body>
                <SessionProvider>{children}</SessionProvider>
            </body>
        </html>
    )
}
