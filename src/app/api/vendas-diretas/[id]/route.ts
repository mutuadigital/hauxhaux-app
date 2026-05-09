import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    // Also cancel related contas a receber
    await prisma.$transaction([
        prisma.contaReceber.updateMany({
            where: { vendaDiretaId: id },
            data: { status: 'CANCELADO' },
        }),
        prisma.vendaDireta.delete({ where: { id } }),
    ])

    return NextResponse.json({ ok: true })
}
