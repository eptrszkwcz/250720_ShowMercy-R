mapboxgl.accessToken = 'pk.eyJ1IjoicHRyc3prd2N6IiwiYSI6ImNpdHVuOXpqMzAwMmEybnF2anZwbTd4aWcifQ.MF8M3qBg0AEp_-10FB4juw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/ptrszkwcz/cmd5h7xz9031i01rf79ux2nxy',
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
          date: values[dateIdx]
        }
      });
    }

    if (map.getSource('points')) {
      map.getSource('points').setData(geojsonData);
    }


    // ADD MAP LAYERS INSIDE CSV FETCH 

    // Add layer when the map loads
    map.on('load', () => {

      map.addSource('points', {
        type: 'geojson',
        data: geojsonData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 40,
        promoteId: 'id',
      });
    
      // … your existing clusters + cluster-count + point-shadow layers …
    
      // Unclustered individual points (with hover color = lime green)
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
            'lime',       // hover color
            '#1079BF'     // default color
          ],
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff'
        }
      });
    
      let hoveredFeatureId = null;

      map.on('mousemove', 'points', (e) => {
        // bail if no feature
        if (!e.features.length || e.features[0].id == null) return;

        // clear previous hover
        if (hoveredFeatureId !== null) {
          map.setFeatureState(
            { source: 'points', id: hoveredFeatureId },
            { hover: false }
          );
        }

        // set new hover
        hoveredFeatureId = e.features[0].id;
        map.setFeatureState(
          { source: 'points', id: hoveredFeatureId },
          { hover: true }
        );
      });

      map.on('mouseleave', 'points', () => {
        if (hoveredFeatureId !== null) {
          map.setFeatureState(
            { source: 'points', id: hoveredFeatureId },
            { hover: false }
          );
          hoveredFeatureId = null;
        }
        map.getCanvas().style.cursor = '';
      });

      map.on('mouseenter', 'points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      // CLUSTERS
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
          'text-color': '#ffffff',
        }
      });
      
      // Shadow for unclustered points
      map.addLayer({
        id: 'point-shadow',
        type: 'circle',
        source: 'points',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 8,
          'circle-color': '#000000',
          'circle-opacity': 0.3,
          'circle-blur': 0.6
        }
      });

      // // Unclustered individual points
      // map.addLayer({
      //   id: 'points',
      //   type: 'circle',
      //   source: 'points',
      //   filter: ['!', ['has', 'point_count']],
      //   paint: {
      //     'circle-radius': 6,
      //     'circle-color': [
      //       'case',
      //       ['boolean', ['feature-state', 'hover'], false],
      //       '#0099FF', // 💙 Hover color
      //       '#1079BF'  // Default color
      //     ],
      //     'circle-opacity': 0.8,
      //     'circle-stroke-width': 1,
      //     'circle-stroke-color': '#fff'
      //   }
      // });


      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['clusters']
        });
        const clusterId = features[0].properties.cluster_id;
        map.getSource('points').getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
      
          map.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom
          });
        });
      });

      map.on('click', 'points', (e) => {
        const props = e.features[0].properties;
        const coordinates = e.features[0].geometry.coordinates.slice();
        const popupContent = `
          <div class = "pop-title">
            <div class = "pop-region">${props.region}</div>
            <div class = "pop-country">Uganda</div>
            <div class="pop-flag">
              <img src="assets/images/flag_uganda_square.png" alt="Uganda Flag" />
            </div>
          </div>

          <div class = "pop-date-line">
            <div class = "pop-completed">Completed</div>
            <div class = "pop-date">${props.date}</div>
            
          </div>
        `;
        new mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(popupContent)
          .addTo(map);
      });

      map.on('mouseenter', 'points', () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', 'points', () => map.getCanvas().style.cursor = '');

      map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');
    });



  });




