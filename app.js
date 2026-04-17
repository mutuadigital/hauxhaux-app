// app.js - Entry point para Plesk / servidores Node.js
// Este arquivo inicia o servidor Next.js em modo de produção.
// O Plesk usa este arquivo como ponto de entrada da aplicação.

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Erro ao processar requisição:', req.url, err);
            res.statusCode = 500;
            res.end('Erro interno do servidor');
        }
    })
        .once('error', (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> HAUXHAUX rodando em http://${hostname}:${port}`);
        });
});
