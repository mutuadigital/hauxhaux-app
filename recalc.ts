import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Recalculating stock...");

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
            declaracoesItens: { 
                include: { declaracao: true } 
            }
        }
    });

    for (const p of produtos) {
        let interno = 0;
        const consignado: Record<string, number> = {};

        // + Producoes
        for (const prod of p.producoes) {
            interno += Number(prod.quantidadeRealizada ?? prod.quantidadePrevista);
        }

        // - Vendas Diretas
        for (const vd of p.vendasDiretasItens) {
            // Se a VendaDireta fosse soft-delete (excluido: true), filtraríamos aqui.
            // Mas usamos hard-delete, então as que existem são válidas.
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

        // - DeclaracoesConsumo (se houver antigas validadas que não viraram fechamento)
        for (const dec of p.declaracoesItens) {
            if (dec.declaracao.status === 'VALIDADO' || dec.declaracao.status === 'INCORPORADO_NO_FECHAMENTO') {
                // Wait, if it was incorporated into Fechamento, the FechamentoItem already subtracted it!
                // So we ONLY subtract if it's VALIDADO but NOT INCORPORADO?
                if (dec.declaracao.status === 'VALIDADO') {
                    const pid = dec.declaracao.parceiroId;
                    consignado[pid] = (consignado[pid] || 0) - Number(dec.quantidade);
                }
            }
        }

        console.log(`Produto: ${p.nome} | Interno Novo: ${interno.toFixed(3)}`);
        
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
            console.log(`   -> Consignado [${parceiroId}]: ${qtd.toFixed(3)}`);
        }
        
        // Also find zeroed consignados that might not be in the dictionary
        // If a partner previously had consignado but now the computed is zero
        const existingConsignados = await prisma.estoqueConsignado.findMany({
            where: { produtoId: p.id }
        });
        for (const ec of existingConsignados) {
            if (consignado[ec.parceiroId] === undefined) {
                // Update to zero
                await prisma.estoqueConsignado.update({
                    where: { id: ec.id },
                    data: { quantidadeAtual: 0 }
                });
                console.log(`   -> Consignado [${ec.parceiroId}] reset to 0`);
            }
        }
    }

    console.log("Estoque de Produtos Reconciliado com Sucesso!");
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

