'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { Stepper } from '@/components/Stepper'

type Parceiro = { id: string; nome: string }
type FechamentoItem = {
    id: string
    produtoId: string
    produto: { nome: string; unidadeMedida: string; precoPadrao: number }
    quantidadeConsumida: number
    valorUnitario: number
    valorTotal: number
    saldoInicial: number
}
type Fechamento = {
    id: string
    parceiro: { nome: string }
    competenciaMes: number
    competenciaAno: number
    status: string
    totalValor: number | null
    totalQuantidade: number | null
    dataFechamento?: string | null
    itens: FechamentoItem[]
    contasReceber: { id: string; status: string; valorTotal: number; saldoAberto: number }[]
}
type EstoqueConsignadoItem = {
    id: string
    quantidadeAtual: number
    valorVenda: number  // locked from remessa
    produto: { id: string; nome: string; unidadeMedida: string; precoPadrao: number }
}

// Row in the close modal
type FecharItem = {
    produtoId: string
    nomeProduto: string
    unidadeMedida: string
    saldoConsignado: number
    quantidadeConsumida: string
    valorVenda: number  // locked — read only
    incluir: boolean
}

const statusBadge: Record<string, string> = {
    ABERTO: 'badge-warning', FECHADO: 'badge-success', EM_VALIDACAO: 'badge-info', CANCELADO: 'badge-danger',
}
const meses = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const now = new Date()

