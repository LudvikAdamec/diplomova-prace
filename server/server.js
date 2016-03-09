'use strict';
require('../bower_components/closure-library/closure/goog/bootstrap/nodejs');
goog.require('goog.array');
goog.require('goog.string');  

var memwatch = require('memwatch-next');

memwatch.on('leak', function(info) {
  console.log(info)
});

//memwatch.on('stats', function(stats) {console.log(stats)});

var pg = require('pg'),
  grunt = require('grunt'),
  express = require('express'),
  app = express(),
  fs = require("fs"),
  plovrVars = require('./../tasks/util/get-plovr-vars.js'),
  plovrIds = plovrVars.plovrIds,
  bodyParser = require('body-parser')


app.use('/client/src/', function(req, res, next) {
  var filePath = req.path;
  if(goog.string.endsWith(filePath, '/')) {
    filePath = filePath + 'index.html';
  }
  filePath = 'client/src' + filePath;
  if(goog.string.endsWith(filePath, '.html') && fs.existsSync(filePath)) {
    var cnt = fs.readFileSync(filePath);
    cnt += "";
    cnt = cnt.replace(/^(.*<link.* href=['"])([^'"]+)(['"].*\/(link)?>.*$)/gmi,
        function(match, prePath, path, postPath) {
          // CSS
          if(path.indexOf('http://localhost:9810/css/')===0) {
            var plovrId = path.substring(26, path.length-1);
            if(goog.string.caseInsensitiveEndsWith(plovrId, '-debug')) {
              plovrId = plovrId.substring(0, plovrId.length-6);
            }
            var plovrConfig = grunt.file.readJSON(plovrIds[plovrId]);
            var srcCssFiles = plovrConfig['css-inputs'];
            var result = srcCssFiles.join(postPath + "\n" + prePath);
            result = prePath + result + postPath;
          } else {
            result = match;
          }
          return result;
        });
    
    res.set('Content-Type', 'text/html');
    res.send(cnt);
  } else {
    next();
  }
});

app.get('/se/getFeaturesIdInBbox', function(req, res){
  var extent = req.param('extent'),
      layerName = req.param('layer'),
      dbName = req.param('db'),
      geomRow = req.param('geom'),
      idColumn = req.param('idColumn'),
      clipBig = req.param('clipBig');

  var extentConverted = extent.map(function (x) {
    return parseFloat(x, 10);
  });

  var envelop =  'ST_MakeEnvelope(' + extentConverted[0] + ', ' + extentConverted[1] + ', ' + extentConverted[2] + ', ' + extentConverted[3] + ', 4326)';

  
  if(clipBig == "true"){
    var extentArea = (extentConverted[2] - extentConverted[0]) * (extentConverted[3] - extentConverted[1]);

    //todo: predelat efektivne na intersects
    var queryString = ' SELECT ' + idColumn + ', ' +
     ' CASE   WHEN ST_Area(' + geomRow + ' ) > ' + (extentArea * 2) + ' THEN 1 ELSE 0 END AS needclip ' +
     ' FROM ' + layerName + 
     ' WHERE ' + layerName + '.' + geomRow + '&&' + envelop  ;

  } else {
    var queryString = "" +
      ' SELECT ' + idColumn +
      ' FROM ' + layerName + 
      ' WHERE ' + layerName + '.' + geomRow + '&&' + envelop ;
  }

  var connectionString = "postgres://postgres:postgres@localhost/" + dbName;
  var results = {};

  pg.connect(connectionString, function(err, client, done) {
      var query = client.query(queryString);

      query.on('row', function(row) {
        if(clipBig == "true"){
          results[row[idColumn]] = row['needclip'];
        } else {
          results[row[idColumn]] = false;
        }
      });

      query.on('end', function() {
          client.end();
          res.json({ "featuresId" : results, "extent": extent, "level": req.param('level') });
      });


      if(err) {
        console.log(err);
      }
  });

});


