import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string },
                    include: { parceiro: true },
                })

                if (!user || !user.password) return null
                if (!user.ativo) return null

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                )
                if (!isValid) return null

                // Update last login
                await prisma.user.update({
                    where: { id: user.id },
                    data: { ultimoLoginEm: new Date() },
                })

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    parceiroId: user.parceiroId,
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as { role: string }).role
                token.parceiroId = (user as { parceiroId: string | null }).parceiroId
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub!
                const u = session.user as unknown as { role: string; parceiroId: string | null }
                u.role = token.role as string
                u.parceiroId = token.parceiroId as string | null
            }
            return session
        },
    },
    pages: {
        signIn: '/login',
        error: '/login',
    },
    session: { strategy: 'jwt' },
})
