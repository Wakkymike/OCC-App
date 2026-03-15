import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env files in the same order Next.js does, BEFORE reading any env vars
dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: true });
dotenv.config({ path: resolve(process.cwd(), '.env') });

import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync, existsSync } from 'fs';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '9002', 10);

// TLS certificate paths (optional — omit for plain HTTP)
const tlsCert = process.env.TLS_CERT_PATH;  // e.g. /etc/letsencrypt/live/occ.example.com/fullchain.pem
const tlsKey = process.env.TLS_KEY_PATH;     // e.g. /etc/letsencrypt/live/occ.example.com/privkey.pem
const useHttps = !!(tlsCert && tlsKey);

console.log(`[config] PORT=${port}, HOSTNAME=${hostname}, TLS=${useHttps ? 'yes' : 'no'}`);
if (tlsCert || tlsKey) {
  console.log(`[config] TLS_CERT_PATH=${tlsCert || '(not set)'}`);
  console.log(`[config] TLS_KEY_PATH=${tlsKey || '(not set)'}`);
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const handler = (req: any, res: any) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  };

  let server;
  if (useHttps) {
    if (!existsSync(tlsCert!) || !existsSync(tlsKey!)) {
      console.error(`[TLS] Certificate files not found:\n  cert: ${tlsCert}\n  key:  ${tlsKey}`);
      process.exit(1);
    }
    server = createHttpsServer(
      {
        cert: readFileSync(tlsCert!),
        key: readFileSync(tlsKey!),
      },
      handler,
    );
    console.log('[TLS] HTTPS enabled');
  } else {
    server = createHttpServer(handler);
  }

  const io = new SocketIOServer(server, {
    cors: {
      origin: dev ? '*' : false,
      methods: ['GET', 'POST'],
    },
    path: '/api/ws',
  });

  // Store io globally so API routes can access it
  (global as any).__io = io;

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  server.listen(port, hostname, () => {
    const proto = useHttps ? 'https' : 'http';
    console.log(`> Ready on ${proto}://${hostname}:${port}`);
    console.log(`> Socket.io server running on /api/ws`);
  });
});
