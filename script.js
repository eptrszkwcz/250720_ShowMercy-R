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


// Function to parse DMS to decimal
function parseDMS(dmsStr) {
  const regex = /(\d+)°(\d+)'([\d.]+)"?([NSEW])/g;
  let match, coords = [];

  while ((match = regex.exec(dmsStr)) !== null) {
    let d = parseFloat(match[1]);
    let m = parseFloat(match[2]);
    let s = parseFloat(match[3]);
    let dir = match[4];

    let decimal = d + m / 60 + s / 3600;
    if (dir === 'S' || dir === 'W') decimal *= -1;
    coords.push(decimal);
  }

  return coords.length === 2 ? { lat: coords[0], lon: coords[1] } : null;
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

    for (let row of rows) {
      const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!matches || matches.length !== headers.length) continue;

      const values = matches.map(val => val.replace(/^"|"$/g, '').trim());
      const coordStr = values[coordIdx];
      const { lat, lon } = parseLatLon(coordStr)
      if (!lat) continue;

      geojsonData.features.push({
        type: 'Feature',
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
  });

// Add layer when the map loads
map.on('load', () => {

  map.addSource('points', {
    type: 'geojson',
    data: geojsonData,
    cluster: true,
    clusterMaxZoom: 14, // Max zoom to cluster points
    clusterRadius: 40   // Radius of each cluster in pixels
  });
  
  // Cluster circles
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
        15, 10,
        20, 30,
        25
      ],
      'circle-opacity': 0.8,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fff'
    }
  });
  
  // Cluster count labels
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

  // Unclustered individual points
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

  // HOVER FUNCTIONALITY

  // map.addLayer({
  //   id: 'cluster-hov',
  //   type: 'circle',
  //   source: 'points',
  //   filter: ['has', 'point_count'],
  //   paint: {
  //     'circle-color': [
  //       'case',
  //       ['boolean', ['feature-state', 'hover'], false],
  //       '#ADD8E6', // light blue on hover
  //       '#ff7f50'  // default coral color (or whatever your default is)
  //     ],
  //     'circle-radius': [
  //       'step',
  //       ['get', 'point_count'],
  //       20,
  //       10,
  //       30,
  //       30,
  //       40
  //     ],
  //     'circle-opacity': 0.8
  //   }
  // });
  
  // map.addLayer({
  //   id: 'unclustered-point-hov',
  //   type: 'circle',
  //   source: 'points',
  //   filter: ['!', ['has', 'point_count']],
  //   paint: {
  //     'circle-color': [
  //       'case',
  //       ['boolean', ['feature-state', 'hover'], false],
  //       '#ADD8E6', // light blue on hover
  //       '#4169e1'  // default royal blue
  //     ],
  //     'circle-radius': 6,
  //     'circle-opacity': 0.8,
  //     'circle-stroke-width': 1,
  //     'circle-stroke-color': '#fff'
  //   }
  // });
  
  

  // WITHOUT CLUSTERING
  // map.addSource('points', {
  //   type: 'geojson',
  //   data: geojsonData, // initially empty
  // });

  // map.addLayer({
  //   id: 'point-shadow',
  //   type: 'circle',
  //   source: 'points',
  //   paint: {
  //     'circle-radius': 8,
  //     'circle-color': '#000000',
  //     'circle-opacity': 0.3,
  //     'circle-blur': 0.6
  //   }
  // });

  // map.addLayer({
  //   id: 'points',
  //   type: 'circle',
  //   source: 'points',
  //   paint: {
  //     'circle-radius': 6,
  //     'circle-color': '#1079BF',
  //     'circle-opacity': 0.8,
  //     'circle-stroke-width': 1,
  //     'circle-stroke-color': '#fff'
  //   }
  // });

  map.on('click', 'clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['cluster']
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
});


// let hoveredFeatureId = null;

// // Hover on unclustered points
// map.on('mousemove', 'unclustered-point', (e) => {
//   if (e.features.length > 0) {
//     if (hoveredFeatureId !== null) {
//       map.setFeatureState({ source: 'points', id: hoveredFeatureId }, { hover: false });
//     }
//     hoveredFeatureId = e.features[0].id;
//     map.setFeatureState({ source: 'points', id: hoveredFeatureId }, { hover: true });
//   }
// });

// map.on('mouseleave', 'unclustered-point', () => {
//   if (hoveredFeatureId !== null) {
//     map.setFeatureState({ source: 'points', id: hoveredFeatureId }, { hover: false });
//     hoveredFeatureId = null;
//   }
// });

// // Hover on clusters
// map.on('mousemove', 'clusters', (e) => {
//   if (e.features.length > 0) {
//     if (hoveredFeatureId !== null) {
//       map.setFeatureState({ source: 'points', id: hoveredFeatureId }, { hover: false });
//     }
//     hoveredFeatureId = e.features[0].id;
//     map.setFeatureState({ source: 'points', id: hoveredFeatureId }, { hover: true });
//   }
// });

// map.on('mouseleave', 'clusters', () => {
//   if (hoveredFeatureId !== null) {
//     map.setFeatureState({ source: 'points', id: hoveredFeatureId }, { hover: false });
//     hoveredFeatureId = null;
//   }
// });


