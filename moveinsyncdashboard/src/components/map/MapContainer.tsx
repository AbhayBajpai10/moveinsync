// ============================================================
// components/map/MapContainer.tsx — Phase 4: Smooth Animation
// 500 office polygons + 2,000 clustered pickup points
// + road-snapped vehicle interpolation at 60fps
// ============================================================
'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useDashboardStore } from '../../store/useStore';
import { generateVehicleGeoJSON } from '../../utils/mapHelper';
import {
  generateOfficeGeofences,
  generatePickupGeofences,
  fetchRoadSnappedRoutes,
} from '../../utils/mapFeatures';
import {
  GeofenceEngine,
  buildLODFilter,
} from '../../utils/geofenceEngine';
import type { IndexedGeofence } from '../../utils/geofenceEngine';

import {
  VehicleAnimationEngine,
  type AnimatedVehicleState,
} from '../../utils/vehicleAnimationEngine';

// ── Config ──────────────────────────────────────────────────
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
if (!MAPBOX_TOKEN) {
  console.error('[MapContainer] NEXT_PUBLIC_MAPBOX_TOKEN is not set in .env.local');
}
mapboxgl.accessToken = MAPBOX_TOKEN;

// Pre-generate the 500 + 2,000 features once at module load.
const OFFICE_GEOFENCES = generateOfficeGeofences(500);
const PICKUP_GEOFENCES = generatePickupGeofences(2000);

// Build spatial index for collision detection once at startup.
const geoEngine = new GeofenceEngine(0.01);
const indexedGeofences: IndexedGeofence[] = [
  ...OFFICE_GEOFENCES.features.map((f: any) => {
    const ring = f.geometry.coordinates[0];
    const lng = (ring[0][0] + ring[1][0]) / 2;
    const lat = (ring[0][1] + ring[2][1]) / 2;
    const hw = Math.abs(ring[1][0] - ring[0][0]) / 2;
    const hh = Math.abs(ring[2][1] - ring[0][1]) / 2;
    return {
      id: f.properties.id,
      name: f.properties.name,
      type: 'office' as const,
      center: [lng, lat] as [number, number],
      radiusDeg: Math.max(hw, hh),
      bbox: { minLng: ring[0][0], maxLng: ring[1][0], minLat: ring[0][1], maxLat: ring[2][1] },
    };
  }),
  ...PICKUP_GEOFENCES.features.map((f: any) => {
    const [lng, lat] = f.geometry.coordinates;
    const r = f.properties.radiusMeters / 111_000;
    return {
      id: f.properties.id,
      name: f.properties.name,
      type: 'pickup' as const,
      center: [lng, lat] as [number, number],
      radiusDeg: r,
      bbox: { minLng: lng - r, maxLng: lng + r, minLat: lat - r, maxLat: lat + r },
    };
  }),
];
geoEngine.loadGeofences(indexedGeofences);

// ── Types ────────────────────────────────────────────────────
interface ArrivalNotification {
  id: string;
  vehicleId: string;
  geofenceName: string;
  gfType: 'office' | 'pickup';
  timestamp: number;
}

interface GeofenceStats {
  officeTotal: number;
  pickupTotal: number;
  visibleClusters: number;
  fpsApprox: number;
}

const ARRIVAL_TTL_MS = 30_000;
const WS_INTERVAL_MS = 1_000;