var queryGetFeaturesIdInBboxForLayers = function(client, dbName, layerName, idColumn, geomRow, extent, extentConverted, envelop, clipBig, results, callback){

  var existRowCallback = function(exist, layerName){
    var queryString;
    if(exist){
      if(clipBig == "true"){
        var extentArea = (extentConverted[2] - extentConverted[0]) * (extentConverted[3] - extentConverted[1]);

        //todo: predelat efektivne na intersects
        queryString = ' SELECT ' + idColumn + ', ' +
         ' CASE   WHEN ST_Area(' + geomRow + ' ) > ' + (extentArea * 2) + ' THEN 1 ELSE 0 END AS needclip ' +
         ' FROM ' + layerName + 
         ' WHERE ' + layerName + '.' + geomRow + '&&' + envelop  ;

      } else {
        queryString = "" +
          ' SELECT ' + idColumn +
          ' FROM ' + layerName + 
          ' WHERE ' + layerName + '.' + geomRow + '&&' + envelop ;
      }
      
      var query = client.query(queryString);
      
      query.on('row', function(row) {
        if(clipBig == "true"){
          results[layerName][row[idColumn]] = row['needclip'];
        } else {
          results[layerName][row[idColumn]] = false;
        }
      });
      
      query.on('end', function() {
          callback();          
      });

    } else {
      callback();
    }

  };
  existRowInDB(layerName, dbName, geomRow, existRowCallback);
};

app.get('/se/getFeaturesIdInBboxForLayers', function(req, res){

  var extent = req.param('extent'),
      layers = req.param('layers'),
      dbName = req.param('db'),
      geomRow = req.param('geom'),
      idColumn = req.param('idColumn'),
      clipBig = req.param('clipBig');

  var extentConverted = extent.map(function (x) {
    return parseFloat(x, 10);
  });

  var envelop =  'ST_MakeEnvelope(' + 
                    extentConverted[0] + ', ' + 
                    extentConverted[1] + ', ' + 
                    extentConverted[2] + ', ' + 
                    extentConverted[3] + ', 4326)';

  var connectionString = "postgres://postgres:postgres@localhost/" + dbName;
  var results = {};

  var existCountRequests;
  pg.connect(connectionString, function(err, client, done) {
    if(err) {
      console.log('err: ', err);
    }

    existCountRequests = layers.length;
    for (var i = 0; i < layers.length; i++) {
      var layerName = layers[i];
      results[layers[i]] = {};

      var callback = function(){
        existCountRequests--;
        if(existCountRequests == 0){
          res.json({ "layers" : results, "extent": extent, "level": req.param('level') });
          client.end();
        }
      };

      queryGetFeaturesIdInBboxForLayers(client, dbName, layerName, idColumn, geomRow, extent, extentConverted, envelop, clipBig, results, callback);
    }
  });

});


var queryGeometryInLayers = function(client, layerName, idColumn, ids, geomRow, extent, extentArea, clipBig, callback){
  var queryString;
  var features = [];
  if(clipBig != "true"){
    queryString = 'SELECT ' + idColumn + ' AS id, ' + 
                    "ST_AsGeoJSON(' + geomRow + ', 5) AS geom, " +
                    "ST_XMin(geometry_9) AS minx, " + 
                    "ST_YMin(geometry_9) AS miny, " + 
                    "ST_XMax(geometry_9) AS maxx, " + 
                    "ST_YMax(geometry_9) AS maxy " +
                  'FROM ' + layerName + ' WHERE ' + idColumn + ' IN(' + ids + ')';
  } else {
    var envelop = "ST_MakeEnvelope(" + extent[0] + ", " + extent[1] + ", " + extent[2] + ", " + extent[3] + ", 4326)";
    queryString = "" +  
    "SELECT " + 
      idColumn + " AS id, " +
      "ST_AsGeoJSON(" + geomRow + ", 6) AS geom, " +
      "CASE   WHEN ST_Area(" + geomRow + " ) > " + (extentArea * 2) + 
      " THEN ST_AsGeoJSON(ST_Intersection( " + envelop + ", " + geomRow + " ), 6)" +
      " ELSE 'null'" +
      " END AS clipped_geom, " + 
      "CASE   WHEN ST_Area(" + geomRow + " ) <= " + (extentArea * 2) + 
      " THEN " + "ST_AsGeoJSON(" + geomRow + ", 6 ) "  +
      " ELSE 'null' " +
      " END AS original_geom " +
    "FROM " + layerName + " " +
    "WHERE " + idColumn + " IN(" + ids + ")";
  }  

  var query = client.query(queryString, function(err, content){
    if(err){
      console.log('err',err);
    }
  });

  query.on('row', function(row) {        
    var geom;

    if(clipBig != "true"){
      geom = row.geom;
    } else {
      if(row.clipped_geom == 'null') {
        geom = row.original_geom;
      } else {
        geom = row.clipped_geom;
      }
    }

    var jsonFeature = {
      "type": "Feature",
      "properties": {
        "id": row.id,
        "layer": layerName
      },
      "geometry": JSON.parse(geom)
    };


    jsonFeature.properties['geomRow'] = geomRow;

    if(row.clipped_geom == 'null') {
      jsonFeature.properties['original_geom'] = true;
    } else {
      jsonFeature.properties['original_geom'] = false;
    }

    features.push(jsonFeature);
  });

  query.on('end', function() {
    callback(features);
  });

};
  
