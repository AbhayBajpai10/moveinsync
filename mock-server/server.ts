import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import express from "express";
const app = express();

// health check (Render cold-start fix)
app.get("/health", (_, res) => res.send("ok"));

const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  path: "/ws",   // 👈 THIS IS THE KEY FIX
});

// 1. Initialize Mock Fleet Data
const vehicles = Array.from({ length: 10 }).map((_, i) => ({
    id: `V-${1000 + i}`,
    plateNumber: `KA-01-AB-${100 + i}`,
    driverName: `Driver ${i + 1}`,
    status: i === 3 ? 'delayed' : 'in-progress',
    // Using current coordinates
    currentLocation: { lat: 12.9716 + (Math.random() * 0.05), lng: 77.5946 + (Math.random() * 0.05) },
    currentSpeed: Math.floor(Math.random() * 60) + 20,
    etaNextStop: Math.floor(Math.random() * 30) + 5,
}));

// Static Idle Vehicle
vehicles.push({
    id: 'V-1010',
    plateNumber: 'KA-01-AB-1010',
    driverName: 'Driver 11',
    status: 'idle',
    currentLocation: { lat: 12.9650, lng: 77.5850 },
    currentSpeed: 0,
    etaNextStop: 0,
});

// console.log('🚀 Mock Web Socket Server started on port 8080');

// 2. Client Connection Handler
wss.on('connection', (ws: WebSocket) => {
    // console.log('Client Connected');

    // Instantly hydrate the new client with the current map state
    vehicles.forEach((vehicle) => {
        ws.send(JSON.stringify({ type: 'VEHICLE_UPDATE', data: vehicle }));
    });

    ws.on('close', () => {
        // console.log('Client Disconnected');
    });
});

// 3. GLOBAL BROADCAST LOOP (Fixes the scope bug & the multi-client speed bug)
const broadcastInterval = setInterval(() => {

    // Step A: Update the physics for the fleet once
    vehicles.forEach((vehicle) => {
        if (vehicle.status === 'idle') return;

        vehicle.currentLocation.lat += (Math.random() * 0.001) * (Math.random() > 0.5 ? 1 : -1);
        vehicle.currentLocation.lng += (Math.random() * 0.001) * (Math.random() > 0.5 ? 1 : -1);
        vehicle.currentSpeed = Math.floor(Math.random() * 60) + 20;
        vehicle.etaNextStop = Math.floor(Math.random() * 30) + 5;
    });

    // Step B: Push the updated state to ALL connected browser tabs safely
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {

            // Send standard location updates
            vehicles.forEach(vehicle => {
                client.send(JSON.stringify({ type: 'VEHICLE_UPDATE', data: vehicle }));
            });

            // Random Geofence Alert Trigger
            if (Math.random() < 0.05) {
                const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
                client.send(JSON.stringify({
                    type: 'TRIP_ALERT',
                    data: {
                        id: `ALERT-${Date.now()}`,
                        tripId: `TRIP-${Math.floor(Math.random() * 100)}`,
                        vehicleId: vehicle.id,
                        type: 'GEOFENCE_ENTRY', // Fixed so the React UI recognizes the map pin icon
                        message: `Vehicle ${vehicle.id} entered Office Geofence`,
                        timestamp: Date.now(),
                        read: false,
                    }
                }));
            }

            // Speeding Alert Trigger (Fires if car 0 goes over 75km/h)
            if (vehicles[0].currentSpeed > 75) {
                client.send(JSON.stringify({
                    type: 'TRIP_ALERT',
                    data: {
                        id: `SPEED-${Date.now()}`,
                        tripId: `TRIP-SPEED`,
                        vehicleId: vehicles[0].id,
                        type: 'SPEED_VIOLATION', // Triggers the red sonner toast in React
                        message: `CRITICAL: ${vehicles[0].driverName} exceeding speed limit (${vehicles[0].currentSpeed} km/h)!`,
                        timestamp: Date.now(),
                        read: false,
                    }
                }));
            }
        }
    });

}, 1000);

// 4. Graceful Shutdown Routine
const shutdown = () => {
    // console.log('\nGraceful Shutdown Initiated...');

    // 1. Tell all connected React clients the server is going down instantly
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.close(1001, 'Server shutting down for maintenance');
        }
    });

    // 2. Stop the global mock data generation loop (No more reference errors!)
    clearInterval(broadcastInterval);

    // 3. Close the WebSocket server safely
    wss.close(() => {
        // console.log('WebSocket server securely closed. Exiting process.');
        process.exit(0);
    });
};

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`🚀 Mock WS server running on port ${PORT}`);
});
// // Listen for process termination signals (Ctrl+C or Docker stop)
// process.on('SIGINT', shutdown);
// process.on('SIGTERM', shutdown);