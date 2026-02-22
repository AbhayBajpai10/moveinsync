// app/maptest/page.tsx
// Minimal isolated Mapbox test — bypasses all complexity

export default function MapTestPage() {
    return (
        <>
            <div id="map" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }} />
            <script
                dangerouslySetInnerHTML={{
                    __html: `
            // Wait for page to fully paint before initializing
            window.addEventListener('load', function() {
              var script = document.createElement('script');
              script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.js';
              script.onload = function() {
                var link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.css';
                document.head.appendChild(link);

                mapboxgl.accessToken = '${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}';
                var map = new mapboxgl.Map({
                  container: 'map',
                  style: 'mapbox://styles/mapbox/dark-v11',
                  center: [77.5946, 12.9716],
                  zoom: 12,
                });
                map.on('load', function() {
                  console.log('Map loaded! Canvas:', map.getCanvas().width, 'x', map.getCanvas().height);
                });
                map.on('error', function(e) {
                  console.error('Map error:', e);
                });
              };
              document.head.appendChild(script);
            });
          `,
                }}
            />
        </>
    );
}
