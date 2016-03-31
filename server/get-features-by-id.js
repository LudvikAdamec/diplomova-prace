// Located in: ./get-features-by-id.js

var nano = require('nano')('http://localhost:5984');
var pg = require('pg');

var getFeaturesById = function(req, res, client){
  var this_ = this;
  this.req = req;
  this.res = res;

  this.feature_collection = {
      "type": "FeatureCollection",
        "features": []
  };

  this.dbName = req.param('db');
  this.geomRow = req.param('geom');
  this.idColumn = req.param('idColumn');
  this.extent = req.param('extent');
  this.idsInLayer = req.param('idsInLayer');

  this.extentConverted = this.extent.map(function (x) {
    return parseFloat(x, 10);
  });

  this.extentArea = (this.extentConverted[2] - this.extentConverted[0]) * (this.extentConverted[3] - this.extentConverted[1]);

  this.layerNames = Object.keys(this.idsInLayer);
  this.layersToLoad = this.layerNames.length;

  if(client){
    this.client = client;
    this.sharedPool = true;
    this.init();
  } else {  
    var connectionString = "postgres://postgres:postgres@localhost/" + this.dbName;
    pg.connect(connectionString, function(err, client, done) {
      if (err) {
        console.log('err2', err);
      }
      this.sharedPool = false;
      this_.client = client;
      this_.done = done;
      this_.init();
    });
  }
};

getFeaturesById.prototype.init = function(){
  for (var i = 0; i < this.layerNames.length; i++) {
    if(this.idsInLayer[this.layerNames[i]] != ''){

      this.queryFeaturesById(this.layerNames[i]);

    } else {
      this.layersToLoad--;
      if(i == this.layerNames -1 && this.layersToLoad == 0){
        this.res.json({ "FeatureCollection" : this.feature_collection, "ids": this.idsInLayer, "level": this.req.param('level') });
      }
    }
  }
};

getFeaturesById.prototype.queryFeaturesById = function(layerName, ids, callback){
  var this_ = this;
  var queryString = ' SELECT ' +  this.idColumn + ' AS identificator, ' +
        " ST_XMin(ST_Transform(geometry_9,3857)) AS minx, ST_YMin(ST_Transform(geometry_9, 3857)) AS miny, ST_XMax(ST_Transform(geometry_9, 3857)) AS maxx, ST_YMax(ST_Transform(geometry_9, 3857)) AS maxy " +
        'FROM ' + layerName + ' WHERE ' + this.idColumn + ' IN(' + this.idsInLayer[layerName] + ')';


  var query = this.client.query(queryString, function(err, result) {
    if (err) {
      console.log("get-features-by-id error:", err);
    }
  });

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
    this_.callback(features);
  });
};


getFeaturesById.prototype.callback = function(features){
  this.layersToLoad--;
  for (var i = 0; i < features.length; i++) {
    this.feature_collection.features.push(features[i]);
  }

  if (this.layersToLoad == 0) {
    this.res.json({ "FeatureCollection" : this.feature_collection, "ids": this.idsInLayer, "level": this.req.param('level') });    
    
    //client.end();        
  }
};

module.exports = getFeaturesById;

