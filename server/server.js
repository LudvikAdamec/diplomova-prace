'use strict';
require('../bower_components/closure-library/closure/goog/bootstrap/nodejs');
goog.require('goog.array');
goog.require('goog.string');  

var memwatch = require('memwatch-next');

memwatch.on('leak', function(info) {
  console.log(info)
});

var topojson = require("topojson");

var convertGeoToTopo = function (feature_collection) {
  //var topology = topojson.topology({collection: feature_collection, propertyTransform: function propertyTransform(feature) {return feature.properties;}});
  var topology = topojson.topology({collection: feature_collection},{"property-transform":function(object){return object.properties;}});

  return topology;
};



var statistics = require('./statistics.js');

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


/******************************** SPATIAL INDEXING ROUTING ****************************************/
// Clients initialization
var getFeaturesByIdClient = undefined;
var connectionString = "postgres://postgres:postgres@localhost/" + 'vfr_instalace2';
pg.connect(connectionString, function(err, client, done) {
    if (err) {
      console.log('err2', err);
    }
  getFeaturesByIdClient = client;
});

var getFeaturesIdInBboxClient = undefined;
var featuresIdDone = undefined;
pg.connect("postgres://postgres:postgres@localhost/vfr_instalace2", function(err, client, done) {
  if (err) {
    console.log('Error v pool conn: ', err);
  }

  getFeaturesIdInBboxClient = client;
  featuresIdDone = done;
});

var clientGetGeom = undefined;
var connectionString = "postgres://postgres:postgres@localhost/" + 'vfr_instalace2';
pg.connect(connectionString, function(err, client, done) {
  if (err) {
    console.log('err2', err);
  }
  clientGetGeom = client;
});



var getFeaturesIdInBbox  = require('./get-features-id-in-bbox.js');
app.get('/getFeaturesIdInBbox', function(req, res){
  new getFeaturesIdInBbox(req, res, getFeaturesIdInBboxClient, featuresIdDone);
});

var getGeometryInLayers = require('./get-geometry-in-layers.js');
app.get('/getGeometryInLayers', function(req, res){
  new getGeometryInLayers(req, res, clientGetGeom);
});

var getFeaturesById = require('./get-features-by-id.js');
app.get('/getFeaturesByIdinLayers', function(req, res){
  new getFeaturesById(req, res, getFeaturesByIdClient);
});

/**************************************************************************************************/






/******************************** VECTOR TILE ROUTING *********************************************/
var renderTileClient = undefined;
pg.connect("postgres://postgres:postgres@localhost/vfr_instalace2", function(err, client, done) {
    if (err) {
      console.log('Error v pool conn: ', err);
    }

  renderTileClient = client;
});


/*
 * Request example: http://localhost:9001/se/renderTile?x=1&y=2&z=3
 */
var renderTile = require('./render-tile.js');
app.get('/se/renderTile', function(req, res){
  new renderTile(req, res, false);
});

/*
 * Request example: http://localhost:9001/se/renderTile?x=1&y=2&z=3
 */
app.get('/se/topojsonTile', function(req, res){
  new renderTile(req, res, true);
});
/**************************************************************************************************/




/******************************** STATISTICS SAVING ***********************************************/
var nano = require('nano')('http://localhost:5984');
app.post('/saveStatToDB', bodyParser.json(), function (req, res) {
  if (!req.body) return res.status(400).end();
  //var results_db = nano.db.use('topojson_measure_node_cache');
  var dbName = dbName = req.param('dbName');
  
  if(!dbName){
      dbName = 'geojson_measure_node_cache_pool';
  }
  var results_db = nano.db.use(dbName);

  results_db.insert(req.body, function(err, body){
    if(err){
      return res.status(500).end();
      console.log("errorr: ", err);
    } else {
      return res.status(200).end();
    }
  });
});
/**************************************************************************************************/



app.use('/', express.static(__dirname+'/../'));
app.use('/public', express.static(__dirname + '../public/'));

app.listen(9001, function() {
  console.log("Server is up");
});

