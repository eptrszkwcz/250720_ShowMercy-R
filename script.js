// Mapbox GL JS Access Token
// mapboxgl.accessToken = 'pk.eyJ1IjoicHRyc3prd2N6IiwiYSI6ImNtOHMwbmJvdTA4ZnIya290M2hlbmswb2YifQ.qQZEM9FzU2J-_z0vYoSBeg';
mapboxgl.accessToken = 'pk.eyJ1IjoicHRyc3prd2N6IiwiYSI6ImNpdHVuOXpqMzAwMmEybnF2anZwbTd4aWcifQ.MF8M3qBg0AEp_-10FB4juw';


// Function to detect if device is mobile
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         window.innerWidth <= 580;
}

// Initialize the map
const initialZoom = window.innerWidth <= 500 ? 5.2 : 6.2;

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/ptrszkwcz/cmd0f8osq00cb01sq3isz3osg',
  center: [32.3, 1.3], // Uganda center coordinates
  zoom: initialZoom,
  scrollZoom: false, // Disable scroll zoom
  dragPan: !isMobile(), // Disable pan on mobile initially
  dragRotate: false, // Disable rotation
  keyboard: false, // Disable keyboard navigation
  doubleClickZoom: false, // Disable double-click zoom
  touchZoomRotate: !isMobile() // Disable touch zoom/rotate on mobile initially
}); 

// Add zoom control buttons
map.addControl(new mapboxgl.NavigationControl(), 'top-right');

// Mobile interaction handling - enable immediately for mobile
if (isMobile()) {
  // Enable pan and zoom immediately on mobile
  map.dragPan.enable();
  map.touchZoomRotate.enable();
  
  // Set cursor to grab to indicate map is interactive
  const mapContainer = map.getContainer();
  mapContainer.style.cursor = 'grab';
}

// Add search box to upper left corner
map.addControl(
  new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    placeholder: 'Search for a location...',
    marker: false, // Don't add a marker when searching
    position: 'top-left'
  }),
  'top-left'
);

