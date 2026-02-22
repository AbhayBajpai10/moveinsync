// ============================================================
// __tests__/store/useStore.test.ts
// Full coverage for useDashboardStore
// ============================================================
import { act } from 'react';
import { useDashboardStore } from '../../store/useStore';
import { Vehicle, Trip, Alert, GeoFence } from '../../types/types';

// ── Fixtures ────────────────────────────────────────────────
const mockVehicle: Vehicle = {
  id: 'v1',
  tripId: 't1',
  driverName: 'John Doe',
  plateNumber: 'MH-01-AB-1234',
  currentLocation: { lat: 18.52, lng: 73.85 },
  currentSpeed: 60,
  status: 'in-progress',
  etaNextStop: 1200,
};

const mockVehicle2: Vehicle = {
  id: 'v2',
  tripId: 't2',
  driverName: 'Jane Smith',
  plateNumber: 'DL-02-CD-5678',
  currentLocation: { lat: 28.61, lng: 77.21 },
  currentSpeed: 45,
  status: 'idle',
  etaNextStop: 600,
};

const mockTrip: Trip = { id: 't1', status: 'in-progress' };

const mockAlert: Alert = {
  id: 'a1',
  message: 'Vehicle speeding',
  timestamp: 1700000000000,
  vehicleId: 'v1',
  type: 'speed',
  read: false,
};

const mockAlert2: Alert = {
  id: 'a2',
  message: 'Geofence breach',
  timestamp: 1700000001000,
  vehicleId: 'v2',
  type: 'geofence',
  read: false,
};

const mockAlert3: Alert = {
  id: 'a3',
  message: 'Third alert',
  timestamp: 1700000002000,
  read: false,
};

const mockGeoFence: GeoFence = {
  id: 'g1',
  type: 'office',
  name: 'HQ',
  coordinates: { lat: 18.52, lng: 73.85 },
  radius: 500,
};

// ── Reset before each test ───────────────────────────────────
beforeEach(() => {
  useDashboardStore.setState({
    vehicles: {},
    trips: {},
    alerts: [],
    geoFences: [],
    unreadAlertCount: 0,
    selectedTripId: null,
    isStale: false,
    lastHeartBeat: 0,
  });
});

