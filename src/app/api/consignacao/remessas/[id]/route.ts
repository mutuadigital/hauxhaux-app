import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { dataEnvio, observacoes } = body

    const updated = await prisma.remessaConsignacao.update({
        where: { id },
        data: {
            ...(dataEnvio && { dataEnvio: new Date(dataEnvio) }),
            ...(observacoes !== undefined && { observacoes: observacoes || null }),
        },
    })
    return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    // Load items to reverse stock changes
    const remessa = await prisma.remessaConsignacao.findUnique({
        where: { id },
        include: { itens: true },
    })
    if (!remessa) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (remessa.status === 'CONFIRMADA')
        return NextResponse.json({ error: 'N\u00e3o \u00e9 poss\u00edvel excluir uma remessa confirmada' }, { status: 400 })

    await prisma.remessaConsignacao.delete({ where: { id } })
    return NextResponse.json({ ok: true })
}
