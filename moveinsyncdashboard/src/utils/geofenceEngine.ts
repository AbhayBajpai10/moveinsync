// ============================================================
// utils/geofenceEngine.ts
// ============================================================
// SCALABLE GEOFENCE ENGINE
// Handles 500 office + 2,000 pickup geofences and 1,000+ vehicles
// without browser lag. Strategy: spatial indexing + LOD + tile culling.
// ============================================================

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PROBLEM: Naïve approach = O(V × G) per frame
 *   1,000 vehicles × 2,500 geofences = 2,500,000 distance checks/second
 *   At 60fps = 150,000,000 ops/sec → browser melts
 *
 * SOLUTION: Reduce to O(V × K) where K = nearby geofences per vehicle (≈ 5-20)
 * using a SPATIAL INDEX (R-tree / grid) so we only check geofences
 * that are actually near each vehicle.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Part 1: Spatial Grid Index ────────────────────────────────────────────────
// Divides the map into a grid of cells. Each cell stores only the geofences
// that overlap it. Lookup is O(1): find the cell → check ~5 geofences.

interface BoundingBox {
  minLng: number; maxLng: number;
  minLat: number; maxLat: number;
}

interface IndexedGeofence {
  id: string;
  name: string;
  type: 'office' | 'pickup';
  center: [number, number];   // [lng, lat]
  radiusDeg: number;          // radius in degrees (≈ km / 111)
  bbox: BoundingBox;
}

export class SpatialGridIndex {
  private cellSize: number;   // degrees per cell (e.g. 0.01 ≈ 1 km)
  private grid: Map<string, IndexedGeofence[]> = new Map();
  private allGeofences: IndexedGeofence[] = [];

  constructor(cellSizeDeg = 0.01) {
    this.cellSize = cellSizeDeg;
  }

  /** Convert coordinate to grid cell key */
  private cellKey(lng: number, lat: number): string {
    const col = Math.floor(lng / this.cellSize);
    const row = Math.floor(lat / this.cellSize);
    return `${col}:${row}`;
  }

  /** Bulk-insert geofences. Call once at startup. O(G) */
  insert(geofences: IndexedGeofence[]) {
    this.allGeofences = geofences;
    this.grid.clear();

    for (const gf of geofences) {
      // A single geofence may span multiple cells — insert into all of them
      const { minLng, maxLng, minLat, maxLat } = gf.bbox;
      const colMin = Math.floor(minLng / this.cellSize);
      const colMax = Math.floor(maxLng / this.cellSize);
      const rowMin = Math.floor(minLat / this.cellSize);
      const rowMax = Math.floor(maxLat / this.cellSize);

      for (let col = colMin; col <= colMax; col++) {
        for (let row = rowMin; row <= rowMax; row++) {
          const key = `${col}:${row}`;
          if (!this.grid.has(key)) this.grid.set(key, []);
          this.grid.get(key)!.push(gf);
        }
      }
    }
  }

  /** Query geofences near a point. O(1) average case */
  query(lng: number, lat: number): IndexedGeofence[] {
    const key = this.cellKey(lng, lat);
    return this.grid.get(key) ?? [];
  }

  /** Check which geofences a vehicle is inside. O(K) per vehicle */
  checkVehicle(lng: number, lat: number): IndexedGeofence[] {
    const candidates = this.query(lng, lat);
    return candidates.filter((gf) => {
      const dLng = lng - gf.center[0];
      const dLat = lat - gf.center[1];
      return Math.sqrt(dLng * dLng + dLat * dLat) <= gf.radiusDeg;
    });
  }
}

// ── Part 2: Batch vehicle check ───────────────────────────────────────────────
// Process all vehicles in one pass. Returns only changed states (entry/exit).

type GeofenceEventType = 'GEOFENCE_ENTRY' | 'GEOFENCE_EXIT';

interface GeofenceEvent {
  vehicleId: string;
  geofenceId: string;
  geofenceName: string;
  type: GeofenceEventType;
}

export class GeofenceEngine {
  private index: SpatialGridIndex;
  /** vehicleId → Set of currently-inside geofence ids */
  private insideState: Map<string, Set<string>> = new Map();

  constructor(cellSizeDeg = 0.01) {
    this.index = new SpatialGridIndex(cellSizeDeg);
  }

