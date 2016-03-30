// Located in: ./vector-tile.js
var pg = require('pg');
var nano = require('nano')('http://localhost:5984');
var TGrid = require('./tilegrid.js');


var VectorTile = module.exports;

//console.log("ssssssssssssssssssss", new TGrid());



var existRowCache = {};

var existRowInDBCount = 0;
var existCount = 0;
var cCount = 0;


var existRowInDB = function(layerName, dbName, geomRow, callback) {
    if(!callback){
        console.log("dddddddddddddcallback callback callback", callback);
    }
    
    if (existRowCache[layerName]) {
        if (existRowCache[layerName][geomRow] != undefined) {
            if (existRowCache[layerName][geomRow] == true) {
                callback(true, layerName);
                return;
            } else {
                callback(false);
                return;
            }
        }
    } else {
        existRowCache[layerName] = {};
    }

    var connectionString = "postgres://postgres:postgres@localhost/" + dbName;
    pg.connect(connectionString, function(err, client, done) {
        existRowInDBCount++;
        var query = client.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2', [layerName, geomRow], function(err, result) {
            if (result.rowCount > 0) {
                existRowCache[layerName][geomRow] = true;
                callback(true, layerName);
            } else {
                existRowCache[layerName][geomRow] = false;
                callback(false);
            }
        });

        query.on('end', function() {
            existRowInDBCount--;
            //console.log("existRowInDBCount", existRowInDBCount);
            client.end();
            pg.end();
        });

        if (err) {
            console.log('err3', err);
        }
    });
};


var getTile = function(extent, layerName, dbName, geomRow, idColumn, callback, loadTopojsonFormat){
    if(!callback){
        console.log("callback callback callback", callback);
    }
  //existRowInDB(layerName, dbName, geomRow);
  var extentConverted = extent.map(function (x) {
    return parseFloat(x, 10);
  });

  var feature_collection = {
      "type": "FeatureCollection",
        "features": []
  };

  var envelop =  'ST_MakeEnvelope(' + extentConverted[0] + ', ' + extentConverted[1] + ', ' + extentConverted[2] + ', ' + extentConverted[3] + ', 4326)';

  
  var queryString = ' SELECT ' + idColumn + ' AS id, ' +
                  'ST_AsGeoJSON(ST_Intersection( ' + envelop + ', ' + geomRow + ' ), 6) AS geom, ' +
                  'FROM ' + layerName + ' WHERE ' + layerName + '.' + geomRow + '&&' + envelop;

  queryString = ' SELECT ' + idColumn + ' AS id, ' +
                  "ST_XMin(ST_Transform(" + geomRow + ",3857)) AS minx, ST_YMin(ST_Transform(" + geomRow + ", 3857)) AS miny, ST_XMax(ST_Transform(" + geomRow + ", 3857)) AS maxx, ST_YMax(ST_Transform(" + geomRow + ", 3857)) AS maxy, " +

                  'CASE WHEN ' + geomRow + ' @ ' + envelop + 
                    ' THEN ST_AsGeoJSON(' + geomRow + ', 6)' +
                    ' ELSE ST_AsGeoJSON(ST_Intersection( ' + envelop + ', ' + geomRow + ' ), 6) ' +
                    ' END AS geom, ' +
                   'CASE WHEN ' + envelop + ' @ ' + geomRow + 
                    ' THEN 1' +
                    ' ELSE 0' +
                    ' END AS status ' +  
                  'FROM ' + layerName + ' WHERE ' + layerName + '.' + geomRow + '&&' + envelop;
  //console.log(queryString);

  var connectionString = "postgres://postgres:postgres@localhost/" + dbName;  
  
  pg.connect(connectionString, function(err, client, done) {
    var query = client.query(queryString, function(err, result){
      if(err){
        console.log(err);
      }
    });
    // make feature from every row
    
    //console.log(query);
    query.on('row', function(row) {   
      var geom;
      geom = row.geom;

      //original_geom - true if is geometry not clipped / false for clipped
      var jsonFeature = {
        "type": "Feature",
        "properties": {
          "id": row.id,
          "status": row.status,
          "extent": [row.minx, row.miny, row.maxx, row.maxy]

        },
        "geometry": JSON.parse(geom)
      };

      if(loadTopojsonFormat){
        jsonFeature.properties.layer = layerName;
      }

      jsonFeature.properties['geomRow'] = geomRow;
      feature_collection.features.push(jsonFeature);
    });

    query.on('end', function() {
      client.end();
      //console.log("callback callback callback", callback);
      callback(feature_collection, layerName);
      pg.end();
      return 0;
    });

    if(err) {
      console.log(err);
    }
  });
};


