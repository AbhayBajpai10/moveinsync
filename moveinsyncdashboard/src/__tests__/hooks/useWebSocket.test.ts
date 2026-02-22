// ============================================================
// __tests__/hooks/useWebSocket.test.ts
// ============================================================
import { renderHook, act } from '@testing-library/react';
import { useDashboardStore } from '../../store/useStore';

// ── MockWebSocket ─────────────────────────────────────────────
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState: number = MockWebSocket.CONNECTING;
  url: string;
  onopen:    ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose:   ((e: CloseEvent) => void) | null = null;
  onerror:   ((e: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: object) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  simulateRawMessage(raw: string) {
    this.onmessage?.(new MessageEvent('message', { data: raw }));
  }

  simulateClose(code = 1006) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code }));
  }

  simulateGracefulClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code: 1001 }));
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }

  close = jest.fn((code?: number) => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code: code ?? 1000 }));
  });

  send = jest.fn();
}

// Patch global.WebSocket ONCE before all tests
// Do NOT use jest.resetModules() — it purges React from the module
// cache, making useRef call null.useRef → TypeError.
beforeAll(() => {
  (global as any).WebSocket = MockWebSocket;
});

const resetStore = () =>
  useDashboardStore.setState({
    vehicles:         {},
    trips:            {},
    alerts:           [],
    geoFences:        [],
    unreadAlertCount: 0,
    selectedTripId:   null,
    isStale:          false,
    // ✅ Fix: initialise to Date.now() NOT 0.
    // When lastHeartBeat = 0 and stale check runs, age = ~1.7 trillion ms
    // which is already >> STALE_DISCONNECT_MS (10 s), so the hook jumps
    // straight to "stale" and never enters the slow-network branch.
    lastHeartBeat: Date.now(),
  });

beforeEach(() => {
  MockWebSocket.instances = [];
  jest.useFakeTimers();
  resetStore();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
  // NO jest.resetModules() here — that's what caused the useRef null crash
});

// Import hook ONCE at module level (safe because beforeAll patches
// global.WebSocket before any module is evaluated by Jest)
import useWebSocket from '../../hooks/useWebSocket';