// Custom search for well data
function createWellSearch() {
  // Create search container
  const searchContainer = document.createElement('div');
  searchContainer.className = 'well-search-container';
  searchContainer.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 1;
    background: white;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    min-width: 200px;
    max-width: 300px;
  `;

  // Create search input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search wells by ID or Region...';
  searchInput.style.cssText = `
    width: 100%;
    height: 40px;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 12px;
    box-sizing: border-box;
  `;

  // Create results container
  const resultsContainer = document.createElement('div');
  resultsContainer.className = 'well-search-results';
  resultsContainer.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #ccc;
    border-top: none;
    border-radius: 0 0 4px 4px;
    max-height: 200px;
    overflow-y: auto;
    display: none;
    z-index: 2;
  `;

  searchContainer.appendChild(searchInput);
  searchContainer.appendChild(resultsContainer);

  // Add to map
  map.getContainer().appendChild(searchContainer);

  // Search functionality
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.toLowerCase().trim();
    
    if (query.length < 2) {
      resultsContainer.style.display = 'none';
      return;
    }

    searchTimeout = setTimeout(() => {
      const results = geojsonData.features.filter(feature => {
        const wellID = (feature.properties.wellID || '').toLowerCase();
        const region = (feature.properties.region || '').toLowerCase();
        return wellID.includes(query) || region.includes(query);
      }); // Show all matching results

      displayResults(results, query);
    }, 300);
  });

  function displayResults(results, query) {
    resultsContainer.innerHTML = '';
    
    if (results.length === 0) {
      resultsContainer.innerHTML = '<div style="padding: 8px; color: #666; font-size: 12px;">No matches found</div>';
    } else {
      results.forEach(feature => {
        const resultItem = document.createElement('div');
        resultItem.style.cssText = `
          padding: 8px;
          border-bottom: 1px solid #eee;
          cursor: pointer;
          font-size: 12px;
          line-height: 1.2;
        `;
        
        const wellID = feature.properties.wellID || 'No ID';
        const region = feature.properties.region || 'Unknown Region';
        
        resultItem.innerHTML = `
          <div style="font-weight: bold; color: #333;">${wellID}</div>
          <div style="color: #666; font-size: 11px;">${region}</div>
        `;
        
        resultItem.addEventListener('click', () => {
          // Close any existing popup
          const existingPopup = document.querySelector('.mapboxgl-popup');
          if (existingPopup) {
            existingPopup.remove();
          }
          
          // Zoom to the point
          map.flyTo({
            center: feature.geometry.coordinates,
            zoom: 15.5,
            duration: 2000
          });
          
          // Show popup
          const html = `
            <div class="pop-title">
              <div class="pop-region">${region}</div>
              <div class="pop-country">Uganda</div>
              <div class="pop-spacer"></div>
              <div class="pop-flag">
                <img src="assets/images/flag_uganda_square.png" alt="Uganda Flag"/>
              </div>
            </div>
            <div class="pop-image" style="display: none;">
              <img src="https://res.cloudinary.com/durzkezk9/image/upload/v1754262159/${wellID}.jpg" 
                   alt="Well Site Image" 
                   onload="this.parentElement.style.display='block'"
                   onerror="this.parentElement.style.display='none'"
                   style="width: 100%; height: auto; margin: 8px 0; border-radius: 4px;"/>
            </div>
            <div class="pop-date-line">
              <div class="pop-ID">${wellID}</div>
            </div>
            <div class="pop-date-line">
              <div class="pop-completed">Completed</div>
              <div class="pop-date">${feature.properties.date || 'Unknown'}</div>
            </div>
          `;
          
          new mapboxgl.Popup()
            .setLngLat(feature.geometry.coordinates)
            .setHTML(html)
            .addTo(map);
          
          // Clear search
          searchInput.value = '';
          resultsContainer.style.display = 'none';
        });
        
        resultItem.addEventListener('mouseenter', () => {
          resultItem.style.backgroundColor = '#f0f0f0';
        });
        
        resultItem.addEventListener('mouseleave', () => {
          resultItem.style.backgroundColor = 'white';
        });
        
        resultsContainer.appendChild(resultItem);
      });
    }
    
    resultsContainer.style.display = 'block';
  }

  // Close results when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchContainer.contains(e.target)) {
      resultsContainer.style.display = 'none';
    }
  });

  // Handle keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      resultsContainer.style.display = 'none';
      searchInput.blur();
    }
  });
}

// Initialize well search after data is loaded
function initializeWellSearch() {
  if (geojsonData.features.length > 0) {
    createWellSearch();
  }
}

// Initialize empty GeoJSON data structure
let geojsonData = {
  type: 'FeatureCollection',
  features: []
};

/**
 * Parse DMS (Degrees, Minutes, Seconds) coordinate string to decimal degrees
 * @param {string} coordStr - Coordinate string in DMS format (e.g., "1°30'45.6"N 32°15'30.2"E")
 * @returns {Object|null} - Object with lat and lon properties, or null if parsing fails
 */
