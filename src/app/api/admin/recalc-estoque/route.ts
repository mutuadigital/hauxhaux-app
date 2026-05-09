import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const produtos = await prisma.produto.findMany({
            include: {
                producoes: { where: { status: { not: 'CANCELADA' } } },
                vendasDiretasItens: { include: { venda: true } },
                remessasItens: { include: { remessa: true } },
                devolucoesItens: { include: { devolucao: true } },
                fechamentosItens: { 
                    where: { excluido: false },
                    include: { fechamento: true }
                },
            }
        });

        let results = [];

        for (const p of produtos) {
            let interno = 0;
            const consignado: Record<string, number> = {};

            // + Producoes
            for (const prod of p.producoes) {
                interno += Number(prod.quantidadeRealizada ?? prod.quantidadePrevista);
            }

            // - Vendas Diretas
            for (const vd of p.vendasDiretasItens) {
                interno -= Number(vd.quantidade);
            }

            // - Remessas (+ Consignado)
            for (const r of p.remessasItens) {
                if (r.remessa.status !== 'CANCELADA') {
                    interno -= Number(r.quantidade);
                    const pid = r.remessa.parceiroId;
                    consignado[pid] = (consignado[pid] || 0) + Number(r.quantidade);
                }
            }

            // + Devolucoes (- Consignado)
            for (const d of p.devolucoesItens) {
                if (d.devolucao.status !== 'CANCELADA') {
                    interno += Number(d.quantidade);
                    const pid = d.devolucao.parceiroId;
                    consignado[pid] = (consignado[pid] || 0) - Number(d.quantidade);
                }
            }

            // - Fechamentos (Consumido pelo parceiro)
            for (const f of p.fechamentosItens) {
                const pid = f.fechamento.parceiroId;
                consignado[pid] = (consignado[pid] || 0) - Number(f.quantidadeConsumida);
            }

            // Update Internal
            await prisma.estoqueProduto.upsert({
                where: { produtoId: p.id },
                create: { produtoId: p.id, quantidadeAtual: interno },
                update: { quantidadeAtual: interno }
            });

            // Update Consignado
            for (const [parceiroId, qtd] of Object.entries(consignado)) {
                await prisma.estoqueConsignado.upsert({
                    where: { parceiroId_produtoId: { parceiroId, produtoId: p.id } },
                    create: { parceiroId, produtoId: p.id, quantidadeAtual: qtd },
                    update: { quantidadeAtual: qtd }
                });
            }
            
            // Fix zeroed consignados
            const existingConsignados = await prisma.estoqueConsignado.findMany({
                where: { produtoId: p.id }
            });
            for (const ec of existingConsignados) {
                if (consignado[ec.parceiroId] === undefined) {
                    await prisma.estoqueConsignado.update({
                        where: { id: ec.id },
                        data: { quantidadeAtual: 0 }
                    });
                }
            }

            results.push({ produto: p.nome, interno });
        }

        return NextResponse.json({ ok: true, message: 'Estoque recalculado com sucesso!', results })

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
