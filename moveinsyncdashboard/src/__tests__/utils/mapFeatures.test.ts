// ============================================================
// __tests__/utils/mapFeatures.test.ts
// Validates generateOfficeGeofences() and generatePickupGeofences()
// ============================================================

import {
    generateOfficeGeofences,
    generatePickupGeofences,
    BENGALURU_BBOX,
} from '../../utils/mapFeatures';

// ── Helpers ────────────────────────────────────────────────
const { minLng, maxLng, minLat, maxLat } = BENGALURU_BBOX;

function inBounds(lng: number, lat: number) {
    return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

// ── Office Geofence Generator ──────────────────────────────
describe('generateOfficeGeofences', () => {
    const fc = generateOfficeGeofences(500);

    it('returns a FeatureCollection', () => {
        expect(fc.type).toBe('FeatureCollection');
    });

    it('returns exactly 500 features', () => {
        expect(fc.features.length).toBe(500);
    });

    it('every feature is a Polygon', () => {
        fc.features.forEach((f: any) => {
            expect(f.type).toBe('Feature');
            expect(f.geometry.type).toBe('Polygon');
        });
    });

    it('every polygon ring is closed (first === last coordinate)', () => {
        fc.features.forEach((f: any) => {
            const ring = f.geometry.coordinates[0];
            expect(ring.length).toBeGreaterThanOrEqual(4);
            expect(ring[0]).toEqual(ring[ring.length - 1]);
        });
    });

    it('all features have required properties', () => {
        fc.features.forEach((f: any, i: number) => {
            expect(f.properties.id).toBe(`office-${i}`);
            expect(f.properties.type).toBe('office');
            expect(typeof f.properties.name).toBe('string');
            expect(f.properties.name.length).toBeGreaterThan(0);
            expect(typeof f.properties.radiusMeters).toBe('number');
            expect(f.properties.radiusMeters).toBeGreaterThan(0);
        });
    });

    it('all polygon centroids are within Bengaluru metro bbox', () => {
        fc.features.forEach((f: any) => {
            const ring = f.geometry.coordinates[0];
            // centroid = midpoint of first two unique corners
            const lng = (ring[0][0] + ring[1][0]) / 2;
            const lat = (ring[0][1] + ring[2][1]) / 2;
            expect(inBounds(lng, lat)).toBe(true);
        });
    });

    it('is deterministic (same seed → identical output)', () => {
        const fc2 = generateOfficeGeofences(500);
        expect(fc.features[0]).toEqual(fc2.features[0]);
        expect(fc.features[499]).toEqual(fc2.features[499]);
    });

    it('returns different counts when called with different n', () => {
        const small = generateOfficeGeofences(10);
        expect(small.features.length).toBe(10);
    });
});

// ── Pickup Geofence Generator ──────────────────────────────
describe('generatePickupGeofences', () => {
    const fc = generatePickupGeofences(2000);

    it('returns a FeatureCollection', () => {
        expect(fc.type).toBe('FeatureCollection');
    });

    it('returns exactly 2,000 features', () => {
        expect(fc.features.length).toBe(2000);
    });

    it('every feature is a Point', () => {
        fc.features.forEach((f: any) => {
            expect(f.type).toBe('Feature');
            expect(f.geometry.type).toBe('Point');
            expect(f.geometry.coordinates.length).toBe(2);
        });
    });

    it('all features have required properties', () => {
        fc.features.forEach((f: any, i: number) => {
            expect(f.properties.id).toBe(`pickup-${i}`);
            expect(f.properties.type).toBe('pickup');
            expect(typeof f.properties.name).toBe('string');
            expect(f.properties.name.length).toBeGreaterThan(0);
            expect(typeof f.properties.radiusMeters).toBe('number');
            expect(f.properties.radiusMeters).toBeGreaterThanOrEqual(100);
            expect(f.properties.radiusMeters).toBeLessThanOrEqual(1000);
        });
    });

    it('all points are within Bengaluru metro bbox', () => {
        fc.features.forEach((f: any) => {
            const [lng, lat] = f.geometry.coordinates;
            expect(inBounds(lng, lat)).toBe(true);
        });
    });

    it('is deterministic (same seed → identical output)', () => {
        const fc2 = generatePickupGeofences(2000);
        expect(fc.features[0]).toEqual(fc2.features[0]);
        expect(fc.features[1999]).toEqual(fc2.features[1999]);
    });

    it('produces well-distributed points (not all in one quadrant)', () => {
        const lngs = fc.features.map((f: any) => f.geometry.coordinates[0]);
        const lats = fc.features.map((f: any) => f.geometry.coordinates[1]);
        const lngMid = (minLng + maxLng) / 2;
        const latMid = (minLat + maxLat) / 2;
        const inWest = lngs.filter((l: number) => l < lngMid).length;
        const inEast = lngs.filter((l: number) => l >= lngMid).length;
        const inSouth = lats.filter((l: number) => l < latMid).length;
        const inNorth = lats.filter((l: number) => l >= latMid).length;
        // All quadrants should have at least 20% of points
        expect(inWest).toBeGreaterThan(400);
        expect(inEast).toBeGreaterThan(400);
        expect(inSouth).toBeGreaterThan(400);
        expect(inNorth).toBeGreaterThan(400);
    });

    it('IDs are all unique', () => {
        const ids = fc.features.map((f: any) => f.properties.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(2000);
    });
});
