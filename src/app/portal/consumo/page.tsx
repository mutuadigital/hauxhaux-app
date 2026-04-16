'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Stepper } from '@/components/Stepper'

type ProdutoConsignado = {
    id: string
    produto: { id: string; nome: string; unidadeMedida: string }
    quantidadeAtual: number
}

const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function PortalConsumoPage() {
    const { data: session } = useSession()
    const userSession = session?.user as { parceiroId?: string } | undefined

    const now = new Date()
    const [ano, setAno] = useState(now.getFullYear())
    const [mes, setMes] = useState(now.getMonth() + 1)
    const [estoque, setEstoque] = useState<ProdutoConsignado[]>([])
    const [consumo, setConsumo] = useState<Record<string, number>>({})
    const [obs, setObs] = useState('')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const loadEstoque = useCallback(async () => {
        if (!userSession?.parceiroId) return
        setLoading(true)
        const r = await fetch('/api/portal/estoque')
        if (r.ok) {
            const data = await r.json()
            setEstoque(data)
            // Initialize consumo map with zeros
            const map: Record<string, number> = {}
            data.forEach((e: ProdutoConsignado) => { map[e.produto.id] = 0 })
            setConsumo(map)
        }
        setLoading(false)
    }, [userSession?.parceiroId])

    useEffect(() => { loadEstoque() }, [loadEstoque])

    async function save(enviar = false) {
        setSaving(true)
        const itens = estoque
            .filter((e) => (consumo[e.produto.id] ?? 0) > 0)
            .map((e) => ({ produtoId: e.produto.id, quantidadeConsumida: consumo[e.produto.id] }))

        if (itens.length === 0) { setSaving(false); alert('Informe ao menos um consumo.'); return }

        const res = await fetch('/api/consumo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ competenciaAno: ano, competenciaMes: mes, itens, observacoes: obs }),
        })

        if (res.ok && enviar) {
            const data = await res.json()
            await fetch(`/api/consumo/${data.id}/enviar`, { method: 'POST' })
        }
        setSaving(false)
        setSaved(true)
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--color-primary)' }}>Declarar Consumo</h1>
                    <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>Informe os produtos consumidos no período selecionado</p>
                </div>
            </div>

            {saved && (
                <div className="alert alert-success" style={{ marginBottom: 'var(--space-5)' }}>
                    ✅ Declaração enviada com sucesso!
                </div>
            )}

            {/* Period selector */}
            <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                <div className="card-body">
                    <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Mês</label>
                            <select className="form-control" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                                {meses.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ano</label>
                            <input className="form-control" type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} min={2020} max={2030} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Consumption table */}
            <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                <div className="card-header">
                    <h3 className="card-title">Produtos em consignação</h3>
                </div>
                <div className="table-wrapper">
                    {loading ? (
                        <div className="loading-center"><div className="spinner" /></div>
                    ) : estoque.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📦</div>
                            <div className="empty-state-title">Sem estoque consignado</div>
                        </div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th>Saldo atual</th>
                                    <th>Consumido no mês</th>
                                </tr>
                            </thead>
                            <tbody>
                                {estoque.map((e) => (
                                    <tr key={e.id}>
                                        <td className="font-medium">{e.produto.nome}</td>
                                        <td className="text-sm" style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                                            {Number(e.quantidadeAtual).toFixed(3)} {e.produto.unidadeMedida}
                                        </td>
                                        <td style={{ width: 240 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                <Stepper
                                                    value={consumo[e.produto.id] ?? 0}
                                                    onChange={v => setConsumo(c => ({ ...c, [e.produto.id]: v } as Record<string, number>))}
                                                    min={0}
                                                    max={Math.floor(Number(e.quantidadeAtual))}
                                                />
                                                <span className="text-muted text-xs">{e.produto.unidadeMedida}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="card-footer">
                    <div className="form-group">
                        <label className="form-label">Observações (opcional)</label>
                        <textarea className="form-control" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Alguma observação sobre o consumo do mês..." />
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button className="btn btn-secondary" onClick={() => save(false)} disabled={saving || saved}>
                    Salvar rascunho
                </button>
                <button className="btn btn-primary" onClick={() => save(true)} disabled={saving || saved} id="btn-enviar-consumo">
                    {saving ? 'Enviando...' : '📤 Enviar declaração'}
                </button>
            </div>
        </div>
    )
}