app.get('/se/getGeometryInLayers', function(req, res){
  var feature_collection = {
      "type": "FeatureCollection",
        "features": []
  };
  
  var layerName = req.param('layer');
  var dbName = req.param('db');
  var geomRow = req.param('geom');
  var idColumn = req.param('idColumn');
  var clipBig = req.param('clipBig');
  var extent = req.param('extent');
  var idsInLayer = req.param('idsInLayer');

  
  var extentConverted = extent.map(function (x) {
    return parseFloat(x, 10);
  });

  extent = extentConverted;

  var extentArea = (extent[2] - extent[0]) * (extent[3] - extent[1]);
  var layerNames = Object.keys(idsInLayer);
  var layersToLoad = layerNames.length;

  var connectionString = "postgres://postgres:postgres@localhost/" + dbName;  
  pg.connect(connectionString, function(err, client, done) {
    if(err) {
      console.log('err2',err);
    }

    for (var i = 0; i < layerNames.length; i++) {
      if(idsInLayer[layerNames[i]] != ''){
        
        var callback = function(features){
          for (var i = 0; i < features.length; i++) {
            feature_collection.features.push(features[i]);
          }

          layersToLoad--;
          if(layersToLoad == 0){
            res.json({ 
              "FeatureCollection" : feature_collection,
              "ids": idsInLayer, 
              "level": req.param('level') 
            });
            client.end();
          }
        };

        queryGeometryInLayers(client, layerNames[i], idColumn, idsInLayer[layerNames[i]], geomRow, extent, extentArea, clipBig,callback);

      } else {
        layersToLoad--;
        if(layersToLoad == 0){
          res.json({ 
            "FeatureCollection" : feature_collection,
            "ids": idsInLayer, 
            "level": req.param('level') 
          });
          client.end();
        }
      }
    }


  });
});

