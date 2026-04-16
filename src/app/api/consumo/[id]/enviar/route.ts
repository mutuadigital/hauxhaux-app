import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// Enviar declaração (change status RASCUNHO -> ENVIADO)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const record = await prisma.declaracaoConsumo.update({
        where: { id },
        data: { status: 'ENVIADO', enviadoEm: new Date(), enviadoPor: session.user?.id ?? null },
    })
    return NextResponse.json(record)
}
