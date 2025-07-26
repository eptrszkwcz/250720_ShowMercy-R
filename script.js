mapboxgl.accessToken = 'pk.eyJ1IjoicHRyc3prd2N6IiwiYSI6ImNpdHVuOXpqMzAwMmEybnF2anZwbTd4aWcifQ.MF8M3qBg0AEp_-10FB4juw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/ptrszkwcz/cmd0f8osq00cb01sq3isz3osg',
  center:  [32.4, 1.3],
  zoom: 6.75
}); 

// Prepare an empty GeoJSON object
let geojsonData = {
  type: 'FeatureCollection',
  features: []
};

function parseLatLon(coordStr) {
  // Step 1: Clean input string (remove all double quotes and normalize whitespace)
  const cleaned = coordStr.replace(/"+/g, '"').replace(/\s+/g, ' ').trim();
  
  // Skip empty strings
  if (!cleaned || cleaned === '') {
    return null;
  }

  // Step 2: Match DMS patterns
  const regex = /(\d+)°(\d+)'([\d.]+)"([NSEW])/g;
  const coords = [];
  let match;

  while ((match = regex.exec(cleaned)) !== null) {
    const degrees = parseFloat(match[1]);
    const minutes = parseFloat(match[2]);
    const seconds = parseFloat(match[3]);
    const direction = match[4];

    let decimal = degrees + minutes / 60 + seconds / 3600;
    if (direction === 'S' || direction === 'W') decimal *= -1;
    coords.push(decimal);
  }

  if (coords.length !== 2) {
    console.warn("Could not parse:", coordStr);
    return null;
  }

  return {
    lat: coords[0],
    lon: coords[1]
  };
}

// Load data from Google Sheets
const sheetId = '1FSpa8GXKtsxHiAHDRAkum0DGJJs4IAhDhevDrLkh9Bs';
const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

fetch(sheetUrl)
  .then(res => res.text())
  .then(csv => {
    console.log('Google Sheets data received, CSV length:', csv.length);
    const rows = csv.trim().split('\n');
    const headers = rows.shift().split(',').map(h => h.replace(/^"|"$/g, '').trim());

    const coordIdx = headers.indexOf('Coords');
    const regionIdx = headers.indexOf('Region');
    const dateIdx = headers.indexOf('Date Completed');
    const wellID = headers.indexOf('Water Well ID');

    geojsonData.features = []; // Reset in case of reload
    let idCounter = 0;

    for (let row of rows) {
      const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!matches || matches.length !== headers.length) continue;

      const values = matches.map(val => val.replace(/^"|"$/g, '').trim());
      const coordStr = values[coordIdx];

      const latLon = parseLatLon(coordStr);
      if (!latLon || !latLon.lat || !latLon.lon) {
        continue;
      }

      const { lat, lon } = latLon;
      
      // Check if coordinates are within reasonable bounds for Uganda
      if (lat < -2 || lat > 5 || lon < 29 || lon > 35) {
        continue;
      }

      const feature = {
        type: 'Feature',
        id: `point-${idCounter++}`,
        geometry: {
          type: 'Point',
          coordinates: [lon, lat]
        },
        properties: {
          region: values[regionIdx],
          date: values[dateIdx],
          wellID: values[wellID] || `Well ID -`,
        }
      };
      
      geojsonData.features.push(feature);
    }
    
    console.log('Total features processed:', geojsonData.features.length);
    console.log('Features to be added to map:', geojsonData.features.length);

    // Function to add map layers and interactions
    function addMapLayers() {
      
      // 1. Add the GeoJSON source (with promoteId so feature.id is usable)
      console.log('Adding map layers');
      if (!map.getSource('points')) {
        map.addSource('points', {
          type: 'geojson',
          data: geojsonData,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 40,
          promoteId: 'id'
        });
        
        // Only add layers if they don't exist yet
        if (!map.getLayer('clusters')) {
    
      // 2. Cluster circles
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'points',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#1079BF',
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            15,   // radius when count < first step
            100, 20,  // >=100 → radius 20
            750, 25   // >=750 → radius 25
          ],
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff'
        }
      });
    
      // 3. Cluster count labels
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'points',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12
        },
        paint: {
          'text-color': '#ffffff'
        }
      });
    
      // 4. Shadow for individual (unclustered) points
      map.addLayer({
        id: 'point-shadow',
        type: 'circle',
        source: 'points',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 8,
          'circle-color': '#000',
          'circle-opacity': 0.3,
          'circle-blur': 0.6
        }
      });
    
      // 5. Unclustered points
      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'points',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 6,
          'circle-color': '#1079BF',
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff'
        }
      });
      
      // 6. Hover layer for points (initially empty)
      map.addSource('hover', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
      
      map.addLayer({
        id: 'hover-points',
        type: 'circle',
        source: 'hover',
        paint: {
          'circle-radius': 6,
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#000'
        }
      });
      
      // 7. Hover layer for clusters (initially empty)
      map.addSource('hover-clusters', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
      
      map.addLayer({
        id: 'hover-clusters',
        type: 'circle',
        source: 'hover-clusters',
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            15,   // radius when count < first step
            100, 20,  // >=100 → radius 20
            750, 25   // >=750 → radius 25
          ],
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#000'
        }
      });
      
      // 8. Hover cluster count labels
      map.addLayer({
        id: 'hover-cluster-count',
        type: 'symbol',
        source: 'hover-clusters',
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12
        },
        paint: {
          'text-color': '#ffffff'
        }
      });
    
            // 8. Hover interaction for points
      let hoveredFeature = null;
    
      // on mousemove over points → show hover effect
      map.on('mousemove', 'points', (e) => {
        if (!e.features.length) return;
        
        const feature = e.features[0];
        
        // Try to get the feature ID from the original data
        const featureId = feature.id;
        
        if (!featureId) {
          // If no ID, try to find the feature in the original data by coordinates
          const coords = feature.geometry.coordinates;
          
          const originalFeature = geojsonData.features.find(f => {
            const origCoords = f.geometry.coordinates;
            // Use more lenient approximate matching for floating point coordinates
            const lonMatch = Math.abs(origCoords[0] - coords[0]) < 0.001;
            const latMatch = Math.abs(origCoords[1] - coords[1]) < 0.001;
            
            return lonMatch && latMatch;
          });
          
          if (originalFeature) {
            hoveredFeature = originalFeature;
          }
        } else {
          hoveredFeature = feature;
        }
        
        if (hoveredFeature) {
          // Add hover effect
          map.getSource('hover').setData({
            type: 'FeatureCollection',
            features: [hoveredFeature]
          });
          
          map.getCanvas().style.cursor = 'pointer';
                }
      });
    
      // on leaving the points layer → clear hover effect
      map.on('mouseleave', 'points', () => {
        // Clear hover effect
        map.getSource('hover').setData({
          type: 'FeatureCollection',
          features: []
        });
        
        hoveredFeature = null;
        map.getCanvas().style.cursor = '';
      });
      
      // 9. Hover interaction for clusters
      let hoveredCluster = null;
    
      // on mousemove over clusters → show hover effect
      map.on('mousemove', 'clusters', (e) => {
        if (!e.features.length) return;
        
        const cluster = e.features[0];
        hoveredCluster = cluster;
        
        // Add hover effect for cluster
        map.getSource('hover-clusters').setData({
          type: 'FeatureCollection',
          features: [cluster]
        });
        
        map.getCanvas().style.cursor = 'pointer';
      });
      
      // on leaving the clusters layer → clear hover effect
      map.on('mouseleave', 'clusters', () => {
        // Clear hover effect
        map.getSource('hover-clusters').setData({
          type: 'FeatureCollection',
          features: []
        });
        
        hoveredCluster = null;
        map.getCanvas().style.cursor = '';
      });
    
      // 7. Click to expand clusters
      map.on('click', 'clusters', (e) => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
        map.getSource('points').getClusterExpansionZoom(feature.properties.cluster_id, (err, zoom) => {
          if (err) return;
          map.easeTo({ center: feature.geometry.coordinates, zoom });
        });
      });
    
      // 8. Click on an individual point → popup
      map.on('click', 'points', (e) => {
        const props = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates.slice();
        const html = `
          <div class="pop-title">
            <div class="pop-region">${props.region}</div>
            <div class="pop-country">Uganda</div>
            <div class="pop-flag">
              <img src="assets/images/flag_uganda_square.png" alt="Uganda Flag"/>
            </div>
          </div>
          <div class="pop-date-line">
            <div class="pop-ID">${props.wellID}</div>
          </div>
          <div class="pop-date-line">
            <div class="pop-completed">Completed</div>
            <div class="pop-date">${props.date}</div>
          </div>
        `;
        new mapboxgl.Popup().setLngLat(coords).setHTML(html).addTo(map);
      });
    
        } // End of if (!map.getLayer('clusters'))
              } else {
          // Update existing source data
          map.getSource('points').setData(geojsonData);
        }
    } // End of addMapLayers function
    
    // Initialize map layers after data is loaded
    console.log('About to initialize map layers, map.isStyleLoaded():', map.isStyleLoaded());
    if (map.isStyleLoaded()) {
      console.log('Map is ready, calling addMapLayers');
      addMapLayers();
    } else {
      console.log('Map not ready, waiting for load event');
      map.once('load', () => {
        console.log('Map loaded, calling addMapLayers');
        addMapLayers();
      });
    }
    
  });




