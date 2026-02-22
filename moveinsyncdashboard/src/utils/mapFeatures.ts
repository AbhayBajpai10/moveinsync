// // src/utils/mapFeatures.ts

// // 1. Office Geofence (Polygon - Blue)
// export const officeGeofenceGeoJSON = {
//   type: 'FeatureCollection',
//   features: [
//     {
//       type: 'Feature',
//       properties: { name: 'Bangalore HQ' },
//       geometry: {
//         type: 'Polygon',
//         coordinates: [
//           [
//             [77.58, 12.96],
//             [77.61, 12.96],
//             [77.61, 12.98],
//             [77.58, 12.98],
//             [77.58, 12.96],
//           ],
//         ],
//       },
//     },
//   ],
// };

// // 2. Pickup Geofences (Points - Orange)
// export const pickupGeofenceGeoJSON = {
//   type: 'FeatureCollection',
//   features: [
//     { type: 'Feature', properties: { name: 'Zone A' }, geometry: { type: 'Point', coordinates: [77.585, 12.965] } },
//     { type: 'Feature', properties: { name: 'Zone B' }, geometry: { type: 'Point', coordinates: [77.605, 12.975] } },
//   ],
// };

// // 3. Dynamic Route Generator
// export const generateRouteGeoJSON = (vehicleCoordinates: [number, number] | null) => {
//   if (!vehicleCoordinates) return { type: 'FeatureCollection', features: [] };

//   // Simulating a route from the vehicle's current position to the Office HQ
//   return {
//     type: 'FeatureCollection',
//     features: [
//       {
//         type: 'Feature',
//         properties: {},
//         geometry: {
//           type: 'LineString',
//           coordinates: [
//             vehicleCoordinates, // Start at vehicle
//             [vehicleCoordinates[0] + 0.005, vehicleCoordinates[1] + 0.005], // Simulated waypoint
//             [77.595, 12.97], // End at HQ
//           ],
//         },
//       },
//     ],
//   };
// };


// export const generateTripDetailsGeoJSON = (vehicleCoordinates: [number, number] | null) => {
//   if (!vehicleCoordinates) {
//     return {
//       completedRoute: { type: 'FeatureCollection', features: [] },
//       remainingRoute: { type: 'FeatureCollection', features: [] },
//       stops: { type: 'FeatureCollection', features: [] }
//     };
//   }

//   // 1. FIXED Static Points (They will no longer drag across the map)
//   const startPoint = [77.575, 12.955]; // Fixed location for Priya
//   const nextStop = [77.600, 12.965];   // Fixed location for Rahul
//   const hqPoint = [77.595, 12.970];    // Office HQ

//   return {
//     completedRoute: {
//       type: 'FeatureCollection',
//       features: [{
//         type: 'Feature',
//         properties: {},
//         geometry: { 
//           type: 'LineString', 
//           // Draws from Priya's fixed spot -> to the moving vehicle
//           coordinates: [startPoint, vehicleCoordinates] 
//         }
//       }]
//     },
//     remainingRoute: {
//       type: 'FeatureCollection',
//       features: [{
//         type: 'Feature',
//         properties: {},
//         geometry: { 
//           type: 'LineString', 
//           // Draws from moving vehicle -> to Rahul's fixed spot -> to HQ
//           coordinates: [vehicleCoordinates, nextStop, hqPoint] 
//         }
//       }]
//     },
//     stops: {
//       type: 'FeatureCollection',
//       features: [
//         {
//           type: 'Feature',
//           properties: { employeeName: 'Priya (Picked up)' },
//           geometry: { type: 'Point', coordinates: startPoint }
//         },
//         {
//           type: 'Feature',
//           properties: { employeeName: 'Rahul (Next)' },
//           geometry: { type: 'Point', coordinates: nextStop }
//         }
//       ]
//     }
//   };
// };


// // src/utils/mapFeatures.ts

// export const fetchRoadSnappedRoutes = async (
//   vehicleCoords: [number, number], 
//   startCoords: [number, number], 
//   nextStopCoords: [number, number], 
//   hqCoords: [number, number]
// ) => {
//   const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
//   if (!token) return null;

//   try {
//     // 1. Fetch Completed Route (Start Point -> Current Vehicle Position)
//     const completedUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${startCoords[0]},${startCoords[1]};${vehicleCoords[0]},${vehicleCoords[1]}?geometries=geojson&access_token=${token}`;

