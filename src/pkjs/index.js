// PebbleKit JS companion for poiboi
// Proxies POI requests to OpenStreetMap Overpass API and serves a settings page.

var API_URL = 'https://overpass-api.de/api/interpreter';

Pebble.addEventListener('ready', function(e) {
  console.log('poiboi PKJS ready');
});

Pebble.addEventListener('appmessage', function(e) {
  var dict = e.payload;
  console.log('poiboi PKJS received appmessage: ' + JSON.stringify(dict));

  if (dict.request_pois) {
    var radius = dict.radius || 500;
    var lat = dict.user_lat;
    var lon = dict.user_lon;

    if (lat === undefined || lon === undefined) {
      console.log('poiboi PKJS no location provided, cannot fetch POIs');
      return;
    }

    fetchPOIs(lat, lon, radius, function(pois) {
      console.log('poiboi PKJS sending ' + pois.length + ' POIs to watch');
      if (pois.length === 0) {
        // Send a dummy POI so the watch knows the fetch completed but found nothing
        Pebble.sendAppMessage({
          poi_count: 0,
          poi_index: 0,
          poi_name: 'No POIs found',
          poi_lat: 0,
          poi_lon: 0,
          poi_dist: 0,
          poi_type: ''
        });
        return;
      }

      Pebble.sendAppMessage({ poi_count: pois.length }, function() {
        pois.forEach(function(poi, i) {
          Pebble.sendAppMessage({
            poi_index: i,
            poi_name: poi.name,
            poi_lat: poi.lat,
            poi_lon: poi.lon,
            poi_dist: poi.dist,
            poi_type: poi.type
          }, function() {
            console.log('poiboi PKJS sent POI ' + i + ': ' + poi.name);
          }, function(err) {
            console.log('poiboi PKJS failed to send POI ' + i + ': ' + err);
          });
        });
      }, function(err) {
        console.log('poiboi PKJS failed to send poi_count: ' + err);
      });
    });
  }

  if (dict.radius) {
    console.log('poiboi PKJS received radius from watch: ' + dict.radius);
  }
});

function fetchPOIs(lat, lon, radius, callback) {
  // Query amenities within radius. Using 'center' on ways/relations to get a lat/lon.
  var query = '[out:json];(node["amenity"](around:' + radius + ',' + lat + ',' + lon + ');way["amenity"](around:' + radius + ',' + lat + ',' + lon + ');relation["amenity"](around:' + radius + ',' + lat + ',' + lon + '););out center;'
  var url = API_URL + '?data=' + encodeURIComponent(query);

  console.log('poiboi PKJS fetching Overpass: ' + url);

  fetch(url).then(function(response) {
    return response.json();
  }).then(function(data) {
    var pois = [];
    if (data.elements) {
      data.elements.forEach(function(el) {
        var elLat = el.lat;
        var elLon = el.lon;
        if (el.type === 'way' || el.type === 'relation') {
          if (el.center) {
            elLat = el.center.lat;
            elLon = el.center.lon;
          }
        }
        if (el.tags && el.tags.amenity && elLat !== undefined && elLon !== undefined) {
          var d = haversine(lat, lon, elLat, elLon);
          pois.push({
            name: el.tags.name || el.tags.amenity,
            lat: elLat,
            lon: elLon,
            dist: Math.round(d),
            type: el.tags.amenity
          });
        }
      });
    }
    pois.sort(function(a, b) { return a.dist - b.dist; });
    callback(pois.slice(0, 20)); // Limit to 20 POIs
  }).catch(function(err) {
    console.log('poiboi PKJS Overpass error: ' + err);
    callback([]);
  });
}

function haversine(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Settings page
Pebble.addEventListener('showConfiguration', function() {
  var url = 'data:text/html;charset=utf-8,' + encodeURIComponent(configHTML());
  console.log('poiboi PKJS opening config');
  Pebble.openURL(url);
});

Pebble.addEventListener('webviewclosed', function(e) {
  var response = decodeURIComponent(e.response || '');
  console.log('poiboi PKJS config closed: ' + response);
  if (response && response.charAt(0) === '{') {
    try {
      var config = JSON.parse(response);
      if (config.radius) {
        Pebble.sendAppMessage({ radius: parseInt(config.radius, 10) });
      }
    } catch (err) {
      console.log('poiboi PKJS config parse error: ' + err);
    }
  }
});

function configHTML() {
  return '<!DOCTYPE html>' +
    '<html><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>poiboi settings</title>' +
    '<style>' +
    'body{font-family:sans-serif;padding:20px;text-align:center;background:#000;color:#fff;}' +
    'h2{margin-top:0;}' +
    'label{display:block;margin-bottom:8px;font-size:16px;}' +
    'select{font-size:18px;padding:10px;width:80%;max-width:300px;}' +
    'button{font-size:18px;padding:10px 20px;margin-top:20px;}' +
    '</style></head><body>' +
    '<h2>poiboi settings</h2>' +
    '<label>Search radius</label>' +
    '<select id="radius">' +
    '<option value="100">100 m</option>' +
    '<option value="250">250 m</option>' +
    '<option value="500" selected>500 m</option>' +
    '<option value="1000">1 km</option>' +
    '<option value="2000">2 km</option>' +
    '</select><br><br>' +
    '<button id="save">Save</button>' +
    '<script>' +
    'document.getElementById("save").onclick=function(){' +
    'var r=document.getElementById("radius").value;' +
    'location.href="pebblejs://close#"+encodeURIComponent(JSON.stringify({radius:r}));' +
    '};' +
    '</script></body></html>';
}
