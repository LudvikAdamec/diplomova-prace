'use strict';
require('../bower_components/closure-library/closure/goog/bootstrap/nodejs');
goog.require('goog.array');
goog.require('goog.string');  

var pg = require('pg');

var grunt = require('grunt');

var express = require('express');
var app = express();
var fs = require("fs");

var plovrVars = require('./../tasks/util/get-plovr-vars.js');
var plovrIds = plovrVars.plovrIds;

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
     ' CASE   WHEN ST_Area(' + geomRow + ' ) > ' + (extentArea * 0.1) + ' THEN 1 ELSE 0 END AS needclip ' +
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
        "CASE   WHEN ST_Area(" + geomRow + " ) > " + (extentArea * 1) + 
          " THEN ST_AsGeoJSON(ST_Intersection( " + envelop + ", " + geomRow + " ), 6)" +
          " ELSE 'null'" +
          " END AS clipped_geom, " + 
        "CASE   WHEN ST_Area(" + geomRow + " ) <= " + (extentArea * 1) + " THEN " + "ST_AsGeoJSON(" + geomRow + ", 6 ) "  +
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

  console.log('xxxxxxxxxxxxxxxxxxxx');
  var connectionString = "postgres://postgres:postgres@localhost/" + dbName;  
  console.log(queryString);
  console.log(connectionString);
  
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








app.use('/', express.static(__dirname+'/../'));
app.use('/public', express.static(__dirname + '../public/'));

app.listen(9001, function() {
  console.log("Server is up");
});

