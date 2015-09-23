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


app.get('/se/getFeaturesById', function(req, res){
  var feature_collection = {
      "type": "FeatureCollection",
        "features": []
  };

  var ids = req.param('ids');

  var queryString = ' SELECT ids AS id, ST_AsGeoJSON(geom_4326) AS geom  FROM parcelswgs WHERE ids IN(' + ids + ')';

  var connectionString = "postgres://postgres:postgres@localhost/vfr";
  pg.connect(connectionString, function(err, client, done) {
      var query = client.query(queryString);

      // Stream results back one row at a time
      query.on('row', function(row) {
        var jsonFeature = {
          "type": "Feature",
          "properties": {
            "id": row.id
          },
          "geometry": JSON.parse(row.geom)
        };

        feature_collection.features.push(jsonFeature);
      });

      query.on('end', function() {
          client.end();
          res.json({ "FeatureCollection" : feature_collection, "ids": ids });
      });

      if(err) {
        console.log(err);
      }

  });



});

var iterate = 0;

app.get('/se/getFeaturesIdInBbox', function(req, res){
   var extent = req.param('extent');
   var extentConverted = extent.map(function (x) {
      return parseFloat(x, 10);
   });

   //todo: predelat na intersects
  var queryString = ' SELECT ogc_fid FROM parcelswgs WHERE parcelswgs.geom_4326 && ST_MakeEnvelope(' + extentConverted[0] + ', ' + extentConverted[1] + ', ' + extentConverted[2] + ', ' + extentConverted[3] + ', 4326)' ;

  var connectionString = "postgres://postgres:postgres@localhost/vfr";
  var results = [];
  pg.connect(connectionString, function(err, client, done) {
      var query = client.query(queryString);

      query.on('row', function(row) {
          results.push(row.ogc_fid);
      });

      query.on('end', function() {
          client.end();
          res.json({ "featuresId" : results, "z": 17, "lon": 5, "lat": 5});
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

