import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { AgentLocationUpdate } from '../types';

let wss: WebSocketServer | null = null;

/**
 * Creates a WebSocket server attached to the given HTTP server,
 * listening on the /ws/tracking path.
 */
export function createTrackingServer(httpServer: http.Server): WebSocketServer {
  wss = new WebSocketServer({ server: httpServer, path: '/ws/tracking' });

  wss.on('connection', (ws: WebSocket) => {
    console.log(`[WS] Client connected. Total clients: ${getClientCount()}`);

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
      ws.terminate();
    });

    ws.on('close', () => {
      console.log(`[WS] Client disconnected. Total clients: ${getClientCount()}`);
    });
  });

  console.log('[WS] Tracking WebSocket server created on /ws/tracking');
  return wss;
}

/**
 * Broadcasts an AgentLocationUpdate to all connected clients.
 */
export function broadcast(update: AgentLocationUpdate): void {
  if (!wss) return;

  const message = JSON.stringify(update);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message, (err) => {
        if (err) {
          console.error('[WS] Broadcast send error:', err.message);
        }
      });
    }
  }
}

/**
 * Returns the number of currently connected clients.
 */
export function getClientCount(): number {
  if (!wss) return 0;
  return wss.clients.size;
}
