import { redirect } from 'next/navigation'

// Tela de Declarar Consumo removida do fluxo.
// Vendas registradas criam fechamento automático.
export default function ConsumoPage() {
    redirect('/portal/vendas')
}
