// ============================================================
// __tests__/utils/geofenceEngine.test.ts
// Full coverage for SpatialGridIndex, GeofenceEngine helpers
// ============================================================
import {
  SpatialGridIndex,
  GeofenceEngine,
  viewportCullGeofences,
  buildLODFilter,
} from '../../utils/geofenceEngine';
import type { IndexedGeofence } from '../../utils/geofenceEngine';

// ── Fixtures ────────────────────────────────────────────────
const makeGeofence = (
  id: string,
  lng: number,
  lat: number,
  radiusDeg = 0.005,
  type: 'office' | 'pickup' = 'office'
): IndexedGeofence => ({
  id,
  name: `Geofence ${id}`,
  type,
  center: [lng, lat],
  radiusDeg,
  bbox: {
    minLng: lng - radiusDeg,
    maxLng: lng + radiusDeg,
    minLat: lat - radiusDeg,
    maxLat: lat + radiusDeg,
  },
});

const hqFence = makeGeofence('hq', 77.595, 12.970, 0.005, 'office');
const pickupA = makeGeofence('pickupA', 77.585, 12.965, 0.002, 'pickup');
const pickupB = makeGeofence('pickupB', 77.605, 12.975, 0.002, 'pickup');
const farFence = makeGeofence('far', 77.700, 13.100, 0.002, 'office');

// ────────────────────────────────────────────────────────────
// SpatialGridIndex
// ────────────────────────────────────────────────────────────
describe('SpatialGridIndex', () => {
  let index: SpatialGridIndex;

  beforeEach(() => {
    index = new SpatialGridIndex(0.01);
    index.insert([hqFence, pickupA, pickupB, farFence]);
  });

  it('should return geofences for a point inside their bbox', () => {
    // Point very close to HQ center
    const results = index.query(77.595, 12.970);
    expect(results.map((g) => g.id)).toContain('hq');
  });

  it('should return empty array for a point with no nearby geofences', () => {
    const results = index.query(0, 0); // middle of the ocean
    expect(results).toHaveLength(0);
  });

  it('checkVehicle should return geofence when vehicle is inside radius', () => {
    // Vehicle right at pickup A center
    const inside = index.checkVehicle(77.585, 12.965);
    expect(inside.map((g) => g.id)).toContain('pickupA');
  });

  it('checkVehicle should return empty when vehicle is outside all radii', () => {
    const outside = index.checkVehicle(77.100, 12.500); // far away
    expect(outside).toHaveLength(0);
  });

  it('checkVehicle should not return geofence when vehicle is just outside radius', () => {
    // pickupA radius is 0.002 — put vehicle 0.003 away
    const just_outside = index.checkVehicle(77.585 + 0.003, 12.965);
    const ids = just_outside.map((g) => g.id);
    expect(ids).not.toContain('pickupA');
  });

  it('checkVehicle can return multiple overlapping geofences', () => {
    // Place vehicle exactly at HQ center which may overlap with nearby fences
    const index2 = new SpatialGridIndex(0.1); // large cell to force overlap
    const bigFence1 = makeGeofence('big1', 77.595, 12.970, 0.05, 'office');
    const bigFence2 = makeGeofence('big2', 77.595, 12.970, 0.05, 'pickup');
    index2.insert([bigFence1, bigFence2]);
    const results = index2.checkVehicle(77.595, 12.970);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle empty geofence list', () => {
    const emptyIndex = new SpatialGridIndex(0.01);
    emptyIndex.insert([]);
    expect(emptyIndex.query(77.595, 12.970)).toHaveLength(0);
    expect(emptyIndex.checkVehicle(77.595, 12.970)).toHaveLength(0);
  });

  it('should handle geofences spanning multiple cells', () => {
    // Very large geofence spanning 4 cells
    const largeFence = makeGeofence('large', 77.595, 12.970, 0.015, 'office');
    const idx = new SpatialGridIndex(0.01);
    idx.insert([largeFence]);
    // Query from different corners — all should find the fence
    const r1 = idx.query(77.580, 12.960);
    const r2 = idx.query(77.610, 12.985);
    expect(r1.map((g) => g.id)).toContain('large');
    expect(r2.map((g) => g.id)).toContain('large');
  });

  it('should re-insert cleanly after a second insert call', () => {
    const idx = new SpatialGridIndex(0.01);
    idx.insert([hqFence]);
    idx.insert([pickupA, pickupB]); // second call replaces first
    const results = idx.checkVehicle(77.595, 12.970); // HQ center
    const ids = results.map((g) => g.id);
    expect(ids).not.toContain('hq'); // hq was replaced
  });
});