  loadGeofences(geofences: IndexedGeofence[]) {
    this.index.insert(geofences);
  }

  /**
   * Process all vehicles. Returns only the CHANGED events (entry/exit).
   * Fires entry once when a vehicle crosses in, exit once when it leaves.
   * No repeated events while a vehicle stays inside.
   */
  processVehicles(vehicles: { id: string; lng: number; lat: number }[]): GeofenceEvent[] {
    const events: GeofenceEvent[] = [];

    for (const v of vehicles) {
      const prevInside = this.insideState.get(v.id) ?? new Set<string>();
      const nowInside  = new Set(this.index.checkVehicle(v.lng, v.lat).map((g) => g.id));

      // Entry events — was outside, now inside
      for (const gfId of nowInside) {
        if (!prevInside.has(gfId)) {
          const gf = this.index.checkVehicle(v.lng, v.lat).find((g) => g.id === gfId);
          if (gf) events.push({ vehicleId: v.id, geofenceId: gfId, geofenceName: gf.name, type: 'GEOFENCE_ENTRY' });
        }
      }

      // Exit events — was inside, now outside
      for (const gfId of prevInside) {
        if (!nowInside.has(gfId)) {
          events.push({ vehicleId: v.id, geofenceId: gfId, geofenceName: gfId, type: 'GEOFENCE_EXIT' });
        }
      }

      this.insideState.set(v.id, nowInside);
    }

    return events;
  }
}

// ── Part 3: LOD (Level of Detail) for Mapbox rendering ───────────────────────
// Don't render all 2,500 geofences as individual DOM/GL elements.
// Use Mapbox's zoom-based filter expressions to control visibility.

/**
 * Returns a Mapbox filter expression that shows geofences based on zoom:
 *   zoom < 10  → show only office geofences (large, important)
 *   zoom 10-13 → show office + large pickup zones
 *   zoom > 13  → show everything (user is zoomed in, fewer visible anyway)
 *
 * This is pure GPU-side filtering — zero JS overhead.
 */
export const buildLODFilter = (zoomLevel: number) => {
  if (zoomLevel < 10) {
    return ['==', ['get', 'type'], 'office'];                    // only offices
  }
  if (zoomLevel < 13) {
    return ['any',
      ['==', ['get', 'type'], 'office'],
      ['>=', ['get', 'radiusMeters'], 500],                      // large pickup zones
    ];
  }
  return true;                                                   // show all
};

/**
 * Viewport culling — only keep geofences whose bbox intersects the map bounds.
 * Called on 'moveend' (not every frame) to filter which features to send to Mapbox.
 */
export const viewportCullGeofences = (
  geofences: IndexedGeofence[],
  bounds: { west: number; east: number; south: number; north: number }
): IndexedGeofence[] => {
  return geofences.filter((gf) =>
    gf.bbox.maxLng >= bounds.west &&
    gf.bbox.minLng <= bounds.east &&
    gf.bbox.maxLat >= bounds.south &&
    gf.bbox.minLat <= bounds.north
  );
};

// ── Part 4: Tile-based approach for 10,000+ geofences ────────────────────────
/**
 * For truly massive geofence counts (10k+), load geofences as Mapbox VECTOR TILES
 * from a tile server (tippecanoe + S3, PostGIS + pg_tileserv, or Mapbox Datasets).
 *
 * Replace the GeoJSON source with a vector tile source:
 *
 *   map.addSource('geofences', {
 *     type: 'vector',
 *     tiles: ['https://your-tileserver.com/geofences/{z}/{x}/{y}.pbf'],
 *     minzoom: 6,
 *     maxzoom: 14,
 *   });
 *
 * Benefits:
 *   - Tiles are streamed on demand — only tiles in the viewport are loaded
 *   - Mapbox renders them in WebGL — no JS parsing per feature
 *   - Zoom-based simplification is handled by the tile server
 *   - Scales to millions of features with no client-side changes
 *
 * Server-side geofence checking (for production):
 *   - Move the O(V × G) check to the backend using PostGIS ST_Within
 *   - Backend pushes events to frontend via WebSocket (already implemented)
 *   - Frontend is purely display — no geofence math in the browser
 */

export type { IndexedGeofence, GeofenceEvent };