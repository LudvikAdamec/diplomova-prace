// Located in: ./TileGrid.js

var TileGrid = module.exports;

var tileSize = 256;
var initialResolution = 156543.03392804062;  //2 * Math.PI * 6378137 /  tileSize
var originShift = 2 * Math.PI * 6378137 / 2.0;

TileGrid.Resolution = function(zoom){
  //"Resolution (meters/pixel) for given zoom level (measured at Equator)"
  //return (2 * Math.PI * 6378137) / ( tileSize * 2**zoom)
  return initialResolution / (Math.pow(2,zoom));
}

TileGrid.PixelsToMeters = function(px, py, zoom){
  //"Converts pixel coordinates in given zoom level of pyramid to EPSG:900913"
  var res = this.Resolution( zoom );
  var mx = px * res - originShift;
  var my = py * res - originShift;
  return [mx, my]
};

TileGrid.MetersToLatLon = function(mx, my){
  //"Converts XY point from Spherical Mercator EPSG:900913 to lat/lon in WGS84 Datum"
  var lon = (mx / originShift) * 180.0;
  var lat = (my / originShift) * 180.0;
  lat = 180 / Math.PI * (2 * Math.atan( Math.exp( lat * Math.PI / 180.0)) - Math.PI / 2.0);
  return [lat, lon]
};

TileGrid.TileBounds = function(tx, ty, zoom){
  //"Returns bounds of the given tile in EPSG:900913 coordinates"
  var minx = this.PixelsToMeters( tx * tileSize, ty * tileSize, zoom )[0]; 
  var miny = this.PixelsToMeters( tx * tileSize, ty * tileSize, zoom )[1];
  var maxx = this.PixelsToMeters( (tx+1) * tileSize, (ty+1) * tileSize, zoom )[0];
  var maxy = this.PixelsToMeters( (tx+1) * tileSize, (ty+1) * tileSize, zoom )[1];
  return [minx, miny, maxx, maxy];
};

TileGrid.TileLatLonBounds = function(tx, ty, zoom ){
  //"Returns bounds of the given tile in latutude/longitude using WGS84 datum"
  var bounds = this.TileBounds( tx, ty, zoom);
  var minLat = this.MetersToLatLon(bounds[0], bounds[1])[0];
  var minLon = this.MetersToLatLon(bounds[0], bounds[1])[1];
  var maxLat = this.MetersToLatLon(bounds[2], bounds[3])[0];
  var maxLon = this.MetersToLatLon(bounds[2], bounds[3])[1];

  return [ minLat, minLon, maxLat, maxLon ];
};

TileGrid.gyToTy = function(gy, zoom){
  return (Math.pow(2,zoom) - 1 ) - gy
};

TileGrid.getGeomLODforZ = function(zoom){
  if(zoom >= 20){
  } else if(zoom >= 20){
    return 20;
  } else if(zoom >= 19){
    return 19;
  } else if(zoom >= 18){
    return 18;
  } else if(zoom >= 17){
    return 17;
  } else if(zoom >= 16){
    return 16;
  } else if(zoom >= 15){
    return 15;
  } else if(zoom >= 14){
    return 14;
  } else if(zoom >= 13){
    return 13;
  } else if(zoom >= 12){
    return 12;
  } else if(zoom >= 11){
    return 11;
  } else if(zoom >= 10){
    return 10;
  } else if(zoom >= 9){
    return 9;
  } else if(zoom >= 8){
    return 8;
  } else if(zoom >= 7){
    return 7;
  }

  if (zoom > 17 ){
    return 9;
  } else if(zoom >= 17){
    return 8;
  } else if(zoom >= 16){
    return 7;
  } else if(zoom >= 15){
    return 6;
  } else if(zoom >= 14){
    return 5;
  } else if(zoom >= 13){
    return 4;
  } else if(zoom >= 12){
    return 3;
  } else if(zoom >= 11){
    return 2;
  } else if(zoom >= 10){
    return 1;
  } else {
    return 1;
  }
};