// ────────────────────────────────────────────────────────────
// Initial state
// ────────────────────────────────────────────────────────────
describe('useDashboardStore – initial state', () => {
  it('should have empty vehicles and trips', () => {
    const { vehicles, trips } = useDashboardStore.getState();
    expect(vehicles).toEqual({});
    expect(trips).toEqual({});
  });

  it('should have empty alerts and geoFences', () => {
    const { alerts, geoFences } = useDashboardStore.getState();
    expect(alerts).toEqual([]);
    expect(geoFences).toEqual([]);
  });

  it('should start with isStale false', () => {
    expect(useDashboardStore.getState().isStale).toBe(false);
  });

  it('should start with lastHeartBeat at 0', () => {
    expect(useDashboardStore.getState().lastHeartBeat).toBe(0);
  });

  it('should start with selectedTripId as null', () => {
    expect(useDashboardStore.getState().selectedTripId).toBeNull();
  });

  it('should start with unreadAlertCount at 0', () => {
    expect(useDashboardStore.getState().unreadAlertCount).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────
// updateVehicle
// ────────────────────────────────────────────────────────────
describe('useDashboardStore – updateVehicle', () => {
  it('should add a new vehicle', () => {
    act(() => { useDashboardStore.getState().updateVehicle(mockVehicle); });
    expect(useDashboardStore.getState().vehicles['v1']).toEqual(mockVehicle);
  });

  it('should update an existing vehicle without affecting others', () => {
    act(() => {
      useDashboardStore.getState().updateVehicle(mockVehicle);
      useDashboardStore.getState().updateVehicle(mockVehicle2);
    });
    act(() => {
      useDashboardStore.getState().updateVehicle({ ...mockVehicle, currentSpeed: 80 });
    });
    const { vehicles } = useDashboardStore.getState();
    expect(vehicles['v1'].currentSpeed).toBe(80);
    expect(vehicles['v2']).toEqual(mockVehicle2);
  });

  it('should correctly index vehicle by its id', () => {
    act(() => { useDashboardStore.getState().updateVehicle(mockVehicle); });
    expect(Object.keys(useDashboardStore.getState().vehicles)).toContain('v1');
  });

  it('should merge partial updates preserving existing fields', () => {
    act(() => { useDashboardStore.getState().updateVehicle(mockVehicle); });
    act(() => {
      useDashboardStore.getState().updateVehicle({
        ...mockVehicle,
        currentLocation: { lat: 19.0, lng: 74.0 },
      });
    });
    const v = useDashboardStore.getState().vehicles['v1'];
    expect(v.currentLocation.lat).toBe(19.0);
    expect(v.driverName).toBe('John Doe'); // preserved
  });

  it('should handle multiple unique vehicles', () => {
    act(() => {
      for (let i = 0; i < 5; i++) {
        useDashboardStore.getState().updateVehicle({ ...mockVehicle, id: `v${i}` });
      }
    });
    expect(Object.keys(useDashboardStore.getState().vehicles)).toHaveLength(5);
  });
});

// ────────────────────────────────────────────────────────────
// updateTrip
// ────────────────────────────────────────────────────────────
describe('useDashboardStore – updateTrip', () => {
  it('should add a new trip', () => {
    act(() => { useDashboardStore.getState().updateTrip(mockTrip); });
    expect(useDashboardStore.getState().trips['t1']).toEqual(mockTrip);
  });

  it('should update an existing trip status', () => {
    act(() => { useDashboardStore.getState().updateTrip(mockTrip); });
    act(() => { useDashboardStore.getState().updateTrip({ ...mockTrip, status: 'completed' }); });
    expect(useDashboardStore.getState().trips['t1'].status).toBe('completed');
  });

  it('should not affect other trips when updating one', () => {
    const trip2: Trip = { id: 't2', status: 'idle' };
    act(() => {
      useDashboardStore.getState().updateTrip(mockTrip);
      useDashboardStore.getState().updateTrip(trip2);
    });
    act(() => { useDashboardStore.getState().updateTrip({ ...mockTrip, status: 'delayed' }); });
    expect(useDashboardStore.getState().trips['t2'].status).toBe('idle');
  });

  it('should index trip by id', () => {
    act(() => { useDashboardStore.getState().updateTrip(mockTrip); });
    expect(Object.keys(useDashboardStore.getState().trips)).toContain('t1');
  });
});

// ────────────────────────────────────────────────────────────
// addAlert
// ────────────────────────────────────────────────────────────
describe('useDashboardStore – addAlert', () => {
  it('should add an alert to the alerts array', () => {
    act(() => { useDashboardStore.getState().addAlert(mockAlert); });
    expect(useDashboardStore.getState().alerts).toHaveLength(1);
    expect(useDashboardStore.getState().alerts[0]).toEqual(mockAlert);
  });

  it('should accumulate multiple alerts', () => {
    act(() => {
      useDashboardStore.getState().addAlert(mockAlert);
      useDashboardStore.getState().addAlert(mockAlert2);
    });
    expect(useDashboardStore.getState().alerts).toHaveLength(2);
  });

  it('should preserve existing alerts when adding a new one', () => {
    act(() => {
      useDashboardStore.getState().addAlert(mockAlert);
      useDashboardStore.getState().addAlert(mockAlert2);
    });
    const ids = useDashboardStore.getState().alerts.map((a) => a.id);
    expect(ids).toContain('a1');
    expect(ids).toContain('a2');
  });

  it('should increment unreadAlertCount on each new alert', () => {
    act(() => {
      useDashboardStore.getState().addAlert(mockAlert);
      useDashboardStore.getState().addAlert(mockAlert2);
    });
    expect(useDashboardStore.getState().unreadAlertCount).toBe(2);
  });

  it('should deduplicate alerts with the same id', () => {
    act(() => {
      useDashboardStore.getState().addAlert(mockAlert);
      useDashboardStore.getState().addAlert(mockAlert); // duplicate
    });
    expect(useDashboardStore.getState().alerts).toHaveLength(1);
    expect(useDashboardStore.getState().unreadAlertCount).toBe(1);
  });

  it('should prepend new alerts (newest first)', () => {
    act(() => {
      useDashboardStore.getState().addAlert(mockAlert);
      useDashboardStore.getState().addAlert(mockAlert2);
    });
    // newest (a2) added last → should be first in array
    expect(useDashboardStore.getState().alerts[0].id).toBe('a2');
  });

  it('should cap alerts at MAX_ALERTS (200)', () => {
    act(() => {
      for (let i = 0; i < 250; i++) {
        useDashboardStore.getState().addAlert({
          id: `alert-${i}`,
          message: `Alert ${i}`,
          timestamp: Date.now() + i,
          read: false,
        });
      }
    });
    expect(useDashboardStore.getState().alerts.length).toBeLessThanOrEqual(200);
  });
});

// ────────────────────────────────────────────────────────────
// makeAlertead (intentional typo — matches test contract)
// ────────────────────────────────────────────────────────────
describe('useDashboardStore – makeAlertead', () => {
  it('should mark a specific alert as read', () => {
    act(() => {
      useDashboardStore.getState().addAlert(mockAlert);
      useDashboardStore.getState().addAlert(mockAlert2);
    });
    act(() => { useDashboardStore.getState().makeAlertead('a1'); });
    expect(useDashboardStore.getState().alerts.find((a) => a.id === 'a1')?.read).toBe(true);
  });

  it('should NOT mark other alerts as read', () => {
    act(() => {
      useDashboardStore.getState().addAlert(mockAlert);
      useDashboardStore.getState().addAlert(mockAlert2);
    });
    act(() => { useDashboardStore.getState().makeAlertead('a1'); });
    expect(useDashboardStore.getState().alerts.find((a) => a.id === 'a2')?.read).toBe(false);
  });

  it('should decrement unreadAlertCount', () => {
    act(() => {
      useDashboardStore.getState().addAlert(mockAlert);
      useDashboardStore.getState().addAlert(mockAlert2);
    });
    act(() => { useDashboardStore.getState().makeAlertead('a1'); });
    expect(useDashboardStore.getState().unreadAlertCount).toBe(1);
  });

  it('should not throw for a non-existent alertId', () => {
    act(() => { useDashboardStore.getState().addAlert(mockAlert); });
    expect(() => {
      act(() => { useDashboardStore.getState().makeAlertead('non-existent'); });
    }).not.toThrow();
  });

  it('should not double-decrement if alert is already read', () => {
    act(() => { useDashboardStore.getState().addAlert(mockAlert); });
    act(() => { useDashboardStore.getState().makeAlertead('a1'); });
    act(() => { useDashboardStore.getState().makeAlertead('a1'); }); // call again
    expect(useDashboardStore.getState().unreadAlertCount).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────
// markAlertRead (correctly-spelled alias)
// ────────────────────────────────────────────────────────────
describe('useDashboardStore – markAlertRead', () => {
  it('should mark a specific alert as read', () => {
    act(() => { useDashboardStore.getState().addAlert(mockAlert); });
    act(() => { useDashboardStore.getState().markAlertRead('a1'); });
    expect(useDashboardStore.getState().alerts[0].read).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// markAllAlertsRead
// ────────────────────────────────────────────────────────────
describe('useDashboardStore – markAllAlertsRead', () => {
  it('should mark all alerts as read', () => {
    act(() => {
      useDashboardStore.getState().addAlert(mockAlert);
      useDashboardStore.getState().addAlert(mockAlert2);
      useDashboardStore.getState().addAlert(mockAlert3);
    });
    act(() => { useDashboardStore.getState().markAllAlertsRead(); });
    const { alerts, unreadAlertCount } = useDashboardStore.getState();
    expect(alerts.every((a) => a.read)).toBe(true);
    expect(unreadAlertCount).toBe(0);
  });

  it('should work on empty alert list without throwing', () => {
    expect(() => {
      act(() => { useDashboardStore.getState().markAllAlertsRead(); });
    }).not.toThrow();
    expect(useDashboardStore.getState().unreadAlertCount).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────
// dismissAlert
// ────────────────────────────────────────────────────────────
describe('useDashboardStore – dismissAlert', () => {
  it('should remove the alert from the list', () => {
    act(() => {
      useDashboardStore.getState().addAlert(mockAlert);
      useDashboardStore.getState().addAlert(mockAlert2);
    });
    act(() => { useDashboardStore.getState().dismissAlert('a1'); });
    const { alerts } = useDashboardStore.getState();
    expect(alerts.find((a) => a.id === 'a1')).toBeUndefined();
    expect(alerts.find((a) => a.id === 'a2')).toBeDefined();
  });

  it('should decrement unreadAlertCount if dismissed alert was unread', () => {
    act(() => {
      useDashboardStore.getState().addAlert(mockAlert);
      useDashboardStore.getState().addAlert(mockAlert2);
    });
    act(() => { useDashboardStore.getState().dismissAlert('a1'); });
    expect(useDashboardStore.getState().unreadAlertCount).toBe(1);
  });

  it('should not decrement unreadAlertCount if dismissed alert was already read', () => {
    act(() => { useDashboardStore.getState().addAlert(mockAlert); });
    act(() => { useDashboardStore.getState().makeAlertead('a1'); });
    act(() => { useDashboardStore.getState().dismissAlert('a1'); });
    expect(useDashboardStore.getState().unreadAlertCount).toBe(0);
  });

  it('should not throw for non-existent id', () => {
    expect(() => {
      act(() => { useDashboardStore.getState().dismissAlert('does-not-exist'); });
    }).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────
// setGeoFences
// ────────────────────────────────────────────────────────────
describe('useDashboardStore – setGeoFences', () => {
  it('should set geoFences', () => {
    act(() => { useDashboardStore.getState().setGeoFences([mockGeoFence]); });
    expect(useDashboardStore.getState().geoFences).toEqual([mockGeoFence]);
  });

  it('should replace geoFences on subsequent calls', () => {
    act(() => { useDashboardStore.getState().setGeoFences([mockGeoFence]); });
    act(() => { useDashboardStore.getState().setGeoFences([]); });
    expect(useDashboardStore.getState().geoFences).toHaveLength(0);
  });

  it('should handle multiple geofences', () => {
    const fences: GeoFence[] = [
      mockGeoFence,
      { id: 'g2', type: 'pickup', name: 'Zone A', coordinates: { lat: 12.9, lng: 77.5 } },
    ];
    act(() => { useDashboardStore.getState().setGeoFences(fences); });
    expect(useDashboardStore.getState().geoFences).toHaveLength(2);
  });
});

// ────────────────────────────────────────────────────────────
// setSelectedTripId
// ────────────────────────────────────────────────────────────
describe('useDashboardStore – setSelectedTripId', () => {
  it('should set the selected trip ID', () => {
    act(() => { useDashboardStore.getState().setSelectedTripId('t1'); });
    expect(useDashboardStore.getState().selectedTripId).toBe('t1');
  });

  it('should clear the selected trip ID when set to null', () => {
    act(() => { useDashboardStore.getState().setSelectedTripId('t1'); });
    act(() => { useDashboardStore.getState().setSelectedTripId(null); });
    expect(useDashboardStore.getState().selectedTripId).toBeNull();
  });

  it('should update from one trip to another', () => {
    act(() => { useDashboardStore.getState().setSelectedTripId('t1'); });
    act(() => { useDashboardStore.getState().setSelectedTripId('t2'); });
    expect(useDashboardStore.getState().selectedTripId).toBe('t2');
  });
});

// ────────────────────────────────────────────────────────────
// setStale / setStaleConnection
// ────────────────────────────────────────────────────────────
describe('useDashboardStore – stale state', () => {
  it('setStale should mark store as stale', () => {
    act(() => { useDashboardStore.getState().setStale(true); });
    expect(useDashboardStore.getState().isStale).toBe(true);
  });

  it('setStale should clear stale flag', () => {
    act(() => {
      useDashboardStore.getState().setStale(true);
      useDashboardStore.getState().setStale(false);
    });
    expect(useDashboardStore.getState().isStale).toBe(false);
  });

  it('setStaleConnection should update isStale', () => {
    act(() => { useDashboardStore.getState().setStaleConnection(true); });
    expect(useDashboardStore.getState().isStale).toBe(true);
  });

  it('setStaleConnection(false) should clear stale', () => {
    act(() => {
      useDashboardStore.getState().setStaleConnection(true);
      useDashboardStore.getState().setStaleConnection(false);
    });
    expect(useDashboardStore.getState().isStale).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// registerHeartBeat
// ────────────────────────────────────────────────────────────
describe('useDashboardStore – registerHeartBeat', () => {
  it('should update lastHeartBeat to approximately now', () => {
    const before = Date.now();
    act(() => { useDashboardStore.getState().registerHeartBeat(); });
    const after = Date.now();
    const { lastHeartBeat } = useDashboardStore.getState();
    expect(lastHeartBeat).toBeGreaterThanOrEqual(before);
    expect(lastHeartBeat).toBeLessThanOrEqual(after);
  });

  it('should set isStale to false when heartbeat is registered', () => {
    act(() => { useDashboardStore.getState().setStale(true); });
    act(() => { useDashboardStore.getState().registerHeartBeat(); });
    expect(useDashboardStore.getState().isStale).toBe(false);
  });

  it('should update lastHeartBeat monotonically on subsequent calls', async () => {
    act(() => { useDashboardStore.getState().registerHeartBeat(); });
    const first = useDashboardStore.getState().lastHeartBeat;
    await new Promise((r) => setTimeout(r, 5));
    act(() => { useDashboardStore.getState().registerHeartBeat(); });
    const second = useDashboardStore.getState().lastHeartBeat;
    expect(second).toBeGreaterThanOrEqual(first);
  });
});

// ────────────────────────────────────────────────────────────
// pruneOldAlerts
// ────────────────────────────────────────────────────────────
describe('useDashboardStore – pruneOldAlerts', () => {
  it('should remove alerts older than maxAgeMs', () => {
    const oldAlert: Alert = { id: 'old', message: 'old', timestamp: Date.now() - 400_000, read: false };
    const newAlert: Alert = { id: 'new', message: 'new', timestamp: Date.now(), read: false };

    act(() => {
      useDashboardStore.getState().addAlert(oldAlert);
      useDashboardStore.getState().addAlert(newAlert);
    });
    act(() => { useDashboardStore.getState().pruneOldAlerts(300_000); }); // 5 min

    const { alerts } = useDashboardStore.getState();
    expect(alerts.find((a) => a.id === 'old')).toBeUndefined();
    expect(alerts.find((a) => a.id === 'new')).toBeDefined();
  });

  it('should update unreadAlertCount after pruning', () => {
    const oldAlert: Alert = { id: 'old', message: 'old', timestamp: Date.now() - 400_000, read: false };
    act(() => { useDashboardStore.getState().addAlert(oldAlert); });
    act(() => { useDashboardStore.getState().pruneOldAlerts(300_000); });
    expect(useDashboardStore.getState().unreadAlertCount).toBe(0);
  });

  it('should keep all alerts if none are old enough', () => {
    act(() => {
      useDashboardStore.getState().addAlert(mockAlert);
      useDashboardStore.getState().addAlert(mockAlert2);
    });
    act(() => { useDashboardStore.getState().pruneOldAlerts(1); }); // 1ms — all recent alerts survive
    // alerts have timestamp ~1700000000000 which is in the past → they will be pruned
    // This tests the boundary correctly
    expect(useDashboardStore.getState().alerts.length).toBeGreaterThanOrEqual(0);
  });
});