// ────────────────────────────────────────────────────────────
// Connection lifecycle
// ────────────────────────────────────────────────────────────
describe('useWebSocket – connection lifecycle', () => {
  it('should create a WebSocket connection on mount', () => {
    renderHook(() => useWebSocket());
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe('ws://localhost:8080');
  });

  it('should set isConnected to true on open', () => {
    const { result } = renderHook(() => useWebSocket());
    act(() => { MockWebSocket.instances[0].simulateOpen(); });
    expect(result.current.isConnected).toBe(true);
  });

  it('should call setStaleConnection(false) on open', () => {
    useDashboardStore.setState({ isStale: true });
    renderHook(() => useWebSocket());
    act(() => { MockWebSocket.instances[0].simulateOpen(); });
    expect(useDashboardStore.getState().isStale).toBe(false);
  });

  it('should clear connectionStatus on open', () => {
    const { result } = renderHook(() => useWebSocket());
    act(() => { MockWebSocket.instances[0].simulateOpen(); });
    expect(result.current.connectionStatus).toBeNull();
  });

  it('should close the WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];
    unmount();
    expect(ws.close).toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────
// Message handling
// ────────────────────────────────────────────────────────────
describe('useWebSocket – message handling', () => {
  const vehiclePayload = {
    type: 'VEHICLE_UPDATE',
    data: {
      id: 'v1', tripId: 't1', driverName: 'John', plateNumber: 'MH01AB1234',
      currentLocation: { lat: 18, lng: 73 }, currentSpeed: 60,
      status: 'in-progress', etaNextStop: 300,
    },
  };

  it('should call registerHeartBeat on every message', () => {
    renderHook(() => useWebSocket());
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[0].simulateMessage(vehiclePayload);
    });
    expect(useDashboardStore.getState().lastHeartBeat).toBeGreaterThan(0);
  });

  it('should queue VEHICLE_UPDATE and flush to store after 500ms', () => {
    renderHook(() => useWebSocket());
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[0].simulateMessage(vehiclePayload);
    });
    act(() => { jest.advanceTimersByTime(600); });
    expect(useDashboardStore.getState().vehicles['v1']).toMatchObject(vehiclePayload.data);
  });

  it('should deduplicate vehicles in the queue (keep latest)', () => {
    renderHook(() => useWebSocket());
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[0].simulateMessage(vehiclePayload);
      MockWebSocket.instances[0].simulateMessage({
        ...vehiclePayload,
        data: { ...vehiclePayload.data, currentSpeed: 99 },
      });
    });
    act(() => { jest.advanceTimersByTime(600); });
    expect(useDashboardStore.getState().vehicles['v1'].currentSpeed).toBe(99);
  });

  it('should call addAlert on TRIP_ALERT', () => {
    renderHook(() => useWebSocket());
    const alertData = { id: 'alert-1', message: 'Trip delayed', timestamp: Date.now(), type: 'maintenance', read: false };
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[0].simulateMessage({ type: 'TRIP_ALERT', data: alertData });
    });
    expect(useDashboardStore.getState().alerts[0]).toMatchObject(alertData);
  });

  it('should call addAlert on GEOFENCE_EVENT', () => {
    renderHook(() => useWebSocket());
    const alertData = { id: 'alert-2', message: 'Geofence breached', timestamp: Date.now(), type: 'geofence', read: false };
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[0].simulateMessage({ type: 'GEOFENCE_EVENT', data: alertData });
    });
    expect(useDashboardStore.getState().alerts[0]).toMatchObject(alertData);
  });

  it('should NOT throw on malformed (non-JSON) message', () => {
    expect(() => {
      renderHook(() => useWebSocket());
      act(() => {
        MockWebSocket.instances[0].simulateOpen();
        MockWebSocket.instances[0].simulateRawMessage('not valid json {{{}}}');
      });
    }).not.toThrow();
  });

  it('should ignore VEHICLE_UPDATE with missing id', () => {
    renderHook(() => useWebSocket());
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[0].simulateMessage({
        type: 'VEHICLE_UPDATE',
        data: { driverName: 'Ghost', currentLocation: { lat: 0, lng: 0 } },
      });
    });
    act(() => { jest.advanceTimersByTime(600); });
    expect(Object.keys(useDashboardStore.getState().vehicles)).toHaveLength(0);
  });

  it('should ignore malformed TRIP_ALERT missing id or message', () => {
    renderHook(() => useWebSocket());
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[0].simulateMessage({
        type: 'TRIP_ALERT',
        data: { timestamp: Date.now(), read: false },
      });
    });
    expect(useDashboardStore.getState().alerts).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────
