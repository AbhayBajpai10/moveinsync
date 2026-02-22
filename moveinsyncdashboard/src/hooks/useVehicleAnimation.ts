// ============================================================
// hooks/useVehicleAnimation.ts
// ============================================================
import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useDashboardStore } from '../store/useStore';
import type { DashboardState } from '../store/useStore';
import {
    VehicleAnimationEngine,
    AnimatedVehicleState,
} from '../utils/vehicleAnimationEngine';
import type { Vehicle } from '../types/types';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
const WS_INTERVAL_MS = 1_000;

interface UseVehicleAnimationOptions {
    mapRef: React.MutableRefObject<mapboxgl.Map | null>;
    sourceId: string;
    onFrame?: (states: Map<string, AnimatedVehicleState>) => void;
}

export function useVehicleAnimation({
    mapRef,
    sourceId,
    onFrame,
}: UseVehicleAnimationOptions) {
    const engineRef = useRef<VehicleAnimationEngine | null>(null);
    const prevHashRef = useRef<string>('');

    // ── Build GeoJSON from animated states ────────────────────
    const buildGeoJSON = useCallback(
        (states: Map<string, AnimatedVehicleState>): GeoJSON.FeatureCollection => ({
            type: 'FeatureCollection',
            features: Array.from(states.values()).map((s) => ({
                type: 'Feature',
                properties: {
                    id: s.id,
                    heading: s.heading,
                    speed: s.speed,
                    isMoving: s.t < 1,
                },
                geometry: {
                    type: 'Point',
                    coordinates: [s.renderedLng, s.renderedLat],
                },
            })),
        }),
        []
    );

    // ── Push to Mapbox directly — zero React re-renders ───────
    const pushToMap = useCallback(
        (states: Map<string, AnimatedVehicleState>) => {
            const map = mapRef.current;
            if (!map?.isStyleLoaded()) return;
            const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
            if (!source) return;
            source.setData(buildGeoJSON(states));
            onFrame?.(states);
        },
        [mapRef, sourceId, buildGeoJSON, onFrame]
    );

    // ── Start engine once map is ready ────────────────────────
    useEffect(() => {
        let pollInterval: ReturnType<typeof setInterval> | null = null;

        const tryStart = (): boolean => {
            const map = mapRef.current;
            if (!map?.isStyleLoaded()) return false;
            if (engineRef.current) return true; // already started

            engineRef.current = new VehicleAnimationEngine(
                MAPBOX_TOKEN,
                WS_INTERVAL_MS,
                pushToMap
            );
            engineRef.current.start();

            // Seed existing vehicles immediately
            const vehicles = useDashboardStore.getState().vehicles;
            Object.values(vehicles).forEach((v: Vehicle) => {
                engineRef.current!.updateTarget(
                    v.id,
                    v.currentLocation.lng,
                    v.currentLocation.lat,
                    v.currentSpeed
                );
            });

            return true;
        };

        if (!tryStart()) {
            pollInterval = setInterval(() => {
                if (tryStart() && pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
            }, 100);
        }

        return () => {
            if (pollInterval) clearInterval(pollInterval);
            engineRef.current?.stop();
            engineRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pushToMap]);

    // ── Feed GPS fixes into engine via plain subscribe ────────
    // Zustand v5 removed the selector overload from subscribe().
    // Use plain subscribe and extract vehicles manually with getState().
    useEffect(() => {
        const unsubscribe = useDashboardStore.subscribe(
            (state: DashboardState) => {
                const engine = engineRef.current;
                if (!engine) return;

                const vehicles: Record<string, Vehicle> = state.vehicles;

                // Quick hash — skip if nothing changed
                const hash = Object.keys(vehicles).sort().join(',');
                if (hash === prevHashRef.current) return;
                prevHashRef.current = hash;

                Object.values(vehicles).forEach((vehicle: Vehicle) => {
                    engine.updateTarget(
                        vehicle.id,
                        vehicle.currentLocation.lng,
                        vehicle.currentLocation.lat,
                        vehicle.currentSpeed
                    );
                });
            }
        );

        return unsubscribe;
    }, []);

    return {
        // Typed getter — callers must null-check (engineRef may be null before map loads)
        getEngine: (): VehicleAnimationEngine | null => engineRef.current,
    };
}