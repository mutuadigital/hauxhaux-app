import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET() {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const contas = await prisma.contaReceber.findMany({
        orderBy: { dataEmissao: 'desc' },
        include: {
            parceiro: { select: { nome: true } },
            recebimentos: true,
        },
        take: 200,
    })
    return NextResponse.json(contas)
}
