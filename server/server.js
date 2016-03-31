'use strict';
require('../bower_components/closure-library/closure/goog/bootstrap/nodejs');
goog.require('goog.array');
goog.require('goog.string');  

var memwatch = require('memwatch-next');

memwatch.on('leak', function(info) {
  console.log(info)
});

var statistics = require('./statistics.js');
//var vTile  = require('./vector-tile.js');

//console.log(vTile);

//console.log(statistics.loadDatabaseDocs('geojson_sis_node_cache'));
//console.log(statistics.loadDatabaseDocs('geojson_measure_node_cache'));



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

app.use(
    "/compile", //the URL throught which you want to access to you static content
    express.static('client/public') //where your static content is located in your filesystem
);

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
     ' CASE   WHEN area > ' + (extentArea * 2) + ' THEN 1 ELSE 0 END AS needclip ' +
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
  //console.log('query');
  var existRowCallback = function(exist, layerName){
    var queryString;
    if(exist){
      if(clipBig == "true"){
        var extentArea = (extentConverted[2] - extentConverted[0]) * (extentConverted[3] - extentConverted[1]);

        //todo: predelat efektivne na intersects
        queryString = ' SELECT ' + idColumn + ', ' +
         ' CASE   WHEN area > ' + (extentArea * 2) + ' THEN 1 ELSE 0 END AS needclip ' +
         ' FROM ' + layerName + 
         ' WHERE ' + layerName + '.' + geomRow + '&&' + envelop  ;

      } else {
        queryString = "" +
          ' SELECT ' + idColumn +
          ' FROM ' + layerName + 
          ' WHERE ' + layerName + '.' + geomRow + '&&' + envelop ;
      }
      
      var query = client.query(queryString, function(err, content){
        if(err){
          console.log('err', err);
        }
      });
      
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
   
  existRowCallback(true, layerName);
  //existRowInDB(layerName, dbName, geomRow, existRowCallback);
};

var needToDo = 0;
var dones = 0;

var handleGetFeaturesIdInBboxForLayers = function(req, res){
  needToDo++;
  //console.log("++");
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
        //console.log(existCountRequests, needToDo);
        if(existCountRequests == 0){
          //needToDo--;
          dones++;
          //console.log("res; remain: ", needToDo, " x ", dones);
          res.json({ "layers" : results, "extent": extent, "level": req.param('level') });
          client.end();
        }
      };
      //console.log("befc");
      queryGetFeaturesIdInBboxForLayers(client, dbName, layerName, idColumn, geomRow, extent, extentConverted, envelop, clipBig, results, callback);
    }
  });  
}; 


var getFeaturesId  = require('./get-features-id.js');

var featuresIdClient = undefined;
var featuresIdDone = undefined;
//var connectionString = "postgres://postgres:postgres@localhost/vfr_instalace2";
pg.connect("postgres://postgres:postgres@localhost/vfr_instalace2", function(err, client, done) {
    if (err) {
      console.log('Error v pool conn: ', err);
    }

  featuresIdClient = client;
  featuresIdDone = done;
    //this_.init();
});