app.get('/se/getGeometry', function(req, res){
  //console.log("getGeometry");
  var feature_collection = {
      "type": "FeatureCollection",
        "features": []
  };
  
  var ids = req.param('ids');
  var layerName = req.param('layer');
  var dbName = req.param('db');
  var geomRow = req.param('geom');
  var idColumn = req.param('idColumn');
  var clipBig = req.param('clipBig');
  var extent = req.param('extent');

  var extentConverted = extent.map(function (x) {
    return parseFloat(x, 10);
  });

  extent = extentConverted;

  var extentArea = (extent[2] - extent[0]) * (extent[3] - extent[1]);
  var queryString;

  if(clipBig != "true"){
    queryString = ' SELECT ' + idColumn + ' AS id, ST_AsGeoJSON(' + geomRow + ', 5) AS geom, ' +
                  "ST_XMin(geometry_9) AS minx, ST_YMin(geometry_9) AS miny, ST_XMax(geometry_9) AS maxx, ST_YMax(geometry_9) AS maxy " +
                  'FROM ' + layerName + ' WHERE ' + idColumn + ' IN(' + ids + ')';
  } else {
    var envelop = "ST_MakeEnvelope(" + extent[0] + ", " + extent[1] + ", " + extent[2] + ", " + extent[3] + ", 4326)";
    queryString = "" +  
      "SELECT " + 
        idColumn + " AS id, " +
        "ST_AsGeoJSON(" + geomRow + ", 6) AS geom, " +
        "CASE   WHEN ST_Area(" + geomRow + " ) > " + (extentArea * 2) + 
          " THEN ST_AsGeoJSON(ST_Intersection( " + envelop + ", " + geomRow + " ), 6)" +
          " ELSE 'null'" +
          " END AS clipped_geom, " + 
        "CASE   WHEN ST_Area(" + geomRow + " ) <= " + (extentArea * 2) + " THEN " + "ST_AsGeoJSON(" + geomRow + ", 6 ) "  +
          " ELSE 'null' " +
          " END AS original_geom " +
       "FROM " + layerName + " " +
       "WHERE " + idColumn + " IN(" + ids + ")";
  }  

  var connectionString = "postgres://postgres:postgres@localhost/" + dbName;  
  pg.connect(connectionString, function(err, client, done) {
    var query = client.query(queryString);
    // make feature from every row
    query.on('row', function(row) {        
      var geom;

      if(clipBig != "true"){
        geom = row.geom;
      } else {
        if(row.clipped_geom == 'null') {
          geom = row.original_geom;
        } else {
          geom = row.clipped_geom;
        }
      }

      //original_geom - true if is geometry not clipped / false for clipped
      var jsonFeature = {
        "type": "Feature",
        "properties": {
          "id": row.id
        },
        "geometry": JSON.parse(geom)
      };


      jsonFeature.properties['geomRow'] = geomRow;

      if(row.clipped_geom == 'null') {
        jsonFeature.properties['original_geom'] = true;
      } else {
        jsonFeature.properties['original_geom'] = false;
      }

      feature_collection.features.push(jsonFeature);
    });

    query.on('end', function() {
        client.end();
        res.json({ "FeatureCollection" : feature_collection, "ids": ids, "geomRow": geomRow ,"level": req.param('level') });
    });

    if(err) {
      console.log(err);
    }
  });
});

//TODO: kouknout na jinou moznost prenosu nez GeoJSON...nutno predelat import do OL3
app.get('/se/getFeaturesById', function(req, res){
  //console.log("getFeaturesById");

  var feature_collection = {
      "type": "FeatureCollection",
        "features": []
  };

  var ids = req.param('ids');
  var layerName = req.param('layer');
  var dbName = req.param('db');
  var geomRow = req.param('geom');
  var idColumn = req.param('idColumn');
  var extent = req.param('extent');

  var extentConverted = extent.map(function (x) {
    return parseFloat(x, 10);
  });

  extent = extentConverted;

  var extentArea = (extent[2] - extent[0]) * (extent[3] - extent[1]);
  var queryString;

  queryString = ' SELECT ' + idColumn + ' AS id, ' +
                " ST_XMin(ST_Transform(geometry_9,3857)) AS minx, ST_YMin(ST_Transform(geometry_9, 3857)) AS miny, ST_XMax(ST_Transform(geometry_9, 3857)) AS maxx, ST_YMax(ST_Transform(geometry_9, 3857)) AS maxy " +
                'FROM ' + layerName + ' WHERE ' + idColumn + ' IN(' + ids + ')';

  var connectionString = "postgres://postgres:postgres@localhost/" + dbName;

  pg.connect(connectionString, function(err, client, done) {
      var query = client.query(queryString);
      // make feature from every row
      query.on('row', function(row) {  
        var jsonFeature = {
          "type": "Feature",
          "properties": {
            "id": row.id,
            "extent": [row.minx, row.miny, row.maxx, row.maxy]
          },
          "geometry":  {
            "type": "Polygon",
            "coordinates": []
          }
        };

        feature_collection.features.push(jsonFeature);
      });

      //console.log(JSON.stringify(feature_collection));

      query.on('end', function() {
          client.end();
          res.json({ "FeatureCollection" : feature_collection, "ids": ids, "level": req.param('level') });
      });

      if(err) {
        console.log(err);
      }
  });
});


