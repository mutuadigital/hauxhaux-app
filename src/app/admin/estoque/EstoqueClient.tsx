'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type EstoqueProdutoItem = {
    id: string
    quantidadeAtual: number
    produtoId: string
    produto: { nome: string; codigo: string | null; unidadeMedida: string; estoqueMinimo: number; ativo: boolean; precoPadrao: number }
}
type EstoqueInsumoItem = {
    id: string
    quantidadeAtual: number
    insumo: { nome: string; codigo: string | null; unidadeMedida: string; estoqueMinimo: number; ativo: boolean; custoMedio: number | null }
}
type EstoqueConsignadoItem = {
    id: string
    quantidadeAtual: number
    parceiroId: string
    produtoId: string
    produto: { nome: string; unidadeMedida: string; precoPadrao: number }
    parceiro: { nome: string; percentualComissao: number | null }
}

interface Props {
    produtos: EstoqueProdutoItem[]
    insumos: EstoqueInsumoItem[]
    consignado: EstoqueConsignadoItem[]
    parceiros: { id: string; nome: string }[]
    totalAlertas: number
}

export default function EstoqueClient({ produtos, insumos, consignado, parceiros, totalAlertas }: Props) {
    const [parcFiltro, setParcFiltro] = useState('todos')

    const consignadoFiltrado = useMemo(() =>
        parcFiltro === 'todos' ? consignado : consignado.filter(e => e.parceiroId === parcFiltro),
        [consignado, parcFiltro]
    )

    // Totals
    const totalProdutos = produtos.filter(e => e.quantidadeAtual > 0).length
    const totalInsumos = insumos.filter(e => e.quantidadeAtual > 0).length

    const valorProdutos = produtos.reduce((s, e) => s + e.quantidadeAtual * e.produto.precoPadrao, 0)
    const valorInsumos = insumos.reduce((s, e) => s + e.quantidadeAtual * (e.insumo.custoMedio ?? 0), 0)
    const valorConsignado = consignadoFiltrado.reduce((s, e) => s + e.quantidadeAtual * e.produto.precoPadrao, 0)
    const valorLiquidoConsignado = consignadoFiltrado.reduce((s, e) => {
        const comissao = e.parceiro.percentualComissao ?? 0
        return s + e.quantidadeAtual * e.produto.precoPadrao * (1 - comissao / 100)
    }, 0)

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Estoque</h1>
                    <p className="page-header-sub">Saldos de produtos, insumos e itens consignados</p>
                </div>
                <div className="page-actions">
                    <button 
                        className="btn btn-secondary" 
                        onClick={async () => {
                            if (!confirm('Deseja recalcular o estoque de todos os produtos com base no histórico de vendas e produções?')) return;
                            try {
                                const btn = document.getElementById('btn-recalc');
                                if (btn) btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Recalculando...';
                                const res = await fetch('/api/admin/recalc-estoque');
                                const data = await res.json();
                                if (data.ok) {
                                    alert('Estoque reconciliado com sucesso!');
                                    window.location.reload();
                                } else {
                                    alert('Erro: ' + data.error);
                                }
                            } catch (e: any) {
                                alert('Erro: ' + e.message);
                            } finally {
                                const btn = document.getElementById('btn-recalc');
                                if (btn) btn.innerHTML = '🔄 Reconciliar Estoque';
                            }
                        }}
                        id="btn-recalc"
                    >
                        🔄 Reconciliar Estoque
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-3" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="kpi-card">
                    <div className="kpi-label">Produtos com saldo</div>
                    <div className="kpi-value">{totalProdutos}</div>
                    <div className="kpi-sub">de {produtos.length} cadastrados</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Insumos com saldo</div>
                    <div className="kpi-value">{totalInsumos}</div>
                    <div className="kpi-sub">de {insumos.length} cadastrados</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Alertas críticos</div>
                    <div className="kpi-value" style={{ color: totalAlertas > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{totalAlertas}</div>
                    <div className="kpi-sub">itens abaixo do mínimo</div>
                </div>
            </div>

            <div className="grid grid-2" style={{ gap: 'var(--space-5)' }}>
                {/* Produtos Acabados */}
                <div className="card">
                    <div className="card-header"><h3 className="card-title">🧴 Produtos Acabados</h3></div>
                    <div className="table-wrapper">
                        {produtos.length === 0 ? <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-desc">Nenhum produto</div></div> : (
                            <table className="table">
                                <thead>
                                    <tr><th>Produto</th><th>Un.</th><th>Saldo</th><th>Mín.</th><th>Preço</th><th>Valor Total</th></tr>
                                </thead>
                                <tbody>
                                    {produtos.map((e) => {
                                        const baixo = e.quantidadeAtual <= e.produto.estoqueMinimo
                                        return (
                                            <tr key={e.id} style={baixo ? { background: 'rgba(158,58,47,0.04)' } : {}}>
                                                <td>
                                                    <Link href={`/admin/estoque/produto/${e.produtoId}`} style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                                                        {e.produto.nome}
                                                    </Link>
                                                    {e.produto.codigo && <div className="text-xs text-muted">{e.produto.codigo}</div>}
                                                </td>
                                                <td className="text-sm">{e.produto.unidadeMedida}</td>
                                                <td style={{ fontWeight: 700, color: baixo ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                                    {Number(e.quantidadeAtual).toFixed(0)}
                                                </td>
                                                <td className="text-sm text-muted">{Number(e.produto.estoqueMinimo).toFixed(0)}</td>
                                                <td className="text-sm">R$ {Number(e.produto.precoPadrao).toFixed(2)}</td>
                                                <td className="font-medium" style={{ color: 'var(--color-accent)' }}>
                                                    R$ {(e.quantidadeAtual * e.produto.precoPadrao).toFixed(2)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: 'rgba(197,160,89,0.07)', fontWeight: 700 }}>
                                        <td colSpan={5} style={{ textAlign: 'right', paddingRight: 'var(--space-3)' }}>Total</td>
                                        <td style={{ color: 'var(--color-accent)' }}>R$ {valorProdutos.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>

                {/* Insumos */}
                <div className="card">
                    <div className="card-header"><h3 className="card-title">🌿 Insumos</h3></div>
                    <div className="table-wrapper">
                        {insumos.length === 0 ? <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-desc">Nenhum insumo</div></div> : (
                            <table className="table">
                                <thead>
                                    <tr><th>Insumo</th><th>Un.</th><th>Saldo</th><th>Mín.</th><th>Custo Médio</th><th>Valor Total</th></tr>
                                </thead>
                                <tbody>
                                    {insumos.map((e) => {
                                        const baixo = e.quantidadeAtual <= e.insumo.estoqueMinimo
                                        const custo = e.insumo.custoMedio ?? 0
                                        return (
                                            <tr key={e.id} style={baixo ? { background: 'rgba(158,58,47,0.04)' } : {}}>
                                                <td>
                                                    <div className="font-medium">{e.insumo.nome}</div>
                                                    {e.insumo.codigo && <div className="text-xs text-muted">{e.insumo.codigo}</div>}
                                                </td>
                                                <td className="text-sm">{e.insumo.unidadeMedida}</td>
                                                <td style={{ fontWeight: 700, color: baixo ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                                    {Number(e.quantidadeAtual).toFixed(3)}
                                                </td>
                                                <td className="text-sm text-muted">{Number(e.insumo.estoqueMinimo).toFixed(3)}</td>
                                                <td className="text-sm">{custo > 0 ? `R$ ${custo.toFixed(4)}` : '—'}</td>
                                                <td className="font-medium" style={{ color: custo > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                                                    {custo > 0 ? `R$ ${(e.quantidadeAtual * custo).toFixed(2)}` : '—'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: 'rgba(197,160,89,0.07)', fontWeight: 700 }}>
                                        <td colSpan={5} style={{ textAlign: 'right', paddingRight: 'var(--space-3)' }}>Total</td>
                                        <td style={{ color: 'var(--color-accent)' }}>R$ {valorInsumos.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>

                {/* Consignado */}
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header">
                        <h3 className="card-title">📦 Estoque Consignado por Parceiro</h3>
                        <select
                            className="form-control"
                            style={{ width: 200 }}
                            value={parcFiltro}
                            onChange={e => setParcFiltro(e.target.value)}
                        >
                            <option value="todos">Todos os parceiros</option>
                            {parceiros.map(p => (
                                <option key={p.id} value={p.id}>{p.nome}</option>
                            ))}
                        </select>
                    </div>
                    <div className="table-wrapper">
                        {consignadoFiltrado.length === 0 ? (
                            <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-desc">Nenhum item consignado com saldo</div></div>
                        ) : (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Parceiro</th>
                                        <th>Produto</th>
                                        <th>Un.</th>
                                        <th>Qtd.</th>
                                        <th>Preço Venda</th>
                                        <th>Valor (bruto)</th>
                                        <th>Valor Líquido</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {consignadoFiltrado.map((e) => {
                                        const qtd = Number(e.quantidadeAtual)
                                        const preco = Number(e.produto.precoPadrao)
                                        const comissao = Number(e.parceiro.percentualComissao ?? 0)
                                        const valor = qtd * preco
                                        const liquido = valor * (1 - comissao / 100)
                                        return (
                                            <tr key={e.id}>
                                                <td className="font-medium">
                                                    <Link href={`/admin/parceiros/${e.parceiroId}`} style={{ color: 'var(--color-accent)' }}>
                                                        {e.parceiro.nome}
                                                    </Link>
                                                </td>
                                                <td>
                                                    <Link href={`/admin/estoque/produto/${e.produtoId}`} style={{ color: 'inherit' }}>
                                                        {e.produto.nome}
                                                    </Link>
                                                </td>
                                                <td className="text-sm">{e.produto.unidadeMedida}</td>
                                                <td style={{ fontWeight: 700, color: 'var(--color-info)' }}>{qtd.toFixed(0)}</td>
                                                <td className="text-sm">R$ {preco.toFixed(2)}</td>
                                                <td className="font-medium" style={{ color: 'var(--color-accent)' }}>R$ {valor.toFixed(2)}</td>
                                                <td className="text-sm text-muted">R$ {liquido.toFixed(2)}<span className="text-xs"> ({comissao}% com.)</span></td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: 'rgba(197,160,89,0.07)', fontWeight: 700 }}>
                                        <td colSpan={5} style={{ textAlign: 'right', paddingRight: 'var(--space-3)' }}>Total</td>
                                        <td style={{ color: 'var(--color-accent)' }}>R$ {valorConsignado.toFixed(2)}</td>
                                        <td style={{ color: 'var(--color-text-muted)' }}>R$ {valorLiquidoConsignado.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
