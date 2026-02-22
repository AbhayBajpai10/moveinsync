// ============================================================
// __tests__/utils/mapHelper.test.ts
// Full coverage for generateVehicleGeoJSON
// ============================================================
import { generateVehicleGeoJSON } from '../../utils/mapHelper';
import { Vehicle } from '../../types/types';

const baseVehicle: Vehicle = {
  id: 'v1',
  tripId: 't1',
  driverName: 'John Doe',
  plateNumber: 'MH-01-AB-1234',
  currentLocation: { lat: 18.52, lng: 73.85 },
  currentSpeed: 60,
  status: 'in-progress',
  etaNextStop: 1200,
};

describe('generateVehicleGeoJSON', () => {
  it('should return a valid FeatureCollection', () => {
    const result = generateVehicleGeoJSON({ v1: baseVehicle });
    expect(result.type).toBe('FeatureCollection');
    expect(Array.isArray(result.features)).toBe(true);
  });

  it('should produce one Feature per vehicle', () => {
    const vehicles = { v1: baseVehicle, v2: { ...baseVehicle, id: 'v2' } };
    const result = generateVehicleGeoJSON(vehicles);
    expect(result.features).toHaveLength(2);
  });

  it('should map lng/lat to GeoJSON coordinates [lng, lat]', () => {
    const result = generateVehicleGeoJSON({ v1: baseVehicle });
    const coords = (result.features[0].geometry as GeoJSON.Point).coordinates;
    expect(coords[0]).toBe(73.85); // lng
    expect(coords[1]).toBe(18.52); // lat
  });

  it('should set geometry type to Point', () => {
    const result = generateVehicleGeoJSON({ v1: baseVehicle });
    expect(result.features[0].geometry.type).toBe('Point');
  });

  it('should include id in properties', () => {
    const result = generateVehicleGeoJSON({ v1: baseVehicle });
    expect(result.features[0].properties?.id).toBe('v1');
  });

  it('should include tripId in properties', () => {
    const result = generateVehicleGeoJSON({ v1: baseVehicle });
    expect(result.features[0].properties?.tripId).toBe('t1');
  });

  it('should include plateNumber in properties', () => {
    const result = generateVehicleGeoJSON({ v1: baseVehicle });
    expect(result.features[0].properties?.plateNumber).toBe('MH-01-AB-1234');
  });

  it('should include driverName in properties', () => {
    const result = generateVehicleGeoJSON({ v1: baseVehicle });
    expect(result.features[0].properties?.driverName).toBe('John Doe');
  });

  it('should include status in properties', () => {
    const result = generateVehicleGeoJSON({ v1: baseVehicle });
    expect(result.features[0].properties?.status).toBe('in-progress');
  });

  it('should include speed (currentSpeed) as speed in properties', () => {
    const result = generateVehicleGeoJSON({ v1: baseVehicle });
    expect(result.features[0].properties?.speed).toBe(60);
  });

  it('should include etaNextStop in properties', () => {
    const result = generateVehicleGeoJSON({ v1: baseVehicle });
    expect(result.features[0].properties?.etaNextStop).toBe(1200);
  });

  it('should return empty FeatureCollection for empty vehicles object', () => {
    const result = generateVehicleGeoJSON({});
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(0);
  });

  it('should handle vehicle with no tripId (optional field)', () => {
    const noTrip: Vehicle = { ...baseVehicle, tripId: undefined };
    const result = generateVehicleGeoJSON({ v1: noTrip });
    expect(result.features[0].properties?.tripId).toBeNull();
  });

  it('should set isArrived to false by default', () => {
    const result = generateVehicleGeoJSON({ v1: baseVehicle });
    expect(result.features[0].properties?.isArrived).toBe(false);
  });

  it('should handle idle vehicle with zero speed', () => {
    const idle: Vehicle = { ...baseVehicle, id: 'idle1', status: 'idle', currentSpeed: 0, etaNextStop: 0 };
    const result = generateVehicleGeoJSON({ idle1: idle });
    expect(result.features[0].properties?.speed).toBe(0);
    expect(result.features[0].properties?.status).toBe('idle');
  });

  it('should handle multiple statuses correctly', () => {
    const vehicles: Record<string, Vehicle> = {
      v1: { ...baseVehicle, id: 'v1', status: 'in-progress' },
      v2: { ...baseVehicle, id: 'v2', status: 'delayed' },
      v3: { ...baseVehicle, id: 'v3', status: 'idle' },
    };
    const result = generateVehicleGeoJSON(vehicles);
    const statuses = result.features.map((f) => f.properties?.status);
    expect(statuses).toContain('in-progress');
    expect(statuses).toContain('delayed');
    expect(statuses).toContain('idle');
  });
});