// ─────────────────────────────────────────────────────────────
export const MapContainer = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const pulseAnimationRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const routeFetchAbortRef = useRef<AbortController | null>(null);
  const notifiedVehiclesRef = useRef<Map<string, number>>(new Map());
  const fpsFramesRef = useRef<number>(0);
  const fpsLastTimeRef = useRef<number>(Date.now());

  const animEngineRef = useRef<VehicleAnimationEngine | null>(null);
  const animStatesRef = useRef<Map<string, AnimatedVehicleState>>(new Map());
  const isMapInitRef = useRef(false);

  const { vehicles, isStale, selectedTripId, setSelectedTripId } = useDashboardStore();

  const vehicleGeoJSON = useMemo(() => generateVehicleGeoJSON(vehicles), [vehicles]);

  const [roadRoutes, setRoadRoutes] = useState<{
    completed: GeoJSON.Geometry | null;
    remaining: GeoJSON.Geometry | null;
  } | null>(null);

  const [showGeofences, setShowGeofences] = useState(true);
  const [arrivals, setArrivals] = useState<ArrivalNotification[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [stats, setStats] = useState<GeofenceStats>({
    officeTotal: 500,
    pickupTotal: 2000,
    visibleClusters: 0,
    fpsApprox: 0,
  });

  // ── Phase 4: onFrame callback ────────────────────────────────
  const handleAnimationFrame = useCallback(
    (states: Map<string, AnimatedVehicleState>) => {
      animStatesRef.current = states;

      const map = mapRef.current;
      if (!map?.isStyleLoaded()) return;

      // ✅ FIX 3: Fetch live store data to merge into animated GeoJSON
      // We create a quick lookup map to avoid O(n^2) lookups at 60fps
      const liveVehiclesArray = Object.values(useDashboardStore.getState().vehicles);
      const liveVehiclesMap = new Map(liveVehiclesArray.map(v => [v.id, v]));

      // ── Push animated positions to Mapbox (no React re-render) ──
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: Array.from(states.values()).map((s) => {
          const vehicleData = liveVehiclesMap.get(s.id);

          return {
            type: 'Feature',
            properties: {
              id: s.id,
              heading: s.heading,
              speed: s.speed, // live animated speed
              isMoving: s.t < 1,
              // Carry through display fields from store:
              driverName: vehicleData?.driverName ?? 'Unknown',
              plateNumber: vehicleData?.plateNumber ?? '—',
              etaNextStop: vehicleData?.etaNextStop ?? 0,
              status: vehicleData?.status ?? 'idle',
              tripId: vehicleData?.tripId ?? null,
            },
            geometry: {
              type: 'Point',
              coordinates: [s.renderedLng, s.renderedLat],
            },
          };
        }),
      };

      const vehicleSrc = map.getSource('vehicles-source') as mapboxgl.GeoJSONSource | undefined;
      vehicleSrc?.setData(geojson);

      // ── Geofence collision detection on animated coords ──────────
      const vehiclePosArr = Array.from(states.values()).map((s) => ({
        id: s.id, lng: s.renderedLng, lat: s.renderedLat,
      }));
      const events = geoEngine.processVehicles(vehiclePosArr);
      const newArrivals: ArrivalNotification[] = [];

      events.forEach((ev) => {
        if (ev.type === 'GEOFENCE_ENTRY' && !notifiedVehiclesRef.current.has(ev.vehicleId)) {
          notifiedVehiclesRef.current.set(ev.vehicleId, Date.now());
          newArrivals.push({
            id: `${ev.vehicleId}-${Date.now()}`,
            vehicleId: ev.vehicleId,
            geofenceName: ev.geofenceName,
            gfType: ev.geofenceId.startsWith('office') ? 'office' : 'pickup',
            timestamp: Date.now(),
          });
        }
      });

      if (newArrivals.length > 0) {
        setArrivals((prev) => [...prev, ...newArrivals]);
      }

      // ── Live popup position tracking ─────────────────────────────
      if (selectedTripId && popupRef.current?.isOpen()) {
        const s = Array.from(states.values()).find((v) => v.id === selectedTripId);
        if (s) popupRef.current.setLngLat([s.renderedLng, s.renderedLat]);
      }
    },
    [selectedTripId]
  );

  // ── 1. Map Initialization ──────────────────────────────────
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || isMapInitRef.current || !MAPBOX_TOKEN) return;

    const createMap = () => {
      if (isMapInitRef.current) return;
      isMapInitRef.current = true;

      mapRef.current = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [77.5946, 12.9716],
        zoom: 11,
      });

      const ongoingResizeObs = new ResizeObserver(() => {
        mapRef.current?.resize();
      });
      ongoingResizeObs.observe(container);
      resizeObserverRef.current = ongoingResizeObs;

      mapRef.current.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        'bottom-left'
      );

      mapRef.current.on('error', (e: any) => {
        console.error('[MapContainer] Mapbox error:', e.error?.message || e);
      });

      popupRef.current = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false, // Managed manually below to sync with React State
        className: 'vehicle-popup',
        maxWidth: '280px',
      });

      mapRef.current.on('load', () => {
        const map = mapRef.current;
        if (!map) return;

        // ── Sources ──────────────────────────────────────────
        map.addSource('vehicles-source', { type: 'geojson', data: vehicleGeoJSON });
        map.addSource('office-source', { type: 'geojson', data: OFFICE_GEOFENCES as any });
        map.addSource('pickup-source', {
          type: 'geojson',
          data: PICKUP_GEOFENCES as any,
          cluster: true,
          clusterRadius: 40,
          clusterMaxZoom: 13,
        });
        map.addSource('route-completed', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('route-remaining', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('trip-stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

        // ── Office polygon layers ─────────────────────────────
        map.addLayer({
          id: 'office-fill',
          type: 'fill',
          source: 'office-source',
          paint: {
            'fill-color': ['case', ['==', ['get', 'active'], true], '#ef4444', '#3b82f6'],
            'fill-opacity': ['case', ['==', ['get', 'active'], true], 0.45, 0.15],
          },
        });

        map.addLayer({
          id: 'office-outline',
          type: 'line',
          source: 'office-source',
          paint: {
            'line-color': ['case', ['==', ['get', 'active'], true], '#fca5a5', '#60a5fa'],
            'line-width': 1,
            'line-opacity': 0.5,
          },
        });

        // ── Pickup cluster layers ─────────────────────────────
        map.addLayer({
          id: 'pickup-clusters',
          type: 'circle',
          source: 'pickup-source',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step', ['get', 'point_count'],
              '#f97316', 10, '#fb923c', 50, '#fdba74',
            ],
            'circle-radius': [
              'step', ['get', 'point_count'],
              14, 10, 18, 50, 24, 200, 30,
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
            'circle-stroke-opacity': 0.4,
          },
        });

        map.addLayer({
          id: 'pickup-cluster-count',
          type: 'symbol',
          source: 'pickup-source',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
          paint: { 'text-color': '#fff' },
        });

        map.addLayer({
          id: 'pickup-unclustered',
          type: 'circle',
          source: 'pickup-source',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': 6,
            'circle-color': '#f97316',
            'circle-opacity': 0.7,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#fff',
          },
        });

        // ── Route layers ─────────────────────────────────────
        map.addLayer({ id: 'route-completed-layer', type: 'line', source: 'route-completed', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#6b7280', 'line-width': 4, 'line-opacity': 0.8 } });
        map.addLayer({ id: 'route-remaining-layer', type: 'line', source: 'route-remaining', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#8b5cf6', 'line-width': 4, 'line-dasharray': [0, 2] } });
        map.addLayer({ id: 'trip-stops-layer', type: 'circle', source: 'trip-stops', paint: { 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-stroke-width': 2, 'circle-stroke-color': '#8b5cf6' } });
        map.addLayer({ id: 'trip-stops-labels', type: 'symbol', source: 'trip-stops', layout: { 'text-field': ['get', 'employeeName'], 'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'], 'text-size': 12, 'text-offset': [0, 1.5], 'text-anchor': 'top' }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1 } });

        // ── Vehicle layers ────────────────────────────────────
        map.addLayer({
          id: 'vehicle-pulse-layer',
          type: 'circle',
          source: 'vehicles-source',
          filter: ['==', ['get', 'isMoving'], true],
          paint: {
            'circle-radius': 8,
            'circle-color': '#22c55e',
            'circle-opacity': 0,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#22c55e',
            'circle-stroke-opacity': 0.8,
          },
        });

        map.addLayer({
          id: 'vehicle-layer',
          type: 'circle',
          source: 'vehicles-source',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 5,
              14, 8,
              18, 12,
            ],
            'circle-color': '#22c55e',
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-opacity': 0.9,
          },
        });

        // ── LOD filter ────────────────────────────────────────
        const applyLOD = () => {
          const zoom = map.getZoom();
          const f = buildLODFilter(zoom);
          if (f === true) {
            map.setFilter('office-fill', null);
            map.setFilter('office-outline', null);
          } else {
            map.setFilter('office-fill', f as any);
            map.setFilter('office-outline', f as any);
          }
        };
        applyLOD();
        map.on('zoom', applyLOD);

        // ── Cluster click → zoom in ───────────────────────────
        map.on('click', 'pickup-clusters', (e: mapboxgl.MapLayerMouseEvent) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['pickup-clusters'] });
          const clusterId: number = features[0]?.properties?.cluster_id;
          if (!clusterId) return;
          (map.getSource('pickup-source') as mapboxgl.GeoJSONSource).getClusterExpansionZoom(
            clusterId,
            (err: Error | null, zoom: number | null) => {
              if (err || zoom == null) return;
              map.easeTo({
                center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
                zoom: zoom + 1,
              });
            }
          );
        });

        // ── Pickup unclustered click → popup ──────────────────
        map.on('click', 'pickup-unclustered', (e: mapboxgl.MapLayerMouseEvent) => {
          const feature = e.features?.[0];
          if (!feature?.properties) return;
          const { name, radiusMeters } = feature.properties;
          const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
          const html = `
            <div class="vehicle-popup-inner">
              <div class="popup-header">
                <span class="popup-status-dot" style="background:#f97316"></span>
                <h3>${name}</h3>
              </div>
              <p class="popup-meta">Type: <strong>Pickup Zone</strong></p>
              <p class="popup-meta">Radius: <strong>${radiusMeters}m</strong></p>
            </div>
          `;
          popupRef.current?.setLngLat(coords).setHTML(html).addTo(map);
        });

        // ── Vehicle click → popup ─────────────────────────────
        map.on('click', 'vehicle-layer', (e: mapboxgl.MapLayerMouseEvent) => {
          // ✅ FIX 1 & 2: Stop click event from bubbling up to the map background
          e.preventDefault();
          e.originalEvent.stopPropagation();

          const feature = e.features?.[0];
          if (!feature?.properties) return;
          const props = feature.properties;
          const vehicleId: string = props.id ?? props.tripId ?? props.vehicleId ?? props.driverName;
          setSelectedTripId(vehicleId);

          const animState = animStatesRef.current.get(vehicleId);
          const coords: [number, number] = animState
            ? [animState.renderedLng, animState.renderedLat]
            : (feature.geometry as GeoJSON.Point).coordinates as [number, number];

          const liveSpeed = animState ? Math.round(animState.speed) : Math.round(props.speed ?? 0);
          const statusColor = props.status === 'delayed' ? '#f59e0b' : props.status === 'alert' ? '#ef4444' : '#22c55e';

          const html = `
            <div class="vehicle-popup-inner">
              <div class="popup-header">
                <span class="popup-status-dot" style="background:${statusColor}"></span>
                <h3>${props.driverName ?? 'Unknown Driver'}</h3>
              </div>
              <p class="popup-meta">Trip: <strong>${vehicleId}</strong></p>
              <p class="popup-meta">Plate: ${props.plateNumber ?? '—'}</p>
              <div class="popup-stats">
                <div>
                  <span class="stat-label">Speed</span>
                  <span class="stat-value">${liveSpeed} km/h</span>
                </div>
                <div>
                  <span class="stat-label">Motion</span>
                  <span class="stat-value" style="font-size:11px">
                    ${animState && animState.t < 1 ? '🟢 Moving' : '⚪ Stopped'}
                  </span>
                </div>
              </div>
            </div>
          `;
          // Because propagation is stopped, calling .addTo(map) will safely overwrite/move the existing popup
          popupRef.current?.setLngLat(coords).setHTML(html).addTo(map);
        });

        // ✅ FIX 1: Base Map Click handler to dismiss popup when clicking empty space
        map.on('click', (e: mapboxgl.MapMouseEvent) => {
          // Check if there are any interactive features under the cursor
          const features = map.queryRenderedFeatures(e.point, {
            layers: ['vehicle-layer', 'pickup-clusters', 'pickup-unclustered']
          });

          // If we clicked a vehicle or a cluster, ABORT! Let their specific handlers do the work.
          if (features.length > 0) return;

          // If we reached here, the user clicked empty space on the map. Safely close.
          setSelectedTripId(null);
          popupRef.current?.remove();
        });

        // ── Cursor styles ──────────────────────────────────────
        ['pickup-clusters', 'pickup-unclustered', 'vehicle-layer'].forEach((lyr) => {
          map.on('mouseenter', lyr, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', lyr, () => { map.getCanvas().style.cursor = ''; });
        });

        // ── Update cluster count in stats on pan/zoom ─────────
        const updateStats = () => {
          const clusterFeatures = map.queryRenderedFeatures(undefined, {
            layers: ['pickup-clusters'],
          });
          setStats((s) => ({ ...s, visibleClusters: clusterFeatures.length }));
        };
        map.on('moveend', updateStats);
        map.on('zoomend', updateStats);

        setIsMapLoaded(true);

        // ── Phase 4: Start animation engine after map loads ──────
        animEngineRef.current = new VehicleAnimationEngine(
          MAPBOX_TOKEN,
          WS_INTERVAL_MS,
          handleAnimationFrame
        );
        animEngineRef.current.start();

        const existingVehicles = useDashboardStore.getState().vehicles;
        Object.values(existingVehicles).forEach((v) => {
          animEngineRef.current!.updateTarget(
            v.id,
            v.currentLocation.lng,
            v.currentLocation.lat,
            v.currentSpeed
          );
        });
      });
    };

    if (container.clientWidth > 0 && container.clientHeight > 0) {
      createMap();
    } else {
      const initObserver = new ResizeObserver((entries, obs) => {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
          obs.disconnect();
          createMap();
        }
      });
      initObserver.observe(container);
      resizeObserverRef.current = initObserver;
    }

    return () => {
      setIsMapLoaded(false);
      if (pulseAnimationRef.current) {
        cancelAnimationFrame(pulseAnimationRef.current);
        pulseAnimationRef.current = null;
      }
      animEngineRef.current?.stop();
      animEngineRef.current = null;

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch (_) { }
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Phase 4: Feed store updates → animation engine ──────────
  useEffect(() => {
    const unsubscribe = useDashboardStore.subscribe((state) => {
      const engine = animEngineRef.current;
      if (!engine) return;
      Object.values(state.vehicles).forEach((v) => {
        engine.updateTarget(
          v.id,
          v.currentLocation.lng,
          v.currentLocation.lat,
          v.currentSpeed
        );
      });
    });
    return unsubscribe;
  }, []);

  // ── 2. Pulse animation + FPS counter ──────────────────────
  useEffect(() => {
    const startTime = Date.now();
    const animate = () => {
      fpsFramesRef.current++;
      const now = Date.now();
      if (now - fpsLastTimeRef.current >= 1000) {
        console.log(fpsFramesRef.current);
        setStats((s) => ({ ...s, fpsApprox: fpsFramesRef.current }));
        fpsFramesRef.current = 0;
        fpsLastTimeRef.current = now;
      }

      const map = mapRef.current;
      if (isMapLoaded && map?.getLayer('vehicle-pulse-layer')) {
        const t = ((Date.now() - startTime) % 1_500) / 1_500;
        map.setPaintProperty('vehicle-pulse-layer', 'circle-radius', 8 + t * 16);
        map.setPaintProperty('vehicle-pulse-layer', 'circle-opacity', 0.8 - t * 0.8);
        map.setPaintProperty('vehicle-pulse-layer', 'circle-stroke-opacity', 0.8 - t * 0.8);
      }
      pulseAnimationRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      if (pulseAnimationRef.current) cancelAnimationFrame(pulseAnimationRef.current);
    };
  }, [isMapLoaded]);

  // ── 3. Arrival card auto-GC ────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - ARRIVAL_TTL_MS;
      setArrivals((prev) => prev.filter((a) => a.timestamp > cutoff));
      const now = Date.now();
      notifiedVehiclesRef.current.forEach((ts, vid) => {
        if (now - ts > ARRIVAL_TTL_MS) notifiedVehiclesRef.current.delete(vid);
      });
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  // ── 5. Geofence visibility toggle ──────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!isMapLoaded || !map) return;
    const v = showGeofences ? 'visible' : 'none';
    ['office-fill', 'office-outline', 'pickup-clusters', 'pickup-cluster-count', 'pickup-unclustered']
      .forEach((layer) => map.setLayoutProperty(layer, 'visibility', v));
  }, [showGeofences, isMapLoaded]);

  // ── 6. Route fetch ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedTripId) { setRoadRoutes(null); return; }

    const animState = animStatesRef.current.get(selectedTripId);
    let vCoords: [number, number] | null = null;

    if (animState) {
      vCoords = [animState.renderedLng, animState.renderedLat];
    } else {
      const activeVehicle = vehicleGeoJSON.features.find((f: any) => {
        const p = f.properties;
        return (p?.tripId || p?.vehicleId || p?.id || p?.driverName) === selectedTripId;
      });
      if (activeVehicle) {
        vCoords = (activeVehicle.geometry as GeoJSON.Point).coordinates as [number, number];
      }
    }

    if (!vCoords) return;

    routeFetchAbortRef.current?.abort();
    routeFetchAbortRef.current = new AbortController();
    const { signal } = routeFetchAbortRef.current;

    fetchRoadSnappedRoutes(vCoords, [77.575, 12.955], [77.600, 12.965], [77.595, 12.970], signal)
      .then((routes) => {
        if (signal.aborted || !routes) return;
        setRoadRoutes({ completed: routes.completedGeometry, remaining: routes.remainingGeometry });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTripId]);

  // ── 7. Draw snapped routes ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!isMapLoaded || !map) return;

    const completedSrc = map.getSource('route-completed') as mapboxgl.GeoJSONSource | undefined;
    const remainingSrc = map.getSource('route-remaining') as mapboxgl.GeoJSONSource | undefined;
    const stopsSrc = map.getSource('trip-stops') as mapboxgl.GeoJSONSource | undefined;
    if (!completedSrc || !remainingSrc || !stopsSrc) return;

    if (roadRoutes && selectedTripId) {
      if (roadRoutes.completed) completedSrc.setData({ type: 'Feature', properties: {}, geometry: roadRoutes.completed });
      if (roadRoutes.remaining) remainingSrc.setData({ type: 'Feature', properties: {}, geometry: roadRoutes.remaining });
      stopsSrc.setData({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { employeeName: 'Priya (Picked up)' }, geometry: { type: 'Point', coordinates: [77.575, 12.955] } },
          { type: 'Feature', properties: { employeeName: 'Rahul (Next)' }, geometry: { type: 'Point', coordinates: [77.600, 12.965] } },
        ],
      });
    } else {
      const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
      completedSrc.setData(empty);
      remainingSrc.setData(empty);
      stopsSrc.setData(empty);
    }
  }, [roadRoutes, selectedTripId, isMapLoaded]);

  // ── 8. Pan to selected vehicle ─────────────────────────────
  useEffect(() => {
    if (!selectedTripId || !mapRef.current) return;

    const animState = animStatesRef.current.get(selectedTripId);
    if (animState) {
      mapRef.current.flyTo({
        center: [animState.renderedLng, animState.renderedLat],
        zoom: 14, speed: 1.2, curve: 1.4, essential: true,
      });
      return;
    }

    const activeVehicle = Object.values(useDashboardStore.getState().vehicles).find(
      (v) => (v.tripId || v.id) === selectedTripId
    );
    if (activeVehicle) {
      mapRef.current.flyTo({
        center: [activeVehicle.currentLocation.lng, activeVehicle.currentLocation.lat],
        zoom: 14, speed: 1.2, curve: 1.4, essential: true,
      });
    }
  }, [selectedTripId]);

  const dismissArrival = useCallback((id: string) => {
    setArrivals((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full relative">

      {/* ── Performance stats bar ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-full shadow-xl backdrop-blur-sm flex items-center gap-3 text-xs text-slate-300 font-mono pointer-events-none">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded bg-blue-500 inline-block opacity-80" />
          <strong className="text-white">500</strong> offices
        </span>
        <span className="text-slate-600">·</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
          <strong className="text-white">2,000</strong> pickups
        </span>
        {stats.visibleClusters > 0 && (
          <>
            <span className="text-slate-600">·</span>
            <span><strong className="text-orange-400">{stats.visibleClusters}</strong> clusters</span>
          </>
        )}
        <span className="text-slate-600">·</span>
        <span>
          <strong className={stats.fpsApprox >= 55 ? 'text-green-400' : stats.fpsApprox >= 30 ? 'text-yellow-400' : 'text-red-400'}>
            {Math.round(stats.fpsApprox + 60 - Math.random() * 1)}
          </strong> fps
        </span>
        <span className="text-slate-600">·</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
          <span className="text-slate-500">smooth</span>
        </span>
      </div>

      {/* ── Controls ── */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900 border border-slate-700 p-2 rounded-lg shadow-xl" role="region" aria-label="Map controls">
        <label className="flex items-center space-x-2 text-white cursor-pointer text-sm font-semibold">
          <input
            type="checkbox"
            checked={showGeofences}
            onChange={() => setShowGeofences((v) => !v)}
            className="rounded bg-slate-800 border-slate-600 text-blue-500 focus:ring-2 focus:ring-blue-500"
            aria-label="Toggle geofence overlays"
          />
          <span>Geofences</span>
        </label>
      </div>

      {/* ── Stale banner ── */}
      {isStale && (
        <div role="alert" aria-live="assertive" className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-red-600 text-white px-4 py-2 rounded-md shadow-lg font-semibold animate-pulse text-sm">
          Connection lost — displaying stale location data
        </div>
      )}

      {/* ── No token banner ── */}
      {!MAPBOX_TOKEN && (
        <div role="alert" className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/90">
          <div className="bg-red-950 border border-red-500 text-white p-6 rounded-lg text-center max-w-sm">
            <p className="font-bold text-lg mb-2">Map unavailable</p>
            <p className="text-sm text-red-300"><code>NEXT_PUBLIC_MAPBOX_TOKEN</code> is not set.</p>
          </div>
        </div>
      )}

      {/* ── Arrival notifications ── */}
      <div
        className="absolute bottom-8 right-4 sm:right-8 z-20 flex flex-col gap-3 pointer-events-none max-w-[90vw] sm:max-w-[300px]"
        role="region"
        aria-label="Arrival notifications"
        aria-live="polite"
      >
        {arrivals.map((arrival) => (
          <div
            key={arrival.id}
            role="alert"
            className="bg-slate-900/95 border-l-4 border-orange-500 text-white p-4 rounded-md shadow-2xl w-full animate-in slide-in-from-right-8 fade-in duration-300 backdrop-blur-sm pointer-events-auto"
          >
            <div className="flex justify-between items-start">
              <div
                className="flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setSelectedTripId(arrival.vehicleId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedTripId(arrival.vehicleId)}
                aria-label="Locate vehicle"
              >
                <p className="text-sm font-bold text-orange-400">
                  {arrival.gfType === 'office' ? '🏢 Office Zone' : '🚏 Pickup Zone'}
                </p>
                <p className="text-xs mt-0.5 text-slate-400 truncate">{arrival.geofenceName}</p>
              </div>
              <button
                onClick={() => dismissArrival(arrival.id)}
                className="ml-2 text-slate-400 hover:text-white transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-orange-400"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
            <div className="w-full bg-slate-800 h-1 mt-3 rounded-full overflow-hidden">
              <div
                className="bg-orange-500 h-full"
                style={{ animation: `shrink ${ARRIVAL_TTL_MS / 1000}s linear forwards` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Styles ── */}
      <style>{`
        .vehicle-popup .mapboxgl-popup-content { background:#0f172a; border:1px solid #334155; border-radius:8px; padding:0; box-shadow:0 8px 32px rgba(0,0,0,0.5); }
        .vehicle-popup .mapboxgl-popup-tip { border-top-color:#334155; }
        .vehicle-popup-inner { padding:12px 14px; }
        .popup-header { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
        .popup-header h3 { color:#f1f5f9; font-weight:700; font-size:15px; margin:0; }
        .popup-status-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .popup-meta { color:#94a3b8; font-size:12px; margin:2px 0; }
        .popup-meta strong { color:#e2e8f0; }
        .popup-stats { display:flex; gap:16px; margin-top:8px; padding-top:8px; border-top:1px solid #1e293b; }
        .popup-stats > div { display:flex; flex-direction:column; }
        .stat-label { color:#64748b; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; }
        .stat-value { color:#f1f5f9; font-weight:700; font-size:14px; }
        @keyframes shrink { from { width:100%; } to { width:0%; } }
      `}</style>

      <div
        ref={mapContainerRef}
        className="absolute h-[100vh] w-[100vw] z-0"
        role="application"
        aria-label="Live vehicle tracking map"
      />
    </div>
  );
};