// ────────────────────────────────────────────────────────────
// GeofenceEngine (stateful entry/exit tracking)
// ────────────────────────────────────────────────────────────
describe('GeofenceEngine', () => {
  let engine: GeofenceEngine;

  beforeEach(() => {
    engine = new GeofenceEngine(0.01);
    engine.loadGeofences([hqFence, pickupA, pickupB]);
  });

  it('should fire GEOFENCE_ENTRY when vehicle enters a zone', () => {
    const events = engine.processVehicles([
      { id: 'v1', lng: 77.595, lat: 12.970 }, // inside HQ
    ]);
    expect(events.some((e) => e.type === 'GEOFENCE_ENTRY' && e.vehicleId === 'v1')).toBe(true);
  });

  it('should NOT fire GEOFENCE_ENTRY again while vehicle stays inside', () => {
    engine.processVehicles([{ id: 'v1', lng: 77.595, lat: 12.970 }]);
    const secondPass = engine.processVehicles([{ id: 'v1', lng: 77.595, lat: 12.970 }]);
    expect(secondPass.filter((e) => e.type === 'GEOFENCE_ENTRY')).toHaveLength(0);
  });

  it('should fire GEOFENCE_EXIT when vehicle leaves a zone', () => {
    engine.processVehicles([{ id: 'v1', lng: 77.595, lat: 12.970 }]); // enter
    const exitEvents = engine.processVehicles([{ id: 'v1', lng: 77.100, lat: 12.000 }]); // exit
    expect(exitEvents.some((e) => e.type === 'GEOFENCE_EXIT' && e.vehicleId === 'v1')).toBe(true);
  });

  it('should fire re-entry after leaving and coming back', () => {
    engine.processVehicles([{ id: 'v1', lng: 77.595, lat: 12.970 }]); // enter
    engine.processVehicles([{ id: 'v1', lng: 77.100, lat: 12.000 }]); // exit
    const reEntry = engine.processVehicles([{ id: 'v1', lng: 77.595, lat: 12.970 }]); // re-enter
    expect(reEntry.some((e) => e.type === 'GEOFENCE_ENTRY' && e.vehicleId === 'v1')).toBe(true);
  });

  it('should return no events for vehicles outside all geofences', () => {
    const events = engine.processVehicles([{ id: 'v1', lng: 0, lat: 0 }]);
    expect(events).toHaveLength(0);
  });

  it('should process multiple vehicles independently', () => {
    const events = engine.processVehicles([
      { id: 'v1', lng: 77.595, lat: 12.970 }, // inside HQ
      { id: 'v2', lng: 0, lat: 0 },            // outside
    ]);
    const v1Events = events.filter((e) => e.vehicleId === 'v1');
    const v2Events = events.filter((e) => e.vehicleId === 'v2');
    expect(v1Events.some((e) => e.type === 'GEOFENCE_ENTRY')).toBe(true);
    expect(v2Events).toHaveLength(0);
  });

  it('should include geofence name in GEOFENCE_ENTRY event', () => {
    const events = engine.processVehicles([{ id: 'v1', lng: 77.595, lat: 12.970 }]);
    const entry = events.find((e) => e.type === 'GEOFENCE_ENTRY' && e.geofenceId === 'hq');
    expect(entry?.geofenceName).toBeTruthy();
  });

  it('should handle empty vehicles array', () => {
    expect(() => engine.processVehicles([])).not.toThrow();
    expect(engine.processVehicles([])).toHaveLength(0);
  });

  it('should track state per vehicle independently across multiple calls', () => {
    // v1 enters HQ
    engine.processVehicles([{ id: 'v1', lng: 77.595, lat: 12.970 }]);
    // v2 has never been processed — now enters pickupA
    const events = engine.processVehicles([
      { id: 'v1', lng: 77.595, lat: 12.970 }, // still inside, no new event
      { id: 'v2', lng: 77.585, lat: 12.965 }, // entering pickupA for first time
    ]);
    const v1Entries = events.filter((e) => e.vehicleId === 'v1' && e.type === 'GEOFENCE_ENTRY');
    const v2Entries = events.filter((e) => e.vehicleId === 'v2' && e.type === 'GEOFENCE_ENTRY');
    expect(v1Entries).toHaveLength(0); // v1 was already inside
    expect(v2Entries.length).toBeGreaterThan(0); // v2 just entered
  });
});