var queryFeaturesById = function(client, layerName, idColumn, ids, callback){
  var queryString = ' SELECT ' + idColumn + ' AS id, ' +
        " ST_XMin(ST_Transform(geometry_9,3857)) AS minx, ST_YMin(ST_Transform(geometry_9, 3857)) AS miny, ST_XMax(ST_Transform(geometry_9, 3857)) AS maxx, ST_YMax(ST_Transform(geometry_9, 3857)) AS maxy " +
        'FROM ' + layerName + ' WHERE ' + idColumn + ' IN(' + ids + ')';

  var query = client.query(queryString);
  var features = [];

  query.on('row', function(row) {
    var jsonFeature = {
      "type": "Feature",
      "properties": {
        "id": row.id,
        "extent": [row.minx, row.miny, row.maxx, row.maxy],
        "layer": layerName
      },
      "geometry":  {
        "type": "Polygon",
        "coordinates": []
      }
    };
    features.push(jsonFeature);
  });

  query.on('end', function() {
    callback(features);
  });
}


app.get('/se/getFeaturesByIdinLayers', function(req, res){
  var feature_collection = {
      "type": "FeatureCollection",
        "features": []
  };

  var dbName = req.param('db');
  var geomRow = req.param('geom');
  var idColumn = req.param('idColumn');
  var extent = req.param('extent');
  var idsInLayer = req.param('idsInLayer');

  var extentConverted = extent.map(function (x) {
    return parseFloat(x, 10);
  });

  var extentArea = (extentConverted[2] - extentConverted[0]) * (extentConverted[3] - extentConverted[1]);

  var layerNames = Object.keys(idsInLayer);
  var layersToLoad = layerNames.length;
  var connectionString = "postgres://postgres:postgres@localhost/" + dbName;

  pg.connect(connectionString, function(err, client, done) {

    for (var i = 0; i < layerNames.length; i++) {
      if(idsInLayer[layerNames[i]] != ''){
        var callback = function(features){
            layersToLoad--;
            for (var i = 0; i < features.length; i++) {
              feature_collection.features.push(features[i]);
            }
          
            if (layersToLoad == 0) {
              res.json({ "FeatureCollection" : feature_collection, "ids": idsInLayer, "level": req.param('level') });    
              client.end();        
            }
        };
        
        queryFeaturesById(client, layerNames, idColumn, idsInLayer[layerNames[i]], callback);
       
      } else {
        layersToLoad--;
        if(i == layerNames -1 && layersToLoad == 0){
          res.json({ "FeatureCollection" : feature_collection, "ids": idsInLayer, "level": req.param('level') });
        }
      }
    }

  });

});

app.get('/se/getTiledGeomInBBOX', function(req, res){
  var extent = req.param('extent'),
      layerName = req.param('layer'),
      dbName = req.param('db'),
      geomRow = req.param('geom'),
      idColumn = req.param('idColumn');

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
                  "ST_XMin(ST_Transform(geometry_9,3857)) AS minx, ST_YMin(ST_Transform(geometry_9, 3857)) AS miny, ST_XMax(ST_Transform(geometry_9, 3857)) AS maxx, ST_YMax(ST_Transform(geometry_9, 3857)) AS maxy, " +

                  'CASE WHEN ' + geomRow + ' @ ' + envelop + 
                    ' THEN ST_AsGeoJSON(' + geomRow + ', 6)' +
                    ' ELSE ST_AsGeoJSON(ST_Intersection( ' + envelop + ', ' + geomRow + ' ), 6) ' +
                    ' END AS geom, ' +
                   'CASE WHEN ' + envelop + ' @ ' + geomRow + 
                    ' THEN 1' +
                    ' ELSE 0' +
                    ' END AS status ' +  
                  'FROM ' + layerName + ' WHERE ' + layerName + '.' + geomRow + '&&' + envelop;

  var connectionString = "postgres://postgres:postgres@localhost/" + dbName;  
  
  pg.connect(connectionString, function(err, client, done) {
    var query = client.query(queryString);
    // make feature from every row
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

      //console.log(jsonFeature);

      jsonFeature.properties['geomRow'] = geomRow;
      feature_collection.features.push(jsonFeature);
    });

    query.on('end', function() {
        client.end();
        res.json({ "FeatureCollection" : feature_collection, "geomRow": geomRow ,"level": req.param('level') });
    });

    if(err) {
      console.log(err);
    }
  });

});