app.get('/se/getFeaturesIdInBboxForLayers', function(req, res){
  //handleGetFeaturesIdInBboxForLayers(req, res, featuresIdClient);
  new getFeaturesId(req, res, featuresIdClient, featuresIdDone);
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


var clientGetGeom = undefined;
var getGeometry = require('./new-get-geometry.js');

var connectionString = "postgres://postgres:postgres@localhost/" + 'vfr_instalace2';
pg.connect(connectionString, function(err, client, done) {
    if (err) {
      console.log('err2', err);
    }

  clientGetGeom = client;
    //this_.init();
});

/*
 * Request example: http://localhost:9001/se/renderTile?x=1&y=2&z=3
 */
app.get('/se/getGeometryInLayers', function(req, res){
  new getGeometry(req, res, clientGetGeom);
});


app.get('/se/getGeometryInLayersOLD', function(req, res) {
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


    var extentConverted = extent.map(function(x) {
        return parseFloat(x, 10);
    });

    extent = extentConverted;

    var extentArea = (extent[2] - extent[0]) * (extent[3] - extent[1]);
    var layerNames = Object.keys(idsInLayer);
    var layersToLoad = 0;//layerNames.length;
    //layersToLoadSum = layersToLoadSum + layersToLoad;
    var ready = false;

    var connectionString = "postgres://postgres:postgres@localhost/" + dbName;
    pg.connect(connectionString, function(err, client, done) {
        if (err) {
            console.log('err2', err);
        }

        var callback = function(features) {
            //dWait++;
            for (var i = 0; i < features.length; i++) {
                feature_collection.features.push(features[i]);
            }

            layersToLoad--;
            
            if (layersToLoad <= 0) {
                res.json({
                    "FeatureCollection": feature_collection,
                    "ids": idsInLayer,
                    "level": req.param('level')
                });
                client.end();
            }
        };

        for (var i = 0; i < layerNames.length; i++) {
            if(i == layerNames.length - 1 ){
                ready = true;
            }
            layersToLoad++;
            if (idsInLayer[layerNames[i]] != '') {
                queryGeometryInLayers(client, layerNames[i], idColumn, idsInLayer[layerNames[i]], geomRow, extent, extentArea, clipBig, callback);
            } else {
                callback([]);
                /*dWait++;
              layersToLoad--;
              //console.log("layersToLoad", layersToLoad);
              if(layersToLoad == 0){
                resDone++;
                res.json({ 
                  "FeatureCollection" : feature_collection,
                  "ids": idsInLayer, 
                  "level": req.param('level') 
                });
                client.end();
              }*/
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
  var queryString = ' SELECT ' + idColumn + ' AS identificator, ' +
        " ST_XMin(ST_Transform(geometry_9,3857)) AS minx, ST_YMin(ST_Transform(geometry_9, 3857)) AS miny, ST_XMax(ST_Transform(geometry_9, 3857)) AS maxx, ST_YMax(ST_Transform(geometry_9, 3857)) AS maxy " +
        'FROM ' + layerName + ' WHERE ' + idColumn + ' IN(' + ids + ')';

  var query = client.query(queryString);
  var features = [];

  query.on('row', function(row) {
    var jsonFeature = {
      "type": "Feature",
      "properties": {
        "id": row.identificator,
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


app.get('/se/getFeaturesByIdinLayersOLD', function(req, res){
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
        
        queryFeaturesById(client, layerNames[i], idColumn, idsInLayer[layerNames[i]], callback);
       
      } else {
        layersToLoad--;
        if(i == layerNames -1 && layersToLoad == 0){
          res.json({ "FeatureCollection" : feature_collection, "ids": idsInLayer, "level": req.param('level') });
        }
      }
    }

  });

});




var getFeaturesByIdClient = undefined;
var getFeaturesByIdddd = require('./get-features-by-id.js');

var connectionString = "postgres://postgres:postgres@localhost/" + 'vfr_instalace2';
pg.connect(connectionString, function(err, client, done) {
    if (err) {
      console.log('err2', err);
    }
  getFeaturesByIdClient = client;
});

app.get('/se/getFeaturesByIdinLayers', function(req, res){
  new getFeaturesByIdddd(req, res, getFeaturesByIdClient);
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


var existRowCache = {};

var existRowInDB = function(layerName, dbName, geomRow, callback) {
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
            client.end();
            pg.end();
        });

        if (err) {
            console.log('err3', err);
        }
    });
};


var nano = require('nano')('http://localhost:5984');

//var NT = require('./new-tile.js');
var NT = require('./new-tile-shared-connection.js');


var vtClient = undefined;
//var connectionString = "postgres://postgres:postgres@localhost/vfr_instalace2";
pg.connect("postgres://postgres:postgres@localhost/vfr_instalace2", function(err, client, done) {
    if (err) {
      console.log('Error v pool conn: ', err);
    }

  vtClient = client;
    //this_.init();
});


/*
 * Request example: http://localhost:9001/se/renderTile?x=1&y=2&z=3
 */
app.get('/se/renderTile', function(req, res){
  new NT(req, res, false);
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
  var dbName = dbName = req.param('dbName');
  
  if(!dbName){
      dbName = 'geojson_measure_node_cache_pool';
  }
  var results_db = nano.db.use(dbName);

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

