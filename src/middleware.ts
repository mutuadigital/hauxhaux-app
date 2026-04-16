import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    const session = await auth()
    const { pathname } = request.nextUrl

    // Rotas públicas
    if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
        if (session && pathname === '/login') {
            const role = (session.user as { role: string }).role
            return NextResponse.redirect(
                new URL(role === 'ADMIN' ? '/admin' : '/portal', request.url)
            )
        }
        return NextResponse.next()
    }

    // Exige autenticação
    if (!session) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    const role = (session.user as { role: string }).role

    // Portal do parceiro — só PARTNER
    if (pathname.startsWith('/portal') && role !== 'PARTNER') {
        return NextResponse.redirect(new URL('/admin', request.url))
    }

    // Admin — só ADMIN
    if (pathname.startsWith('/admin') && role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/portal', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/admin/:path*', '/portal/:path*', '/login'],
}