// ────────────────────────────────────────────────────────────
// viewportCullGeofences
// ────────────────────────────────────────────────────────────
describe('viewportCullGeofences', () => {
  const geofences = [hqFence, pickupA, pickupB, farFence];

  it('should return only geofences that intersect the viewport', () => {
    const visible = viewportCullGeofences(geofences, {
      west: 77.57, east: 77.62, south: 12.95, north: 12.99,
    });
    const ids = visible.map((g) => g.id);
    expect(ids).toContain('hq');
    expect(ids).toContain('pickupA');
    expect(ids).toContain('pickupB');
    expect(ids).not.toContain('far');
  });

  it('should return empty when viewport has no geofences', () => {
    const visible = viewportCullGeofences(geofences, {
      west: 0, east: 1, south: 0, north: 1,
    });
    expect(visible).toHaveLength(0);
  });

  it('should include geofences partially overlapping the viewport boundary', () => {
    // hqFence center is at 77.595, bbox ~77.590–77.600
    // viewport starts at 77.598 — bbox still overlaps
    const visible = viewportCullGeofences([hqFence], {
      west: 77.598, east: 77.700, south: 12.960, north: 13.000,
    });
    expect(visible.map((g) => g.id)).toContain('hq');
  });

  it('should handle empty geofence list', () => {
    const visible = viewportCullGeofences([], {
      west: 77.57, east: 77.62, south: 12.95, north: 12.99,
    });
    expect(visible).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────
// buildLODFilter
// ────────────────────────────────────────────────────────────
describe('buildLODFilter', () => {
  it('should return office-only filter at zoom < 10', () => {
    const filter = buildLODFilter(9);
    // Should be a Mapbox filter expression, not just `true`
    expect(filter).not.toBe(true);
    expect(JSON.stringify(filter)).toContain('office');
  });

  it('should return combined filter at zoom 10–12', () => {
    const filter = buildLODFilter(11);
    expect(filter).not.toBe(true);
    // Filter at mid zoom should reference office and size threshold
    const filterStr = JSON.stringify(filter);
    expect(filterStr).toContain('office');
  });

  it('should return true (show all) at zoom >= 13', () => {
    expect(buildLODFilter(13)).toBe(true);
    expect(buildLODFilter(16)).toBe(true);
  });

  it('should return true at exactly zoom 13', () => {
    expect(buildLODFilter(13)).toBe(true);
  });

  it('should return non-true at exactly zoom 12', () => {
    expect(buildLODFilter(12)).not.toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// SCALABILITY BENCHMARKS
// Tests that the SpatialGridIndex + GeofenceEngine handles
// 500 office + 2,000 pickup geofences and 1,000 vehicles
// within practical time bounds.
// ────────────────────────────────────────────────────────────

/**
 * Generate a large set of IndexedGeofences spanning the Bengaluru area.
 * Uses a simple LCG PRNG with fixed seed for determinism.
 */
function makeLargeGeofenceSet(
  officeCount: number,
  pickupCount: number
): import('../../utils/geofenceEngine').IndexedGeofence[] {
  // Tiny seeded PRNG (LCG)
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 4294967296;
  };

  const BLR_LNG_MIN = 77.45, BLR_LNG_MAX = 77.75;
  const BLR_LAT_MIN = 12.85, BLR_LAT_MAX = 13.10;

  const geofences: import('../../utils/geofenceEngine').IndexedGeofence[] = [];

  for (let i = 0; i < officeCount; i++) {
    const lng = BLR_LNG_MIN + rand() * (BLR_LNG_MAX - BLR_LNG_MIN);
    const lat = BLR_LAT_MIN + rand() * (BLR_LAT_MAX - BLR_LAT_MIN);
    const r = 0.003 + rand() * 0.007; // 0.003–0.01 degrees (~300m–1km)
    geofences.push({
      id: `office-${i}`,
      name: `Office ${i}`,
      type: 'office' as const,
      center: [lng, lat],
      radiusDeg: r,
      bbox: { minLng: lng - r, maxLng: lng + r, minLat: lat - r, maxLat: lat + r },
    });
  }

  for (let i = 0; i < pickupCount; i++) {
    const lng = BLR_LNG_MIN + rand() * (BLR_LNG_MAX - BLR_LNG_MIN);
    const lat = BLR_LAT_MIN + rand() * (BLR_LAT_MAX - BLR_LAT_MIN);
    const r = 0.001 + rand() * 0.005;
    geofences.push({
      id: `pickup-${i}`,
      name: `Pickup ${i}`,
      type: 'pickup' as const,
      center: [lng, lat],
      radiusDeg: r,
      bbox: { minLng: lng - r, maxLng: lng + r, minLat: lat - r, maxLat: lat + r },
    });
  }

  return geofences;
}

describe('Scalability — 500 office + 2,000 pickup geofences', () => {
  const OFFICE_COUNT = 500;
  const PICKUP_COUNT = 2000;
  const TOTAL = OFFICE_COUNT + PICKUP_COUNT; // 2,500
  const VEHICLE_COUNT = 1000;

  const geofences = makeLargeGeofenceSet(OFFICE_COUNT, PICKUP_COUNT);

  // Fixed seed LCG for vehicles too
  let vseed = 99999;
  const vrand = () => {
    vseed = (vseed * 1664525 + 1013904223) & 0xffffffff;
    return (vseed >>> 0) / 4294967296;
  };
  const vehicles = Array.from({ length: VEHICLE_COUNT }, (_, i) => ({
    id: `v-${i}`,
    lng: 77.45 + vrand() * 0.30,
    lat: 12.85 + vrand() * 0.25,
  }));

  // ── Index build time ───────────────────────────────────────
  it(`builds index of ${TOTAL} geofences in < 50ms`, () => {
    const idx = new SpatialGridIndex(0.01);
    const t0 = performance.now();
    idx.insert(geofences);
    const elapsed = performance.now() - t0;
    console.log(`  [PERF] Index build (${TOTAL} geofences): ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(50);
  });

  // ── Single vehicle query ───────────────────────────────────
  it('single-vehicle checkVehicle() < 1ms with 2,500 geofences loaded', () => {
    const idx = new SpatialGridIndex(0.01);
    idx.insert(geofences);

    const t0 = performance.now();
    idx.checkVehicle(77.595, 12.970); // city center — likely near many fences
    const elapsed = performance.now() - t0;
    console.log(`  [PERF] Single vehicle check: ${elapsed.toFixed(4)}ms`);
    expect(elapsed).toBeLessThan(1);
  });

  // ── 1,000-vehicle batch check ──────────────────────────────
  it(`processVehicles(${VEHICLE_COUNT} vehicles, ${TOTAL} geofences) < 100ms`, () => {
    const engine = new GeofenceEngine(0.01);
    engine.loadGeofences(geofences);

    // Warm-up call to avoid JIT cold-start skewing the number
    engine.processVehicles(vehicles.slice(0, 10));

    const t0 = performance.now();
    const events = engine.processVehicles(vehicles);
    const elapsed = performance.now() - t0;
    console.log(`  [PERF] ${VEHICLE_COUNT} vehicles × ${TOTAL} geofences: ${elapsed.toFixed(2)}ms → ${events.length} events`);
    expect(elapsed).toBeLessThan(100);
  });

  // ── Viewport cull ──────────────────────────────────────────
  it(`viewportCullGeofences(${TOTAL} features) < 5ms`, () => {
    const viewport = { west: 77.55, east: 77.65, south: 12.90, north: 13.00 };
    const t0 = performance.now();
    const visible = viewportCullGeofences(geofences, viewport);
    const elapsed = performance.now() - t0;
    console.log(`  [PERF] Viewport cull (${TOTAL} geofences): ${elapsed.toFixed(2)}ms → ${visible.length} visible`);
    expect(elapsed).toBeLessThan(5);
    // Sanity: at least some features should be visible in this central viewport
    expect(visible.length).toBeGreaterThan(0);
  });

  // ── No repeated ENTRY events (idempotency) ─────────────────
  it('does not re-fire ENTRY events when vehicles stay inside geofences', () => {
    const engine = new GeofenceEngine(0.01);
    engine.loadGeofences(geofences);
    const firstPass = engine.processVehicles(vehicles);
    const secondPass = engine.processVehicles(vehicles); // same positions
    const entries2 = secondPass.filter((e) => e.type === 'GEOFENCE_ENTRY');
    // Second pass should have zero ENTRY events (vehicles didn't move)
    expect(entries2).toHaveLength(0);
    console.log(`  [INFO] First pass: ${firstPass.length} events; Second (same pos): ${secondPass.length} events`);
  });

  // ── EXIT events on departure ───────────────────────────────
  it('fires EXIT events when all vehicles move far away', () => {
    const engine = new GeofenceEngine(0.01);
    engine.loadGeofences(geofences);
    // First: put vehicles inside city
    engine.processVehicles(vehicles);
    // Second: move all vehicles to mid-ocean (outside every fence)
    const oceanVehicles = vehicles.map((v) => ({ ...v, lng: 0, lat: 0 }));
    const exitEvents = engine.processVehicles(oceanVehicles);
    const exits = exitEvents.filter((e) => e.type === 'GEOFENCE_EXIT');
    console.log(`  [INFO] EXIT events fired after moving to ocean: ${exits.length}`);
    // Some vehicles were inside fences and should now have exits
    expect(exits.length).toBeGreaterThan(0);
  });

  // ── LOD filter correctness at each zoom tier ───────────────
  it.each([
    [9, 'office-only,  filter ≠ true'],
    [11, 'mid-zoom,     filter ≠ true'],
    [13, 'high-zoom,    filter === true'],
    [16, 'max-zoom,     filter === true'],
  ] as [number, string][])(
    'buildLODFilter(zoom=%i) — %s',
    (zoom, _label) => {
      const filter = buildLODFilter(zoom);
      if (zoom >= 13) {
        expect(filter).toBe(true);
      } else {
        expect(filter).not.toBe(true);
        expect(JSON.stringify(filter)).toContain('office');
      }
    }
  );
});