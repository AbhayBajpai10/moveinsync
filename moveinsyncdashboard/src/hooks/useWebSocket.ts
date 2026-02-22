// ============================================================
// hooks/useWebSocket.ts  — Production-resilient WebSocket hook
// ============================================================
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useDashboardStore } from '../store/useStore';
import { WebSocketPayload, Vehicle, Alert, isCriticalAlert } from '../types/types';
import { toast } from 'sonner';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;   // cap at 30 s (not 5 s) for true backoff
const QUEUE_FLUSH_INTERVAL_MS = 500;
const STALE_THRESHOLD_MS = 4_000;
const STALE_DISCONNECT_MS = 10_000;

// ─────────────────────────────────────────────────────────────
// Fail-fast config check: surface misconfiguration immediately
// ─────────────────────────────────────────────────────────────
if (typeof window !== 'undefined' && !WS_URL) {
  console.error(
    '[useWebSocket] NEXT_PUBLIC_WS_URL is not set. ' +
    'Falling back to ws://localhost:8080 — this will fail in production.'
  );
}

export default function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  const [isConnected, setIsConnected] = useState(false);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  // Internal ref mirrors — avoid stale closures without extra re-renders
  const isSlowNetworkRef = useRef(false);
  const vehicleUpdateQueue = useRef<Vehicle[]>([]);

  // ── connect ───────────────────────────────────────────────
  const connect = useCallback(() => {
    // Prevent double-connecting
    if (
      ws.current?.readyState === WebSocket.OPEN ||
      ws.current?.readyState === WebSocket.CONNECTING
    )
      return;

    try {
      ws.current = new WebSocket(WS_URL);
    } catch (err) {
      // WebSocket constructor can throw synchronously for invalid URLs
      console.error('[useWebSocket] Failed to construct WebSocket:', err);
      setConnectionStatus('Invalid WebSocket URL — check NEXT_PUBLIC_WS_URL');
      return;
    }

    // ── onopen ──────────────────────────────────────────────
    ws.current.onopen = () => {
      reconnectAttempts.current = 0;
      setIsConnected(true);
      setIsSlowNetwork(false);
      isSlowNetworkRef.current = false;
      setConnectionStatus(null);
      // ✅ Register heartbeat on open so the stale-detection timer
      // has a valid baseline (Date.now) immediately — not 0 from store init
      useDashboardStore.getState().registerHeartBeat();
      useDashboardStore.getState().setStaleConnection(false);
      toast.success('Connected to live server', { id: 'network-status' });
    };

    // ── onmessage ───────────────────────────────────────────
    ws.current.onmessage = (event: MessageEvent) => {
      useDashboardStore.getState().registerHeartBeat();

      // Slow-network recovery
      if (isSlowNetworkRef.current) {
        isSlowNetworkRef.current = false;
        setIsSlowNetwork(false);
        toast.success('Network connection stabilised', { id: 'network-status' });
      }

      let payload: WebSocketPayload;
      try {
        payload = JSON.parse(event.data as string) as WebSocketPayload;
      } catch {
        console.warn('[useWebSocket] Received non-JSON message — ignoring.');
        return;
      }

      switch (payload.type) {
        case 'VEHICLE_UPDATE':
          // Validate shape before queuing
          if (payload.data && (payload.data as Vehicle).id) {
            vehicleUpdateQueue.current.push(payload.data as Vehicle);
          }
          break;

        case 'TRIP_ALERT':
        case 'GEOFENCE_EVENT': {
          const alertData = payload.data as Alert;

          // Guard against malformed server messages
          if (!alertData?.id || !alertData?.message) {
            console.warn('[useWebSocket] Malformed alert payload:', alertData);
            break;
          }

          useDashboardStore.getState().addAlert(alertData);

          // ✅ Fixed: was checking type?.includes('speed') which never matched
          //    'SPEED_VIOLATION'. Now uses the typed helper.
          const isCritical = isCriticalAlert(alertData.type);

          toast(alertData.message, {
            description: new Date(alertData.timestamp).toLocaleTimeString(),
            action: {
              label: 'Locate',
              onClick: () =>
                useDashboardStore
                  .getState()
                  .setSelectedTripId(alertData.vehicleId ?? null),
            },
            style: {
              background: isCritical ? '#7f1d1d' : '#1e3a8a',
              color: 'white',
              border: 'none',
            },
            duration: isCritical ? 8_000 : 4_000,
          });
          break;
        }

        default:
          console.warn('[useWebSocket] Unknown message type:', payload.type);
      }
    };

    // ── onclose ─────────────────────────────────────────────
    ws.current.onclose = (event: CloseEvent) => {
      setIsConnected(false);
      useDashboardStore.getState().setStaleConnection(true);

      // 1001 = Going Away — our server sends this for graceful shutdown
      if (event.code === 1001) {
        setConnectionStatus('Server offline: scheduled maintenance');
        toast.error('Server disconnected gracefully.', { id: 'network-status' });
        return; // ← do NOT reconnect
      }

      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        const attempt = reconnectAttempts.current + 1;
        setConnectionStatus(
          `Connection lost — reconnecting (${attempt}/${MAX_RECONNECT_ATTEMPTS})…`
        );

        if (reconnectAttempts.current === 0) {
          toast.error('Connection lost. Attempting to reconnect…', {
            id: 'network-status',
          });
        }

        const delay = Math.min(
          BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts.current),
          MAX_RECONNECT_DELAY_MS
        );

        if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = setTimeout(() => {
          reconnectAttempts.current = attempt;
          connect();
        }, delay);
      } else {
        setConnectionStatus('Connection failed — max retries reached. Refresh to retry.');
        toast.error('Could not connect to server. Please refresh the page.', {
          id: 'network-status',
          duration: 0, // persistent — user must act
        });
      }
    };

    // ── onerror ─────────────────────────────────────────────
    ws.current.onerror = (err) => {
      console.error('[useWebSocket] WebSocket error:', err);
      ws.current?.close(); // triggers onclose for reconnect logic
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mount / Unmount ───────────────────────────────────────
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      ws.current?.close(1000, 'Component unmounted');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Queue flusher — batched vehicle upserts ───────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (vehicleUpdateQueue.current.length === 0) return;

      // Keep only the latest update per vehicle id (deduplication)
      const latestById = new Map<string, Vehicle>();
      for (const v of vehicleUpdateQueue.current) latestById.set(v.id, v);
      vehicleUpdateQueue.current = [];

      const { updateVehicle } = useDashboardStore.getState();
      latestById.forEach(updateVehicle);
    }, QUEUE_FLUSH_INTERVAL_MS);

    return () => clearInterval(id);
  }, []);

  // ── Network degradation monitor ───────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const { lastHeartBeat, isStale, setStaleConnection } =
        useDashboardStore.getState();
      const age = Date.now() - lastHeartBeat;

      if (age > STALE_DISCONNECT_MS && !isStale) {
        setStaleConnection(true);
      }

      if (age > STALE_THRESHOLD_MS && age <= STALE_DISCONNECT_MS && !isStale) {
        if (!isSlowNetworkRef.current) {
          isSlowNetworkRef.current = true;
          setIsSlowNetwork(true);
          toast.warning('Slow network — data may be delayed.', {
            id: 'network-status',
          });
        }
      }
    }, 2_000);

    return () => clearInterval(id);
  }, []);

  // ── Periodic alert pruner (runs every 60 s) ───────────────
  useEffect(() => {
    const id = setInterval(
      () => useDashboardStore.getState().pruneOldAlerts(),
      60_000
    );
    return () => clearInterval(id);
  }, []);

  return { isConnected, isSlowNetwork, connectionStatus };
}