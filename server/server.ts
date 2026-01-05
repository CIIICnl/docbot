/**
 * Vibekit Server
 * Simple HTTP server with API and static file serving.
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { handleApi } from './routes/api/index.js';
import { serveStatic } from './routes/static.js';
import { loadEnv, getConfig } from './config/env.js';

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // CORS headers for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // API routes
    if (url.pathname.startsWith('/api/')) {
      await handleApi({ req, res, url });
      return;
    }

    // Static files
    await serveStatic({ req, res, url });
  } catch (error) {
    console.error('Request error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

async function start(): Promise<void> {
  // Load environment variables
  await loadEnv();

  const { port } = getConfig();
  const server = createServer(handleRequest);

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

start().catch(console.error);