function parseLatLon(coordStr) {
  // Clean input string (remove extra quotes and normalize whitespace)
  const cleaned = coordStr.replace(/"+/g, '"').replace(/\s+/g, ' ').trim();
  
  // Skip empty strings
  if (!cleaned || cleaned === '') {
    return null;
  }

  // Match DMS patterns: degrees°minutes'seconds"direction
  const regex = /(\d+)°(\d+)'([\d.]+)"([NSEW])/g;
  const coords = [];
  let match;

  while ((match = regex.exec(cleaned)) !== null) {
    const degrees = parseFloat(match[1]);
    const minutes = parseFloat(match[2]);
    const seconds = parseFloat(match[3]);
    const direction = match[4];

    // Convert DMS to decimal degrees
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

// Google Sheets configuration
const sheetId = '1FSpa8GXKtsxHiAHDRAkum0DGJJs4IAhDhevDrLkh9Bs';
const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

// Fetch and process data from Google Sheets
fetch(sheetUrl)
  .then(res => res.text())
  .then(csv => {
    // console.log('Google Sheets data received, CSV length:', csv.length);
    
    // Parse CSV data
    const rows = csv.trim().split('\n');
    const headers = rows.shift().split(',').map(h => h.replace(/^"|"$/g, '').trim());

    // Find column indices
    const coordIdx = headers.indexOf('Coords');
    const regionIdx = headers.indexOf('Region');
    const dateIdx = headers.indexOf('Date Completed');
    const wellID = headers.indexOf('Water Well ID');

    // Reset features array
    geojsonData.features = [];
    let idCounter = 0;

    // Process each row
    for (let row of rows) {
      // Parse CSV row with proper quote handling
      const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!matches || matches.length !== headers.length) continue;

      const values = matches.map(val => val.replace(/^"|"$/g, '').trim());
      const coordStr = values[coordIdx];

      // Parse coordinates
      const latLon = parseLatLon(coordStr);
      if (!latLon || !latLon.lat || !latLon.lon) {
        continue;
      }

      const { lat, lon } = latLon;
      
      // Check if coordinates are within reasonable bounds for Uganda
      if (lat < -2 || lat > 5 || lon < 29 || lon > 35) {
        continue;
      }

      // Create GeoJSON feature
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
    
    // console.log('Total features processed:', geojsonData.features.length);
    // console.log('Features to be added to map:', geojsonData.features.length);

    /**
     * Add map layers and interactions
     * This function sets up all the map layers including clusters, points, and hover effects
     */
    function addMapLayers() {
      // console.log('Adding map layers');
      
      // 1. Add the GeoJSON source with clustering enabled
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
      
          // 2. Cluster circles (grouped points)
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
        
          // 5. Individual points (unclustered)
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
              'circle-stroke-width': 2,
              'circle-stroke-color': '#0099ff'
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
              'circle-stroke-width': 2,
              'circle-stroke-color': '#0099ff'
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
        
          // 9. Hover interaction for individual points
          let hoveredFeature = null;
        
          // On mousemove over points → show hover effect
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
                // Use approximate matching for floating point coordinates
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
        
          // On leaving the points layer → clear hover effect
          map.on('mouseleave', 'points', () => {
            // Clear hover effect
            map.getSource('hover').setData({
              type: 'FeatureCollection',
              features: []
            });
            
            hoveredFeature = null;
            map.getCanvas().style.cursor = '';
          });
          
          // 10. Hover interaction for clusters
          let hoveredCluster = null;
        
          // On mousemove over clusters → show hover effect
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
          
          // On leaving the clusters layer → clear hover effect
          map.on('mouseleave', 'clusters', () => {
            // Clear hover effect
            map.getSource('hover-clusters').setData({
              type: 'FeatureCollection',
              features: []
            });
            
            hoveredCluster = null;
            map.getCanvas().style.cursor = '';
          });
        
          // 11. Click to expand clusters
          map.on('click', 'clusters', (e) => {
            // Clear hover effects immediately when cluster is clicked
            map.getSource('hover-clusters').setData({
              type: 'FeatureCollection',
              features: []
            });
            hoveredCluster = null;
            map.getCanvas().style.cursor = '';
            
            const feature = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
            map.getSource('points').getClusterExpansionZoom(feature.properties.cluster_id, (err, zoom) => {
              if (err) return;
              map.easeTo({ center: feature.geometry.coordinates, zoom });
            });
          });
        
          // 12. Click on individual points → show popup
          map.on('click', 'points', (e) => {
            const props = e.features[0].properties;
            const coords = e.features[0].geometry.coordinates.slice();
            
            const html = `
              <div class="pop-title">
                <div class="pop-region">${props.region}</div>
                <div class="pop-country">Uganda</div>
                <div class="pop-spacer"></div>
                <div class="pop-flag">
                  <img src="assets/images/flag_uganda_square.png" alt="Uganda Flag"/>
                </div>
              </div>
              <div class="pop-image" style="display: none;">
                <img src="https://res.cloudinary.com/durzkezk9/image/upload/v1754262159/${props.wellID}.jpg" 
                     alt="Well Site Image" 
                     onload="this.parentElement.style.display='block'"
                     onerror="this.parentElement.style.display='none'"
                     style="width: 100%; height: auto; margin: 8px 0; border-radius: 4px;"/>
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
    if (map.isStyleLoaded()) {
      addMapLayers();
      initializeWellSearch(); // Initialize well search after layers are added
    } else {
      map.once('load', () => {
        addMapLayers();
        initializeWellSearch(); // Initialize well search after layers are added
      });
    }
    
  });