export default function FechamentosPage() {
    const [fechamentos, setFechamentos] = useState<Fechamento[]>([])
    const [parceiros, setParceiros] = useState<Parceiro[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    // Create modal
    const [showCreate, setShowCreate] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ parceiroId: '', competenciaMes: now.getMonth() + 1, competenciaAno: now.getFullYear(), observacoes: '' })

    // Close modal
    const [showFechar, setShowFechar] = useState<Fechamento | null>(null)
    const [fecharItems, setFecharItems] = useState<FecharItem[]>([])
    const [fecharObs, setFecharObs] = useState('')
    const [fecharVenc, setFecharVenc] = useState('')
    const [loadingEstoque, setLoadingEstoque] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const [r1, r2] = await Promise.all([fetch('/api/fechamentos'), fetch('/api/parceiros')])
        setFechamentos(await r1.json())
        const ps = await r2.json()
        setParceiros(ps.filter((p: Parceiro & { status: string }) => p.status === 'ATIVO'))
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    async function createFechamento() {
        setSaving(true)
        const res = await fetch('/api/fechamentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        setSaving(false)
        if (!res.ok) { const e = await res.json(); alert(e.error || 'Erro ao criar fechamento'); return }
        setShowCreate(false)
        load()
    }

    async function openFechar(f: Fechamento) {
        setShowFechar(f)
        setFecharObs('')
        setFecharVenc('')
        setLoadingEstoque(true)
        setFecharItems([])

        // Load consigned stock for this partner
        const r = await fetch(`/api/fechamentos/${f.id}/estoque-consignado`)
        const estoque: EstoqueConsignadoItem[] = await r.json()
        setLoadingEstoque(false)

        // Pre-populate with all items that have stock, pre-filling values from existing itens if any
        setFecharItems(estoque.map(e => {
            const existingItem = f.itens.find(i => i.produtoId === e.produto.id)
            return {
                produtoId: e.produto.id,
                nomeProduto: e.produto.nome,
                unidadeMedida: e.produto.unidadeMedida,
                saldoConsignado: Math.floor(Number(e.quantidadeAtual)),
                quantidadeConsumida: existingItem ? String(Math.round(Number(existingItem.quantidadeConsumida))) : '',
                valorVenda: Number(e.valorVenda ?? e.produto.precoPadrao),
                incluir: Math.floor(Number(e.quantidadeAtual)) > 0,
            }
        }))
    }

    function updateFecharItem(idx: number, field: keyof FecharItem, value: string | boolean) {
        setFecharItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n })
    }

    const totalFechamento = fecharItems
        .filter(i => i.incluir && parseFloat(i.quantidadeConsumida) > 0)
        .reduce((s, i) => s + parseFloat(i.quantidadeConsumida || '0') * i.valorVenda, 0)

    async function confirmarFechamento() {
        if (!showFechar) return
        setSaving(true)
        const itens = fecharItems
            .filter(i => i.incluir && parseFloat(i.quantidadeConsumida) > 0)
            .map(i => ({
                produtoId: i.produtoId,
                quantidadeConsumida: parseFloat(i.quantidadeConsumida),
                valorUnitario: i.valorVenda,  // locked from remessa
            }))
        const res = await fetch(`/api/fechamentos/${showFechar.id}/fechar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itens, dataVencimento: fecharVenc || null, observacoes: fecharObs || null }),
        })
        setSaving(false)
        if (!res.ok) { const e = await res.json(); alert(e.error || 'Erro ao fechar'); return }
        setShowFechar(null)
        load()
    }

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Fechamentos Mensais</h1>
                    <p className="page-header-sub">Consolida as vendas do estoque consignado e gera a cobrança ao parceiro</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={() => { setForm({ parceiroId: '', competenciaMes: now.getMonth() + 1, competenciaAno: now.getFullYear(), observacoes: '' }); setShowCreate(true) }} id="btn-novo-fechamento">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Novo Fechamento
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    {loading ? <div className="loading-center"><div className="spinner" /></div> : fechamentos.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">📅</div><div className="empty-state-title">Nenhum fechamento</div><div className="empty-state-desc">Crie um fechamento mensal para consolidar as vendas consignadas de um parceiro.</div></div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: 28 }} />
                                    <th>Parceiro</th>
                                    <th>Competência</th>
                                    <th>Qtd. Vendida</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                    <th>Cobrança</th>
                                    <th style={{ width: 90 }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fechamentos.map((f) => {
                                    const conta = f.contasReceber[0]
                                    const expanded = expandedId === f.id
                                    return (
                                        <Fragment key={f.id}>
                                            <tr style={{ cursor: f.itens.length > 0 ? 'pointer' : 'default' }} onClick={() => f.itens.length > 0 && setExpandedId(expanded ? null : f.id)}>
                                                <td className="text-muted text-sm text-center">{f.itens.length > 0 ? (expanded ? '▲' : '▼') : ''}</td>
                                                <td className="font-medium">{f.parceiro.nome}</td>
                                                <td><span className="badge badge-neutral">{meses[f.competenciaMes]}/{f.competenciaAno}</span></td>
                                                <td className="text-sm">{f.totalQuantidade != null ? Number(f.totalQuantidade).toFixed(3) : '—'}</td>
                                                <td className="font-medium" style={{ color: 'var(--color-accent)' }}>
                                                    {f.totalValor != null ? `R$ ${Number(f.totalValor).toFixed(2)}` : '—'}
                                                </td>
                                                <td><span className={`badge ${statusBadge[f.status] ?? 'badge-neutral'}`}>{f.status}</span></td>
                                                <td>
                                                    {conta ? (
                                                        <span className={`badge ${conta.status === 'RECEBIDO' ? 'badge-success' : conta.status === 'PARCIAL' ? 'badge-warning' : 'badge-danger'}`}>
                                                            {conta.status.replace('_', ' ')} — R$ {Number(conta.saldoAberto).toFixed(2)}
                                                        </span>
                                                    ) : <span className="text-muted text-xs">—</span>}
                                                </td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    <div className="table-actions">
                                                        {f.status === 'ABERTO' && (
                                                            <button className="btn btn-sm btn-primary" onClick={() => openFechar(f)} id={`btn-fechar-${f.id}`}>
                                                                Fechar
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {expanded && f.itens.length > 0 && (
                                                <tr>
                                                    <td colSpan={8} style={{ padding: 0, background: 'rgba(0,0,0,0.02)' }}>
                                                        <table className="table" style={{ margin: 0 }}>
                                                            <thead>
                                                                <tr>
                                                                    <th style={{ paddingLeft: 48 }}>Produto</th>
                                                                    <th>Saldo Inicial</th>
                                                                    <th>Qtd. Vendida</th>
                                                                    <th>Saldo Final</th>
                                                                    <th>Vlr. Unit.</th>
                                                                    <th>Total</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {f.itens.map(item => (
                                                                    <tr key={item.id}>
                                                                        <td style={{ paddingLeft: 48 }} className="font-medium">
                                                                            {item.produto.nome}
                                                                            <span className="text-xs text-muted" style={{ marginLeft: 6 }}>({item.produto.unidadeMedida})</span>
                                                                        </td>
                                                                        <td className="text-sm">{Number(item.saldoInicial).toFixed(3)}</td>
                                                                        <td className="font-medium" style={{ color: 'var(--color-accent)' }}>{Number(item.quantidadeConsumida).toFixed(3)}</td>
                                                                        <td className="text-sm">{String(Number(Math.max(0, Number(item.saldoInicial) - Number(item.quantidadeConsumida))).toFixed(3))}</td>
                                                                        <td className="text-sm">R$ {Number(item.valorUnitario).toFixed(2)}</td>
                                                                        <td className="font-medium">R$ {Number(item.valorTotal).toFixed(2)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Create modal */}
            {showCreate && (
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
                    <div className="modal" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">Novo Fechamento</h2>
                            <button className="btn-icon" onClick={() => setShowCreate(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="alert alert-info" style={{ marginBottom: 'var(--space-5)' }}>
                                ℹ️ Crie um fechamento para a competência do parceiro. Ao fechar, você definirá as quantidades e valores exatos das vendas realizadas.
                            </div>
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label required">Parceiro</label>
                                    <select className="form-control" value={form.parceiroId} onChange={e => setForm(f => ({ ...f, parceiroId: e.target.value }))} autoFocus>
                                        <option value="">Selecionar parceiro…</option>
                                        {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Mês</label>
                                    <select className="form-control" value={form.competenciaMes} onChange={e => setForm(f => ({ ...f, competenciaMes: Number(e.target.value) }))}>
                                        {meses.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Ano</label>
                                    <input className="form-control" type="number" value={form.competenciaAno} onChange={e => setForm(f => ({ ...f, competenciaAno: Number(e.target.value) }))} min={2020} max={2030} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Observações</label>
                                    <textarea className="form-control" rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={createFechamento} disabled={saving || !form.parceiroId} id="btn-criar-fechamento">
                                {saving ? 'Criando...' : '📅 Criar Fechamento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Close modal — full item grid */}
            {showFechar && (
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !saving && setShowFechar(null)}>
                    <div className="modal modal-xl" role="dialog" style={{ maxWidth: 860 }}>
                        <div className="modal-header">
                            <div>
                                <h2 className="modal-title">Fechar Competência</h2>
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                                    {showFechar.parceiro.nome} — {meses[showFechar.competenciaMes]}/{showFechar.competenciaAno}
                                </p>
                            </div>
                            <button className="btn-icon" onClick={() => setShowFechar(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="alert alert-warning" style={{ marginBottom: 'var(--space-5)' }}>
                                ⚠️ Defina as quantidades vendidas e valores acordados. Ao confirmar, o estoque consignado será debitado e a cobrança gerada.
                            </div>

                            {loadingEstoque ? (
                                <div className="loading-center" style={{ padding: 'var(--space-8)' }}><div className="spinner" /></div>
                            ) : fecharItems.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                                    <div className="empty-state-icon">📦</div>
                                    <div className="empty-state-title">Nenhum produto consignado</div>
                                    <div className="empty-state-desc">Este parceiro não tem estoque consignado no momento.</div>
                                </div>
                            ) : (
                                <>
                                    {/* Header */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '24px 2fr 90px 90px 110px 100px', gap: 'var(--space-3)', alignItems: 'center', padding: '0 var(--space-1)', marginBottom: 'var(--space-2)' }}>
                                        <div />
                                        <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Produto</div>
                                        <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Saldo</div>
                                        <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Qtd. Vendida</div>
                                        <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Vlr. Unit. (R$)</div>
                                        <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', textAlign: 'right' }}>Subtotal</div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: 360, overflowY: 'auto' }}>
                                        {fecharItems.map((item, idx) => {
                                            // subtotal uses locked sale price from remessa
                                            const subtotal = parseFloat(item.quantidadeConsumida || '0') * item.valorVenda
                                            return (
                                                <div key={item.produtoId} style={{
                                                    display: 'grid', gridTemplateColumns: '24px 2fr 90px 90px 110px 100px', gap: 'var(--space-3)',
                                                    alignItems: 'center', padding: 'var(--space-2) var(--space-1)',
                                                    borderRadius: 'var(--radius)', background: item.incluir ? 'rgba(197,160,89,0.04)' : 'transparent',
                                                    opacity: item.incluir ? 1 : 0.4,
                                                }}>
                                                    <input type="checkbox" checked={item.incluir} onChange={e => updateFecharItem(idx, 'incluir', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                                                    <div>
                                                        <div className="font-medium" style={{ fontSize: 'var(--text-sm)' }}>{item.nomeProduto}</div>
                                                        <div className="text-xs text-muted">{item.unidadeMedida}</div>
                                                    </div>
                                                    <div className="text-sm" style={{ color: item.saldoConsignado <= 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }}>
                                                        {item.saldoConsignado}
                                                    </div>
                                                    <div style={{ margin: 0 }}>
                                                        <Stepper
                                                            value={parseInt(item.quantidadeConsumida) || 0}
                                                            onChange={v => updateFecharItem(idx, 'quantidadeConsumida', String(v))}
                                                            min={0}
                                                            max={item.saldoConsignado}
                                                            disabled={!item.incluir}
                                                        />
                                                    </div>
                                                    {/* Price locked from remessa */}
                                                    <div style={{ textAlign: 'right', fontSize: 'var(--text-sm)' }}>
                                                        <div style={{ fontWeight: 600 }}>R$ {item.valorVenda.toFixed(2)}</div>
                                                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>travado</div>
                                                    </div>
                                                    <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 'var(--text-sm)', color: item.incluir && parseFloat(item.quantidadeConsumida) > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                                                        {item.incluir && parseFloat(item.quantidadeConsumida) > 0 ? `R$ ${(parseFloat(item.quantidadeConsumida) * item.valorVenda).toFixed(2)}` : '—'}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Total bar */}
                                    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'rgba(197,160,89,0.08)', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(197,160,89,0.2)' }}>
                                        <span className="text-sm text-muted">
                                            {fecharItems.filter(i => i.incluir && parseFloat(i.quantidadeConsumida) > 0).length} produto(s) incluído(s)
                                        </span>
                                        <span style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--color-accent)' }}>
                                            Total: R$ {totalFechamento.toFixed(2)}
                                        </span>
                                    </div>
                                </>
                            )}

                            {/* Vencimento + obs */}
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)', marginTop: 'var(--space-5)' }}>
                                <div className="form-group">
                                    <label className="form-label">Vencimento da cobrança</label>
                                    <input className="form-control" type="date" value={fecharVenc} onChange={e => setFecharVenc(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Observações</label>
                                    <input className="form-control" value={fecharObs} onChange={e => setFecharObs(e.target.value)} placeholder="Opcional" />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowFechar(null)} disabled={saving}>Cancelar</button>
                            <button
                                className="btn btn-danger"
                                onClick={confirmarFechamento}
                                disabled={saving || totalFechamento <= 0 || fecharItems.length === 0}
                                id="btn-confirmar-fechar"
                            >
                                {saving ? 'Fechando...' : `🔒 Confirmar Fechamento — R$ ${totalFechamento.toFixed(2)}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
