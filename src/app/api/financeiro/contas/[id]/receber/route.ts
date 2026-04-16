import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { dataRecebimento, valorRecebido, formaRecebimento, observacoes } = body
    if (!dataRecebimento || !valorRecebido)
        return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })

    const recebimento = await prisma.$transaction(async (tx) => {
        const r = await tx.recebimento.create({
            data: {
                contaReceiverId: id,
                dataRecebimento: new Date(dataRecebimento),
                valorRecebido,
                formaRecebimento: formaRecebimento || null,
                observacoes: observacoes || null,
                registradoPor: session.user?.id ?? null,
            },
        })
        // Update account totals
        const conta = await tx.contaReceber.findUnique({ where: { id } })
        if (conta) {
            const novoRecebido = Number(conta.valorRecebido) + Number(valorRecebido)
            const novoSaldo = Number(conta.valorTotal) - novoRecebido
            await tx.contaReceber.update({
                where: { id },
                data: {
                    valorRecebido: novoRecebido,
                    saldoAberto: novoSaldo,
                    status: novoSaldo <= 0 ? 'RECEBIDO' : novoRecebido > 0 ? 'PARCIAL' : 'EM_ABERTO',
                },
            })
        }
        return r
    })

    return NextResponse.json(recebimento, { status: 201 })
}