VectorTile.renderTile = function(req, res, loadTopojsonFormat){

  var test_db;
  if(loadTopojsonFormat){
    test_db = nano.db.use('topo_multi_db');
  } else {
    test_db = nano.db.use('geo_multi_db');
  }
  var existRowCallback = function(exist, layerName){
    console.log('cccccccc', callback);
    if(exist){
      getTile([bound[1], bound[0], bound[3], bound[2]], layerName, 'vfr_instalace2',  'geometry_' + TGrid.getGeomLODforZ(xyz.z), 'ogc_fid', callback, loadTopojsonFormat);
    } else {
      layersToLoad--;
      if(layersToLoad == 0){
        res.json({ "xyz" : xyz, 'json': resObject, 'bound': bound});
      }
    }
  }

  var layersToLoad = 0;
  var resObject;

  if(loadTopojsonFormat){
    var resObject = {
      "type": "FeatureCollection",
        "features": []
    };
  } else {
    resObject = {};
  }
  
  var xyz = {
    'x': parseInt(req.param('x'), 10),
    'y': parseInt(req.param('y'), 10), 
    'z': parseInt(req.param('z'), 10)
  };

 
  //Y based on TMS not google
  //console.log("xxxxxxxxxxxxxxxxxxxxxxx", TGrid);

  var ty = TGrid.gyToTy(xyz.y, xyz.z);
  var bound = TGrid.TileLatLonBounds(xyz.x, ty, xyz.z);
  var id = xyz.x + '-' + xyz.y + '-' + xyz.z;

  var loadFromCache = false;
  if(loadFromCache){
    //ziskani dlazdice pokud je v TGrid...pokud neni tak se vygeneruje a vlozi do CouchDB TGrid
    test_db.get(id, function(err, body) {
      if (!err) {
        res.json({ "xyz" : xyz, 'json': body.FeatureCollection, 'bound': bound});
      } else {
        console.log("renderTile - ", id);
        var layers = ['obce', 'okresy', 'kraje', 'katastralniuzemi', 'parcely'];
        for (var i = 0; i < layers.length; i++) {
          layersToLoad++;
          existRowInDB(layers[i], 'vfr_instalace2', 'geometry_' + TGrid.getGeomLODforZ(xyz.z), existRowCallback);
        }
      }
    });
  } else {
    var layers = ['obce', 'okresy', 'kraje', 'katastralniuzemi', 'parcely'];
    for (var i = 0; i < layers.length; i++) {
      layersToLoad++;
      existRowInDB(layers[i], 'vfr_instalace2', 'geometry_' + TGrid.getGeomLODforZ(xyz.z), existRowCallback);
      //getTile([bound[1], bound[0], bound[3], bound[2]], layers[i], 'vfr_instalace2',  'geometry_' + TGrid.getGeomLODforZ(xyz.z), 'ogc_fid', callback, loadTopojsonFormat);
    }
  }

  var callback = function(feature_collection, layerName){   
    layersToLoad--; 
    var fCount = feature_collection.features.length;
    var jsonData = feature_collection;

    //TOPO TODO: predelat na jedno pole a dat vsechny features do nej
    //UDELAT konverzi do topojsonu
    
    if(loadTopojsonFormat){
      resObject.features = resObject.features.concat(jsonData.features);
    } else {
      resObject[layerName] = jsonData;
    }

    //console.log(resObject);

    if(layersToLoad == 0){
      if(loadTopojsonFormat){
        resObject = convertGeoToTopo(resObject);
      }
      res.json({ "xyz" : xyz, 'json': resObject, 'bound': bound});
    }

    if(fCount && layersToLoad == 0 && loadFromCache){
      var data = { 
        id: id,
        FeatureCollection: resObject
      };
    
      test_db.insert(data, id, function(err, body){
        if(err){
          console.log("errorr: ", err);
        }
      });
    }
  };
};