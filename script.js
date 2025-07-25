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
      if (!latLon || !latLon.lat || !latLon.lon) continue;

      const { lat, lon } = latLon;

      geojsonData.features.push({
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
      });
    }

    if (map.getSource('points')) {
      map.getSource('points').setData(geojsonData);
    }


    // ADD MAP LAYERS INSIDE CSV FETCH 

    map.on('load', () => {
      // 1. Add the GeoJSON source (with promoteId so feature.id is usable)
      map.addSource('points', {
        type: 'geojson',
        data: geojsonData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 40,
        promoteId: 'id'
      });
    
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
    
      // 5. Unclustered points with hover-state styling
      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'points',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            'lime',      // hover color
            '#1079BF'    // default color
          ],
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff'
        }
      });
    
      // 6. Hover interaction
      let hoveredId = null;
    
      // on mousemove over points → set hover state
      map.on('mousemove', 'points', (e) => {
        if (!e.features.length) return;
    
        // clear previous hover
        if (hoveredId !== null) {
          map.setFeatureState(
            { source: 'points', id: hoveredId },
            { hover: false }
          );
        }
    
        // set new hover
        hoveredId = e.features[0].id;
        map.setFeatureState(
          { source: 'points', id: hoveredId },
          { hover: true }
        );
    
        map.getCanvas().style.cursor = 'pointer';
      });
    
      // on leaving the points layer → clear hover state
      map.on('mouseleave', 'points', () => {
        if (hoveredId !== null) {
          map.setFeatureState(
            { source: 'points', id: hoveredId },
            { hover: false }
          );
          hoveredId = null;
        }
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
    
    });
    



  });




