import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Admin user
  const hashedPassword = await bcrypt.hash('hauxhaux@admin2024', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@hauxhaux.com.br' },
    update: {},
    create: {
      email: 'admin@hauxhaux.com.br',
      name: 'Administrador',
      password: hashedPassword,
      role: 'ADMIN',
      ativo: true,
    },
  })

  console.log(`✅ Admin user: ${admin.email}`)

  // Categorias iniciais
  const cats = [
    { tipo: 'PRODUTO' as const, nome: 'Rapé' },
    { tipo: 'PRODUTO' as const, nome: 'Tabaco' },
    { tipo: 'PRODUTO' as const, nome: 'Incenso' },
    { tipo: 'INSUMO' as const, nome: 'Ervas' },
    { tipo: 'INSUMO' as const, nome: 'Minerais' },
    { tipo: 'INSUMO' as const, nome: 'Embalagens' },
  ]

  for (const cat of cats) {
    await prisma.categoria.upsert({
      where: { id: `seed-${cat.tipo}-${cat.nome}` },
      update: {},
      create: { id: `seed-${cat.tipo}-${cat.nome}`, ...cat },
    })
  }

  console.log('✅ Categorias iniciais criadas')
  console.log('\n🎉 Seed completo!')
  console.log('\nCredenciais de acesso:')
  console.log('  Email: admin@hauxhaux.com.br')
  console.log('  Senha: hauxhaux@admin2024')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