//     // 2. Fetch Remaining Route (Current Vehicle Position -> Next Stop -> HQ)
//     const remainingUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${vehicleCoords[0]},${vehicleCoords[1]};${nextStopCoords[0]},${nextStopCoords[1]};${hqCoords[0]},${hqCoords[1]}?geometries=geojson&access_token=${token}`;

//     const [completedRes, remainingRes] = await Promise.all([
//       fetch(completedUrl),
//       fetch(remainingUrl)
//     ]);

//     const completedData = await completedRes.json();
//     const remainingData = await remainingRes.json();

//     return {
//       completedGeometry: completedData.routes?.[0]?.geometry || null,
//       remainingGeometry: remainingData.routes?.[0]?.geometry || null,
//     };
//   } catch (error) {
//     console.error("Failed to fetch Mapbox Directions:", error);
//     return null;
//   }
// };





// ============================================================
// utils/mapFeatures.ts  — Geofence GeoJSON + Road-snapped routes
// ============================================================

// ── 1. Office Geofence (Polygon) ──────────────────────────
export const officeGeofenceGeoJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Bangalore HQ' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.58, 12.96],
            [77.61, 12.96],
            [77.61, 12.98],
            [77.58, 12.98],
            [77.58, 12.96],
          ],
        ],
      },
    },
  ],
};

// ── 2. Pickup Geofences (Points) ──────────────────────────
export const pickupGeofenceGeoJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Zone A' },
      geometry: { type: 'Point', coordinates: [77.585, 12.965] },
    },
    {
      type: 'Feature',
      properties: { name: 'Zone B' },
      geometry: { type: 'Point', coordinates: [77.605, 12.975] },
    },
  ],
};

// ── 3. Trip Details GeoJSON (straight-line fallback) ──────
export const generateTripDetailsGeoJSON = (
  vehicleCoordinates: [number, number] | null
) => {
  const empty = { type: 'FeatureCollection' as const, features: [] };
  if (!vehicleCoordinates) {
    return { completedRoute: empty, remainingRoute: empty, stops: empty };
  }

  const startPoint: GeoJSON.Position = [77.575, 12.955];
  const nextStop: GeoJSON.Position = [77.600, 12.965];
  const hqPoint: GeoJSON.Position = [77.595, 12.970];

  return {
    completedRoute: {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: [startPoint, vehicleCoordinates] },
      }],
    },
    remainingRoute: {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: [vehicleCoordinates, nextStop, hqPoint] },
      }],
    },
    stops: {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { employeeName: 'Priya (Picked up)' },
          geometry: { type: 'Point' as const, coordinates: startPoint },
        },
        {
          type: 'Feature' as const,
          properties: { employeeName: 'Rahul (Next)' },
          geometry: { type: 'Point' as const, coordinates: nextStop },
        },
      ],
    },
  };
};

// ── 4. Road-snapped routes via Mapbox Directions ─────────
/**
 * ✅ Now accepts an AbortSignal so the caller can cancel stale fetches.
 *    When the user selects vehicle A then immediately vehicle B, the A fetch
 *    is aborted before B's fetch starts — no race condition.
 */
export const fetchRoadSnappedRoutes = async (
  vehicleCoords: [number, number],
  startCoords: [number, number],
  nextStopCoords: [number, number],
  hqCoords: [number, number],
  signal?: AbortSignal
): Promise<{ completedGeometry: GeoJSON.Geometry | null; remainingGeometry: GeoJSON.Geometry | null } | null> => {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    console.error('[fetchRoadSnappedRoutes] Mapbox token missing');
    return null;
  }

  const fmt = (c: [number, number]) => `${c[0]},${c[1]}`;

  const completedUrl =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${fmt(startCoords)};${fmt(vehicleCoords)}` +
    `?geometries=geojson&overview=full&access_token=${token}`;

  const remainingUrl =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${fmt(vehicleCoords)};${fmt(nextStopCoords)};${fmt(hqCoords)}` +
    `?geometries=geojson&overview=full&access_token=${token}`;

  try {
    const [completedRes, remainingRes] = await Promise.all([
      fetch(completedUrl, { signal }),
      fetch(remainingUrl, { signal }),
    ]);

    if (!completedRes.ok || !remainingRes.ok) {
      console.error('[fetchRoadSnappedRoutes] Non-200 response from Mapbox Directions');
      return null;
    }

    const [completedData, remainingData] = await Promise.all([
      completedRes.json(),
      remainingRes.json(),
    ]);

    return {
      completedGeometry: completedData.routes?.[0]?.geometry ?? null,
      remainingGeometry: remainingData.routes?.[0]?.geometry ?? null,
    };
  } catch (err) {
    // AbortError is expected when the caller intentionally cancels — don't log it as an error
    if ((err as Error).name === 'AbortError') return null;
    console.error('[fetchRoadSnappedRoutes] Fetch failed:', err);
    return null;
  }
};

