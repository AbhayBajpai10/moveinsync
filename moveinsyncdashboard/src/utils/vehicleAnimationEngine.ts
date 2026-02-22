// ============================================================
// utils/vehicleAnimationEngine.ts
// FIXED: Zero-API Client-Side Interpolation
// Prevents Mapbox 429 Too Many Requests errors.
// ============================================================

export interface AnimatedVehicleState {
    id: string;
    renderedLng: number;
    renderedLat: number;
    targetLng: number;
    targetLat: number;
    fromLng: number;
    fromLat: number;
    t: number;
    heading: number;
    startedAt: number;
    speed: number;
    targetHeading: number;
}

// ── Math Helpers (Kept for smooth movement without API calls) ──
export function haversineMetres(lng1: number, lat1: number, lng2: number, lat2: number): number {
    const R = 6_371_000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearing(lng1: number, lat1: number, lng2: number, lat2: number): number {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function lerpAngle(a: number, b: number, t: number): number {
    let diff = ((b - a + 540) % 360) - 180;
    return (a + diff * t + 360) % 360;
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

// ── VehicleAnimationEngine (Zero-API Version) ──────────────────
export class VehicleAnimationEngine {
    private states = new Map<string, AnimatedVehicleState>();
    private wsIntervalMs: number;
    private onFrame: (states: Map<string, AnimatedVehicleState>) => void;
    private rafId: number | null = null;
    private running = false;

    constructor(
        mapboxToken: string, // Kept for MapContainer signature compatibility, but unused
        wsIntervalMs: number,
        onFrame: (states: Map<string, AnimatedVehicleState>) => void
    ) {
        this.wsIntervalMs = wsIntervalMs;
        this.onFrame = onFrame;
    }

    updateTarget(id: string, targetLng: number, targetLat: number, speedKmh: number): void {
        const now = performance.now();
        const existing = this.states.get(id);

        if (!existing) {
            this.states.set(id, {
                id, renderedLng: targetLng, renderedLat: targetLat,
                targetLng, targetLat, fromLng: targetLng, fromLat: targetLat,
                t: 1, heading: 0, targetHeading: 0, startedAt: now, speed: speedKmh,
            });
            return;
        }

        const dist = haversineMetres(existing.renderedLng, existing.renderedLat, targetLng, targetLat);
        if (dist < 1) return; // Ignore micro-jitter

        // Calculate new direction
        const newHeading = bearing(existing.renderedLng, existing.renderedLat, targetLng, targetLat);

        this.states.set(id, {
            ...existing,
            fromLng: existing.renderedLng, // Start from current visual position
            fromLat: existing.renderedLat,
            targetLng,
            targetLat,
            t: 0, // Reset progress
            startedAt: now,
            speed: speedKmh,
            targetHeading: newHeading
        });
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.tick();
    }

    stop(): void {
        this.running = false;
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    private tick = (): void => {
        if (!this.running) return;

        const now = performance.now();
        let anyMoving = false;

        this.states.forEach((state, id) => {
            if (state.t >= 1) return;

            anyMoving = true;
            const elapsed = now - state.startedAt;

            // Linear progress from 0 to 1 over the WebSocket interval (e.g., 1000ms)
            let t = Math.min(elapsed / this.wsIntervalMs, 1);

            // 🚀 FAST CLIENT-SIDE INTERPOLATION (0 API CALLS)
            // Moves the dot smoothly in a straight line between the two GPS pings
            const renderedLng = lerp(state.fromLng, state.targetLng, t);
            const renderedLat = lerp(state.fromLat, state.targetLat, t);

            // Smooth rotation for the marker
            const heading = lerpAngle(state.heading, state.targetHeading, Math.min(t * 3, 1));

            this.states.set(id, {
                ...state,
                renderedLng,
                renderedLat,
                heading,
                t
            });
        });

        // Only trigger React updates if vehicles are actually moving
        if (anyMoving) {
            this.onFrame(this.states);
        }

        this.rafId = requestAnimationFrame(this.tick);
    };

    getStates(): Map<string, AnimatedVehicleState> {
        return this.states;
    }
}