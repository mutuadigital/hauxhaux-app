# HAUXHAUX — Sistema de Gestão

Sistema completo de gestão para a operação HAUXHAUX, cobrindo produção, estoque, consignação e financeiro.

## 🖥️ Stack Tecnológica

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **Next.js** | 15 (App Router) | Framework fullstack |
| **React** | 19 | Interface de usuário |
| **Prisma** | 6 | ORM para banco de dados |
| **PostgreSQL** | (Neon) | Banco de dados relacional |
| **NextAuth.js** | 4 | Autenticação |
| **TypeScript** | 5 | Linguagem principal |

## 📦 Módulos do Sistema

### Painel Administrativo (`/admin`)
- **Dashboard** — Visão geral com indicadores-chave
- **Produtos** — Cadastro de produtos acabados
- **Insumos** — Cadastro de matérias-primas
- **Categorias** — Classificação de produtos/insumos
- **Parceiros** — Gestão de parceiros de consignação
- **Compras** — Registro de aquisição de insumos
- **Produção** — Registro de lotes de fabricação
- **Estoque** — Visão consolidada de saldos
- **Vendas Diretas** — Vendas para clientes finais
- **Remessas** — Envio de produtos para parceiros
- **Devoluções** — Recebimento de produtos devolvidos
- **Fechamentos** — Apuração mensal de consignação
- **Contas a Receber** — Controle financeiro

### Portal do Parceiro (`/portal`)
- **Início** — Painel com estoque consignado e declarações
- **Registrar Venda** — Registro de vendas realizadas
- **Declarar Consumo** — Declaração mensal de consumo
- **Histórico** — Consulta de fechamentos e movimentações

## 🚀 Instalação e Deploy

### Pré-requisitos
- **Node.js** >= 20
- **PostgreSQL** (recomendado: [Neon](https://neon.tech))

### 1. Clonar e instalar dependências
```bash
git clone https://github.com/SEU_USUARIO/hauxhaux-app.git
cd hauxhaux-app
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env.local
# Edite .env.local com suas credenciais
```

**Variáveis obrigatórias:**
| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Connection string do PostgreSQL |
| `NEXTAUTH_SECRET` | Secret para JWT (gere com `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | URL pública do sistema (ex: `https://gestao.hauxhaux.com.br`) |

### 3. Configurar o banco de dados
```bash
# Aplicar o schema no banco
npx prisma db push

# Popular dados iniciais (admin + categorias)
npx prisma db seed
```

### 4. Rodar em desenvolvimento
```bash
npm run dev
```

### 5. Build para produção
```bash
npm run build
npm start
```

### 6. Deploy com PM2 (recomendado para VPS)
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Build e iniciar
npm run build
pm2 start npm --name "hauxhaux" -- start

# Habilitar auto-restart no boot
pm2 startup
pm2 save
```

## 🔐 Credenciais Padrão

Após executar o seed, use:
- **Email:** `admin@hauxhaux.com.br`
- **Senha:** `hauxhaux@admin2024`

> ⚠️ **Altere a senha do administrador em produção!**

## 🌐 Configuração de Domínio

O sistema está preparado para rodar em `https://gestao.hauxhaux.com.br`.

No servidor, configure:
1. **DNS:** Apontar `gestao.hauxhaux.com.br` para o IP do servidor
2. **SSL:** Configurar certificado HTTPS (recomendado: Let's Encrypt / Certbot)
3. **Reverse Proxy:** Nginx ou Apache apontando para `localhost:3000`
4. **Variável:** `NEXTAUTH_URL=https://gestao.hauxhaux.com.br` no `.env.local`

### Exemplo de configuração Nginx:
```nginx
server {
    listen 443 ssl;
    server_name gestao.hauxhaux.com.br;

    ssl_certificate /etc/letsencrypt/live/gestao.hauxhaux.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gestao.hauxhaux.com.br/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name gestao.hauxhaux.com.br;
    return 301 https://$host$request_uri;
}
```

## 📄 Licença

Projeto proprietário — HAUXHAUX © 2026. Todos os direitos reservados.
