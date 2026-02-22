// ============================================================
// __tests__/utils/types.test.ts
// Coverage for isCriticalAlert and isGeofenceAlert helpers
// ============================================================
import { isCriticalAlert, isGeofenceAlert, type AlertType } from '../../types/types';

describe('isCriticalAlert', () => {
  it('should return true for SPEED_VIOLATION', () => {
    expect(isCriticalAlert('SPEED_VIOLATION')).toBe(true);
  });

  it('should return true for legacy "speed" type', () => {
    expect(isCriticalAlert('speed')).toBe(true);
  });

  it('should return true for TRIP_CLOSED', () => {
    expect(isCriticalAlert('TRIP_CLOSED')).toBe(true);
  });

  it('should return false for GEOFENCE_ENTRY', () => {
    expect(isCriticalAlert('GEOFENCE_ENTRY')).toBe(false);
  });

  it('should return false for MAINTENANCE', () => {
    expect(isCriticalAlert('MAINTENANCE')).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isCriticalAlert(undefined)).toBe(false);
  });
});

describe('isGeofenceAlert', () => {
  it('should return true for GEOFENCE_ENTRY', () => {
    expect(isGeofenceAlert('GEOFENCE_ENTRY')).toBe(true);
  });

  it('should return true for GEOFENCE_EXIT', () => {
    expect(isGeofenceAlert('GEOFENCE_EXIT')).toBe(true);
  });

  it('should return true for legacy "geofence" type', () => {
    expect(isGeofenceAlert('geofence')).toBe(true);
  });

  it('should return false for SPEED_VIOLATION', () => {
    expect(isGeofenceAlert('SPEED_VIOLATION')).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isGeofenceAlert(undefined)).toBe(false);
  });
});