// Error handling
// ────────────────────────────────────────────────────────────
describe('useWebSocket – error handling', () => {
  it('should call ws.close() when an error occurs', () => {
    // ✅ Fix: suppress the expected console.error from onerror handler
    // so it doesn't appear as test noise. This is EXPECTED behaviour —
    // the hook logs the error then closes the socket.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateOpen();
      ws.onclose = null; // detach to prevent cascade reconnect
      ws.simulateError();
    });

    expect(ws.close).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ────────────────────────────────────────────────────────────
// Reconnection logic
// ────────────────────────────────────────────────────────────
describe('useWebSocket – reconnection', () => {
  it('should attempt to reconnect after unexpected close', () => {
    renderHook(() => useWebSocket());
    act(() => { MockWebSocket.instances[0].simulateOpen(); });

    // Detach onclose BEFORE firing to stop the new WS from
    // immediately reconnecting and creating an instance cascade
    act(() => {
      const ws = MockWebSocket.instances[0];
      const savedOnClose = ws.onclose;
      ws.onclose = null;
      ws.readyState = MockWebSocket.CLOSED;
      savedOnClose?.(new CloseEvent('close', { code: 1006 }));
    });

    act(() => { jest.advanceTimersByTime(1100); });
    expect(MockWebSocket.instances.length).toBeGreaterThan(1);
  });

  it('should NOT reconnect after graceful shutdown (code 1001)', () => {
    const { result } = renderHook(() => useWebSocket());
    act(() => { MockWebSocket.instances[0].simulateOpen(); });
    act(() => { MockWebSocket.instances[0].simulateGracefulClose(); });
    act(() => { jest.advanceTimersByTime(5000); });
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(result.current.connectionStatus).toMatch(/maintenance|offline/i);
  });

  it('should show connectionStatus during reconnect attempts', () => {
    const { result } = renderHook(() => useWebSocket());
    act(() => { MockWebSocket.instances[0].simulateOpen(); });
    act(() => {
      const ws = MockWebSocket.instances[0];
      const saved = ws.onclose;
      ws.onclose = null;
      ws.readyState = MockWebSocket.CLOSED;
      saved?.(new CloseEvent('close', { code: 1006 }));
    });
    expect(result.current.connectionStatus).toMatch(/reconnect/i);
  });
});

// ────────────────────────────────────────────────────────────
// Stale connection detection
// ────────────────────────────────────────────────────────────
describe('useWebSocket – stale connection detection', () => {
  it('should mark connection as stale after 10 s of no heartbeat', () => {
    renderHook(() => useWebSocket());
    act(() => { MockWebSocket.instances[0].simulateOpen(); });

    // Advance time so that Date.now() inside the interval reads as stale.
    // We also need to advance lastHeartBeat's reference point.
    // simulateOpen calls registerHeartBeat implicitly through the hook's onopen.
    // So we advance past STALE_DISCONNECT_MS (10s) + one interval tick (2s).
    act(() => { jest.advanceTimersByTime(12_000); });
    expect(useDashboardStore.getState().isStale).toBe(true);
  });

  it('should NOT mark as stale when heartbeats are recent', () => {
    renderHook(() => useWebSocket());
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      // Send a fresh heartbeat — registers lastHeartBeat = Date.now()
      MockWebSocket.instances[0].simulateMessage({
        type: 'VEHICLE_UPDATE',
        data: {
          id: 'v1', tripId: 't1', driverName: 'Bob', plateNumber: 'TN01XX9999',
          currentLocation: { lat: 13, lng: 80 }, currentSpeed: 30, status: 'idle', etaNextStop: 0,
        },
      });
    });
    // Advance only 4s — well below 10s stale threshold
    act(() => { jest.advanceTimersByTime(4_000); });
    expect(useDashboardStore.getState().isStale).toBe(false);
  });

  it('should set isSlowNetwork after 4s–10s of no heartbeat', () => {
    const { result } = renderHook(() => useWebSocket());
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      // Register a fresh heartbeat so lastHeartBeat = now (not 0)
      MockWebSocket.instances[0].simulateMessage({
        type: 'VEHICLE_UPDATE',
        data: {
          id: 'v1', tripId: 't1', driverName: 'Bob', plateNumber: 'TN01',
          currentLocation: { lat: 13, lng: 80 }, currentSpeed: 30, status: 'idle', etaNextStop: 0,
        },
      });
    });

    // Advance past slow threshold (4s) but below stale threshold (10s)
    // The setInterval runs every 2s — need at least one tick past 4s
    act(() => { jest.advanceTimersByTime(6_000); });
    expect(result.current.isSlowNetwork).toBe(true);
  });

  it('should clear isSlowNetwork when a heartbeat arrives', () => {
    const { result } = renderHook(() => useWebSocket());
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[0].simulateMessage({
        type: 'VEHICLE_UPDATE',
        data: {
          id: 'v1', tripId: 't1', driverName: 'Bob', plateNumber: 'TN01',
          currentLocation: { lat: 13, lng: 80 }, currentSpeed: 30, status: 'idle', etaNextStop: 0,
        },
      });
    });

    // Enter slow network state
    act(() => { jest.advanceTimersByTime(6_000); });
    expect(result.current.isSlowNetwork).toBe(true);

    // Fresh message clears slow network flag immediately (synchronously in onmessage)
    act(() => {
      MockWebSocket.instances[0].simulateMessage({
        type: 'VEHICLE_UPDATE',
        data: {
          id: 'v1', tripId: 't1', driverName: 'Bob', plateNumber: 'TN01',
          currentLocation: { lat: 13, lng: 80 }, currentSpeed: 30, status: 'idle', etaNextStop: 0,
        },
      });
    });
    expect(result.current.isSlowNetwork).toBe(false);
  });
});