/*************        TILECACHE          ****************/
var topojson = require("topojson");

var convertGeoToTopo = function (feature_collection) {
  //var topology = topojson.topology({collection: feature_collection, propertyTransform: function propertyTransform(feature) {return feature.properties;}});
  var topology = topojson.topology({collection: feature_collection},{"property-transform":function(object){return object.properties;}});

  return topology;
};

var existRowInDBCount = 0;
var existCount = 0;
var cCount = 0;


var existRowCache = {};

var existRowInDB = function(layerName, dbName, geomRow, callback){
  if(existRowCache[layerName]){
    if(existRowCache[layerName][geomRow] != undefined){
      if(existRowCache[layerName][geomRow] == true){
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
    var query = client.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2', [layerName, geomRow], function(err, result) {
      if(result.rowCount > 0){
        existRowCache[layerName][geomRow] = true;
        callback(true, layerName);
      } else {
        existRowCache[layerName][geomRow] = false;
        callback(false);
      }
    });

    query.on('end', function() {
      client.end();
      pg.end();
    });

    if(err) {
      console.log('err3', err);
    }
  });
};

var getTile = function(extent, layerName, dbName, geomRow, idColumn, callback, loadTopojsonFormat){
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
      callback(feature_collection, layerName);
      pg.end();
      return 0;
    });

    if(err) {
      console.log(err);
    }
  });
};

