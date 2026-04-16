import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import bcrypt from 'bcryptjs'

export async function GET() {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const usuarios = await prisma.user.findMany({
        orderBy: { criadoEm: 'asc' },
        select: {
            id: true, name: true, email: true, role: true, ativo: true, criadoEm: true,
            parceiro: { select: { id: true, nome: true } },
        },
    })
    return NextResponse.json(usuarios)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { nome, email, senha, role, parceiroId } = body

    if (!email || !senha || senha.length < 6)
        return NextResponse.json({ error: 'Email e senha (mín. 6 caracteres) são obrigatórios' }, { status: 400 })

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })

    const senhaHash = await bcrypt.hash(senha, 12)
    const usuario = await prisma.user.create({
        data: {
            name: nome || null,
            email,
            password: senhaHash,
            role: role === 'ADMIN' ? 'ADMIN' : 'PARTNER',
            parceiroId: role === 'PARTNER' && parceiroId ? parceiroId : null,
        },
        select: { id: true, name: true, email: true, role: true },
    })
    return NextResponse.json(usuario, { status: 201 })
}