// ── 5. Scalable Geofence Generators ──────────────────────
/**
 * Seeded pseudo-random number generator (mulberry32).
 * Deterministic: same seed → same sequence every time, so test data
 * is reproducible and snapshot tests are stable.
 */
function createSeededRng(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bengaluru metro bounding box — all generated features fall inside this area
export const BENGALURU_BBOX = {
  minLng: 77.45, maxLng: 77.75,
  minLat: 12.85, maxLat: 13.10,
};

export const OFFICE_ZONE_NAMES = [
  'Whitefield', 'Electronic City', 'Koramangala', 'Indiranagar',
  'Jayanagar', 'Marathahalli', 'HSR Layout', 'Bellandur',
  'Sarjapur', 'Hebbal', 'Yeshwanthpur', 'Rajajinagar',
  'Malleswaram', 'Yelahanka', 'BTM Layout', 'JP Nagar',
];

export const PICKUP_ZONE_PREFIXES = [
  'Zone', 'Stop', 'Hub', 'Point', 'Bay', 'Stand', 'Terminal',
];

/**
 * Generate `count` office geofences as GeoJSON Polygons.
 * Each feature has: id, type, name, radiusMeters properties.
 * Seeds are fixed (42) for reproducibility.
 */
export function generateOfficeGeofences(
  count = 500
): { type: 'FeatureCollection'; features: object[] } {
  const rng = createSeededRng(42);
  const { minLng, maxLng, minLat, maxLat } = BENGALURU_BBOX;
  const features: object[] = [];

  for (let i = 0; i < count; i++) {
    const lng = minLng + rng() * (maxLng - minLng);
    const lat = minLat + rng() * (maxLat - minLat);
    // half-width and half-height of the polygon (in degrees, ~200m–800m)
    const hw = 0.002 + rng() * 0.005;
    const hh = 0.002 + rng() * 0.005;
    const radiusMeters = Math.round((hw + hh) * 0.5 * 111_000);
    const nameBase = OFFICE_ZONE_NAMES[i % OFFICE_ZONE_NAMES.length];
    const sector = Math.floor(i / OFFICE_ZONE_NAMES.length) + 1;

    features.push({
      type: 'Feature',
      properties: {
        id: `office-${i}`,
        type: 'office',
        name: `${nameBase} - Sector ${sector}`,
        radiusMeters,
        active: false,           // toggled by GeofenceEngine when a vehicle enters
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [lng - hw, lat - hh],
          [lng + hw, lat - hh],
          [lng + hw, lat + hh],
          [lng - hw, lat + hh],
          [lng - hw, lat - hh],  // close ring
        ]],
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Generate `count` pickup geofences as GeoJSON Points.
 * Each feature has: id, type, name, radiusMeters properties.
 * Mapbox clustering is applied at the source level — these are raw points.
 * Seeds are fixed (99) for reproducibility.
 */
export function generatePickupGeofences(
  count = 2000
): { type: 'FeatureCollection'; features: object[] } {
  const rng = createSeededRng(99);
  const { minLng, maxLng, minLat, maxLat } = BENGALURU_BBOX;
  const features: object[] = [];

  for (let i = 0; i < count; i++) {
    const lng = minLng + rng() * (maxLng - minLng);
    const lat = minLat + rng() * (maxLat - minLat);
    const radiusMeters = 100 + Math.round(rng() * 900); // 100m – 1 km
    const prefix = PICKUP_ZONE_PREFIXES[i % PICKUP_ZONE_PREFIXES.length];

    features.push({
      type: 'Feature',
      properties: {
        id: `pickup-${i}`,
        type: 'pickup',
        name: `${prefix} ${i + 1}`,
        radiusMeters,
      },
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
    });
  }

  return { type: 'FeatureCollection', features };
}