var tileCache = (function () {
    function tileCache(message) {
      this.tileSize = 256;
      this.initialResolution = 156543.03392804062;  //2 * Math.PI * 6378137 / this.tileSize
      // 156543.03392804062 for tileSize 256 pixels
      this.originShift = 2 * Math.PI * 6378137 / 2.0;
    }
    
    tileCache.prototype.Resolution = function(zoom){
      //"Resolution (meters/pixel) for given zoom level (measured at Equator)"
      //return (2 * Math.PI * 6378137) / (this.tileSize * 2**zoom)
      return this.initialResolution / (Math.pow(2,zoom));
    }

    tileCache.prototype.PixelsToMeters = function(px, py, zoom){
      //"Converts pixel coordinates in given zoom level of pyramid to EPSG:900913"
      var res = this.Resolution( zoom );
      var mx = px * res - this.originShift;
      var my = py * res - this.originShift;
      return [mx, my]
    };

    tileCache.prototype.MetersToLatLon = function(mx, my){
      //"Converts XY point from Spherical Mercator EPSG:900913 to lat/lon in WGS84 Datum"
      var lon = (mx / this.originShift) * 180.0;
      var lat = (my / this.originShift) * 180.0;
      lat = 180 / Math.PI * (2 * Math.atan( Math.exp( lat * Math.PI / 180.0)) - Math.PI / 2.0);
      return [lat, lon]
    };

    tileCache.prototype.TileBounds = function(tx, ty, zoom){
      //"Returns bounds of the given tile in EPSG:900913 coordinates"
      var minx = this.PixelsToMeters( tx*this.tileSize, ty*this.tileSize, zoom )[0]; 
      var miny = this.PixelsToMeters( tx*this.tileSize, ty*this.tileSize, zoom )[1];
      var maxx = this.PixelsToMeters( (tx+1)*this.tileSize, (ty+1)*this.tileSize, zoom )[0];
      var maxy = this.PixelsToMeters( (tx+1)*this.tileSize, (ty+1)*this.tileSize, zoom )[1];
      return [minx, miny, maxx, maxy];
    };

    tileCache.prototype.TileLatLonBounds = function(tx, ty, zoom ){
      //"Returns bounds of the given tile in latutude/longitude using WGS84 datum"
      var bounds = this.TileBounds( tx, ty, zoom);
      var minLat = this.MetersToLatLon(bounds[0], bounds[1])[0];
      var minLon = this.MetersToLatLon(bounds[0], bounds[1])[1];
      var maxLat = this.MetersToLatLon(bounds[2], bounds[3])[0];
      var maxLon = this.MetersToLatLon(bounds[2], bounds[3])[1];

      return [ minLat, minLon, maxLat, maxLon ];
    };

    tileCache.prototype.gyToTy = function(gy, zoom){
      return (Math.pow(2,zoom) - 1 ) - gy
    };

    tileCache.prototype.getGeomLODforZ = function(zoom){
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

    return tileCache;
})();

var nano = require('nano')('http://localhost:5984');

var renderTile = function(req, res, loadTopojsonFormat){

  var test_db;
  if(loadTopojsonFormat){
    test_db = nano.db.use('topo_multi_db');
  } else {
    test_db = nano.db.use('geo_multi_db');
  }
  var existRowCallback = function(exist, layerName){
    if(exist){
      getTile([bound[1], bound[0], bound[3], bound[2]], layerName, 'vfr_instalace2',  'geometry_' + cache.getGeomLODforZ(xyz.z), 'ogc_fid', callback, loadTopojsonFormat);
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

  var cache = new tileCache();
  
  //Y based on TMS not google
  var ty = cache.gyToTy(xyz.y, xyz.z);
  var bound = cache.TileLatLonBounds(xyz.x, ty, xyz.z);
  var id = xyz.x + '-' + xyz.y + '-' + xyz.z;

  var loadFromCache = true;
  if(loadFromCache){
    //ziskani dlazdice pokud je v cache...pokud neni tak se vygeneruje a vlozi do CouchDB cache
    test_db.get(id, function(err, body) {
      if (!err) {
        res.json({ "xyz" : xyz, 'json': body.FeatureCollection, 'bound': bound});
      } else {
        console.log("renderTile - ", id);
        var layers = ['obce', 'okresy', 'kraje', 'katastralniuzemi', 'parcely'];
        for (var i = 0; i < layers.length; i++) {
          layersToLoad++;
          existRowInDB(layers[i], 'vfr_instalace2', 'geometry_' + cache.getGeomLODforZ(xyz.z), existRowCallback);
        }
      }
    });
  } else {
    var layers = ['obce', 'okresy', 'kraje', 'katastralniuzemi', 'parcely'];
    for (var i = 0; i < layers.length; i++) {
      layersToLoad++;
      existRowInDB(layers[i], 'vfr_instalace2', 'geometry_' + cache.getGeomLODforZ(xyz.z), existRowCallback);
      //getTile([bound[1], bound[0], bound[3], bound[2]], layers[i], 'vfr_instalace2',  'geometry_' + cache.getGeomLODforZ(xyz.z), 'ogc_fid', callback, loadTopojsonFormat);
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

    if(fCount && layersToLoad == 0){
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

/*
 * Request example: http://localhost:9001/se/renderTile?x=1&y=2&z=3
 */
app.get('/se/renderTile', function(req, res){
  renderTile(req, res, false);
});


/*
 * Request example: http://localhost:9001/se/renderTile?x=1&y=2&z=3
 */
app.get('/se/topojsonTile', function(req, res){
  renderTile(req, res, true);
});


app.post('/saveStatToDB', bodyParser.json(), function (req, res) {
  if (!req.body) return res.status(400).end();
  //var results_db = nano.db.use('topojson_measure_node_cache');
  var results_db = nano.db.use('geojson_measure_node_cache');

  console.log(req.body);
  results_db.insert(req.body, function(err, body){
    if(err){
      return res.status(500).end();
      console.log("errorr: ", err);
    } else {
      return res.status(200).end();
    }
  });
});




app.use('/', express.static(__dirname+'/../'));
app.use('/public', express.static(__dirname + '../public/'));

app.listen(9001, function() {
  console.log("Server is up");
});

