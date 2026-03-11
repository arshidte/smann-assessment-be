import {
  tick,
  stop,
  start,
  getState,
  reset,
  PUNE_ROUTE,
} from '../../src/services/agentSimulator';
import { AgentLocationUpdate } from '../../src/types';

beforeEach(() => {
  reset();
});

afterEach(() => {
  stop();
});

describe('PUNE_ROUTE', () => {
  it('should have at least 20 waypoints', () => {
    expect(PUNE_ROUTE.length).toBeGreaterThanOrEqual(20);
  });

  it('should contain valid lat/lng coordinates in Pune area', () => {
    for (const point of PUNE_ROUTE) {
      // Pune is roughly lat 18.4–18.7, lng 73.7–74.0
      expect(point.lat).toBeGreaterThanOrEqual(18.4);
      expect(point.lat).toBeLessThanOrEqual(18.7);
      expect(point.lng).toBeGreaterThanOrEqual(73.7);
      expect(point.lng).toBeLessThanOrEqual(74.0);
    }
  });
});

describe('tick()', () => {
  it('should return a valid AgentLocationUpdate on first tick', () => {
    const update = tick();

    expect(update.agentId).toBe('agent-001');
    expect(update.latitude).toBe(PUNE_ROUTE[0].lat);
    expect(update.longitude).toBe(PUNE_ROUTE[0].lng);
    expect(update.speed).toBeGreaterThan(0);
    expect(update.speed).toBeLessThanOrEqual(60);
    // Validate ISO 8601 timestamp
    expect(new Date(update.timestamp).toISOString()).toBe(update.timestamp);
  });

  it('should advance through the route on successive ticks', () => {
    const first = tick();
    const second = tick();

    expect(first.latitude).toBe(PUNE_ROUTE[0].lat);
    expect(second.latitude).toBe(PUNE_ROUTE[1].lat);
    expect(second.longitude).toBe(PUNE_ROUTE[1].lng);
  });

  it('should loop back to start when route ends', () => {
    // Tick through the entire route
    for (let i = 0; i < PUNE_ROUTE.length; i++) {
      tick();
    }
    // Next tick should be back at index 0
    const looped = tick();
    expect(looped.latitude).toBe(PUNE_ROUTE[0].lat);
    expect(looped.longitude).toBe(PUNE_ROUTE[0].lng);
  });

  it('should vary speed between walking and driving', () => {
    const speeds = new Set<number>();
    for (let i = 0; i < PUNE_ROUTE.length; i++) {
      speeds.add(tick().speed);
    }
    // Should have both walking (~5) and driving (~28-40) speeds
    const hasWalking = [...speeds].some((s) => s <= 10);
    const hasDriving = [...speeds].some((s) => s >= 25);
    expect(hasWalking).toBe(true);
    expect(hasDriving).toBe(true);
  });

  it('should produce valid ISO 8601 timestamps', () => {
    const update = tick();
    const parsed = new Date(update.timestamp);
    expect(parsed.getTime()).not.toBeNaN();
    expect(update.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('start() and stop()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call the callback at regular intervals', () => {
    const updates: AgentLocationUpdate[] = [];

    start((update) => {
      updates.push(update);
    });

    jest.advanceTimersByTime(2000);
    expect(updates.length).toBe(1);
    expect(updates[0].latitude).toBe(PUNE_ROUTE[0].lat);

    jest.advanceTimersByTime(2000);
    expect(updates.length).toBe(2);
    expect(updates[1].latitude).toBe(PUNE_ROUTE[1].lat);

    stop();
  });

  it('should not start multiple intervals if called twice', () => {
    const updates: AgentLocationUpdate[] = [];

    start((update) => {
      updates.push(update);
    });
    // Call start again — should be a no-op
    start((update) => {
      updates.push(update);
    });

    jest.advanceTimersByTime(4500);
    stop();
    // Should have 2 updates in 4.5s (2s interval), not doubled
    expect(updates.length).toBe(2);
  });
});

describe('getState()', () => {
  it('should return initial state before any ticks', () => {
    const state = getState();
    expect(state.agentId).toBe('agent-001');
    expect(state.currentIndex).toBe(0);
    expect(state.intervalMs).toBe(2000);
    expect(state.routeWaypoints).toBe(PUNE_ROUTE);
  });

  it('should reflect current index after ticks', () => {
    tick();
    tick();
    tick();
    const state = getState();
    expect(state.currentIndex).toBe(3);
  });
});

describe('reset()', () => {
  it('should reset tick count to 0', () => {
    tick();
    tick();
    reset();
    const state = getState();
    expect(state.currentIndex).toBe(0);
  });
});
