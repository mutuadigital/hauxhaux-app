import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { nome, nomeFantasia, documento, contatoPrincipal, telefone, email, endereco, cidade, estado, observacoes, percentualComissao, status } = body

    const record = await prisma.parceiro.update({
        where: { id },
        data: {
            ...(nome !== undefined && { nome }),
            ...(nomeFantasia !== undefined && { nomeFantasia }),
            ...(documento !== undefined && { documento }),
            ...(contatoPrincipal !== undefined && { contatoPrincipal }),
            ...(telefone !== undefined && { telefone }),
            ...(email !== undefined && { email }),
            ...(endereco !== undefined && { endereco }),
            ...(cidade !== undefined && { cidade }),
            ...(estado !== undefined && { estado }),
            ...(observacoes !== undefined && { observacoes }),
            ...(percentualComissao !== undefined && { percentualComissao: parseFloat(percentualComissao) || 0 }),
            ...(status !== undefined && { status }),
        },
    })
    return NextResponse.json(record)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    await prisma.parceiro.update({ where: { id }, data: { status: 'ENCERRADO' } })
    return NextResponse.json({ ok: true })
}
