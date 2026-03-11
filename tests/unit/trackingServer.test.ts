import http from 'http';
import WebSocket from 'ws';
import { createTrackingServer, broadcast, getClientCount } from '../../src/ws/trackingServer';
import type { AgentLocationUpdate } from '../../src/types';

describe('WebSocket Tracking Server', () => {
  let httpServer: http.Server;
  let port: number;

  beforeEach((done) => {
    httpServer = http.createServer();
    createTrackingServer(httpServer);
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      done();
    });
  });

  afterEach((done) => {
    httpServer.close(done);
  });

  function connectClient(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws/tracking`);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  it('should accept client connections on /ws/tracking', async () => {
    const client = await connectClient();
    expect(client.readyState).toBe(WebSocket.OPEN);
    expect(getClientCount()).toBe(1);
    client.close();
  });

  it('should track multiple connected clients', async () => {
    const client1 = await connectClient();
    const client2 = await connectClient();
    expect(getClientCount()).toBe(2);
    client1.close();
    client2.close();
  });

  it('should broadcast AgentLocationUpdate to all connected clients', async () => {
    const client1 = await connectClient();
    const client2 = await connectClient();

    const update: AgentLocationUpdate = {
      agentId: 'agent-1',
      latitude: 18.5204,
      longitude: 73.8567,
      timestamp: new Date().toISOString(),
      speed: 25,
    };

    const msg1 = new Promise<string>((resolve) => {
      client1.on('message', (data) => resolve(data.toString()));
    });
    const msg2 = new Promise<string>((resolve) => {
      client2.on('message', (data) => resolve(data.toString()));
    });

    broadcast(update);

    const [received1, received2] = await Promise.all([msg1, msg2]);
    expect(JSON.parse(received1)).toEqual(update);
    expect(JSON.parse(received2)).toEqual(update);

    client1.close();
    client2.close();
  });

  it('should decrement client count on disconnect', async () => {
    const client = await connectClient();
    expect(getClientCount()).toBe(1);

    await new Promise<void>((resolve) => {
      client.on('close', () => {
        // ws library removes from clients set on close
        setTimeout(() => {
          expect(getClientCount()).toBe(0);
          resolve();
        }, 50);
      });
      client.close();
    });
  });

  it('should reject connections on wrong path', async () => {
    await expect(
      new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}/wrong/path`);
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
        ws.on('unexpected-response', () => reject(new Error('unexpected-response')));
      })
    ).rejects.toThrow();
  });

  it('should return 0 client count when no clients connected', () => {
    expect(getClientCount()).toBe(0);
  });

  it('should not throw when broadcasting with no clients', () => {
    const update: AgentLocationUpdate = {
      agentId: 'agent-1',
      latitude: 18.5204,
      longitude: 73.8567,
      timestamp: new Date().toISOString(),
      speed: 10,
    };
    expect(() => broadcast(update)).not.toThrow();
  });
});
