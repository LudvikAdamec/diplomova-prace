'use strict';
goog.provide('vectorTileLoader');

goog.require('ol.proj');
goog.require('goog.asserts');
goog.require('goog.array');
goog.require('ol.source.MultiLevelVector');


var that;

/**
 * [vectorTileLoader description]
 * @param  {[type]} url       [description]
 * @param  {[type]} layerName [description]
 * @return {[type]}           [description]
 */
vectorTileLoader = function(params) {
    var dbParams = params.db;
    this.url = dbParams.url;
    this.layerName = dbParams.layerName;
    this.dbname = dbParams.dbname;
    this.geomRow = dbParams.geomColumn;
    this.idColumn = dbParams.idColumn;

    this.loadedContentSize = 0;
    this.remaining = 0;
    this.tileGrid = ol.tilegrid.createXYZ({
      tileSize: 256
    });

    this.loadingExtents = 0;

    this.vtCache = [];

    this.geojsonFormat = new ol.format.GeoJSON({
      defaultDataProjection: 'EPSG:4326'
    });

    this.mergeTool = new mergeTools({
      "featureFormat": this.geojsonFormat
    });

    that = this;

    this.source;


}

vectorTileLoader.prototype.loaderFunction = function(extent, resolution, projection) {
  that.source = this;
  console.log("that", that);
  if(this.loadingExtents == 0){
    timeStart = new Date();
  }

  //loadingStatusChange({"statusMessage": 'loading <i class="fa fa-spinner fa-spin"></i>'});
  var level = ol.source.MultiLevelVector.prototype.getLODforRes(resolution);
  that.loadingExtents++;
  that.load(extent, level, projection, that.callback, resolution, this);
};

vectorTileLoader.prototype.geojsonFeatureToLayer = function(feature, layer, level ) {
  var olFeature =  this.geojsonFormat.readFeature(feature, {featureProjection: 'EPSG:3857'});
  this.source.addFeature(olFeature);
};

vectorTileLoader.prototype.callback = function(responseFeatures, level, decrease, message, zoom, this_){
  //this = this_;
  var loadTopojsonFormat = false;

    var totalTime = 0;  
    var timeStart = 0;
    var timeFinish = 0;
    var mergingStarted = 0;
    var mergingFinished = 0;
    var totalMergeTime = 0;

  if(!level){
    level = this_.source.getLODforZ(zoom);
  }

  this_.loadingExtents--;

  /*if (this_.loadingExtents == 0) {
      timeFinish = new Date();

  };

  loadingStatusChange({
    "statusExtents": loadingExtents, 
    "loadingTime": new Date() - timeStart
  });

  var contentSize = Math.round(vtLoader.loadedContentSize * 100) / 100;
    loadingStatusChange({
      "sizeMessage": contentSize + 'mb'
    });
  */

  if(!loadTopojsonFormat){
    /*if(loadingExtents == 0){
      var contentSize = Math.round(vtLoader.loadedContentSize * 100) / 100;
      console.log("contentSize:", contentSize);
      loadingStatusChange({
        "statusMessage": 'Doba nacteni vsech dlazdic: ' + timeFinish - timeStart + ' s - ' + 'extent loaded <i class="fa fa-check"></i>', 
        "sizeMessage": contentSize + 'mb'
      });

      loadingStatusChange({
        "statusExtents": loadingExtents,
        "loadingTime": timeFinish - timeStart
      });

    }*/

    for (var j = 0; j < responseFeatures.length; j++) {
      var id = responseFeatures[j].properties.id;
      if(this_.vtCache.indexOf(id) == -1){
        this_.vtCache.push(id);
        this_.geojsonFeatureToLayer(responseFeatures[j]);
      }

      this_.mergeTool.addFeaturesOnLevel(responseFeatures[j], level);        
    }
  } else {
    for (var j = 0; j < responseFeatures.objects.collection.geometries.length; j++) {
      var feature = responseFeatures.objects.collection.geometries[j];

      var id = feature.properties.id;
      if(this_.vtCache.indexOf(id) == -1){
        this_.vtCache.push(id);
        console.log(responseFeatures[j]);
        var f = {
          type: "Feature",
          properties: feature.properties,
          geometry: {
            "type": "Polygon",
            "coordinates": []
          }
        };
        
        this_.geojsonFeatureToLayer(f);
      }     
    }
    this_.mergeTool.addTopoJsonFeaturesOnLevel(responseFeatures, level);   
  }

  //if(/*loadingExtents < 1 && */this.mergeTool.featuresToMergeOnLevel[level].length){
    //loadingStatusChange({"statusMessage": 'merging <i class="fa fa-spinner fa-spin"></i>'});
  if(this_.loadingExtents < 1 && this_.mergeTool.topojsonOnLevel[level] && this_.mergeTool.topojsonOnLevel[level].length){
    console.log("merge");
    mergingStarted = new Date();
    this_.mergeTool.mergeTopojsons(this_.mergeCallback, level);
    mergingFinished = new Date();
    totalMergeTime += mergingFinished - mergingStarted;
    loadingStatusChange({"mergingTime": totalMergeTime});
    this_.source.changed();
  }

  if(this_.loadingExtents < 1 && this_.mergeTool.featuresToMergeOnLevel[level] && this_.mergeTool.featuresToMergeOnLevel[level].length){
    console.log("merge");
    mergingStarted = new Date();
    this_.mergeTool.merge(this_.mergeCallback, level, this_);
    mergingFinished = new Date();
    totalMergeTime += mergingFinished - mergingStarted;
    //loadingStatusChange({"mergingTime": totalMergeTime});
    this_.source.changed();
  }
};

vectorTileLoader.prototype.mergeCallback = function(responseObject, that){
  if(responseObject.mergingFinished){
    //loadingStatusChange({"statusMessage": '<i class="fa fa-check"></i>'});
    //mergingFinished = new Date();
    //loadingStatusChange({"mergingTime": totalMergeTime});
  } else {
      var olFeatures = that.source.getFeatures();
      var olFeature = goog.array.find(olFeatures, function(f) {
        return f.get('id') === responseObject.feature.properties.id;
      });
      goog.asserts.assert(!!olFeature);
      if(olFeature){
        
        //funcionality for decreasing count of setgeometry on feature
        var active_geom = olFeature.get('active_geom');
        if(active_geom === responseObject.feature.properties.geomRow){
          olFeature.setGeometry(responseObject.geometry);
        }
        
        olFeature.set(responseObject.feature.properties.geomRow, responseObject.geometry);
      }
  }
};




/**
 * loader fuction make request on server for getting Identificators for features in extent
 * @param  {[type]}   extent     [description]
 * @param  {[type]}   resolution [description]
 * @param  {[type]}   projection [description]
 * @param  {[type]}   level       [description]
 * @param  {Function} callback   [description]
 * @return {[type]}              [description]
 */
vectorTileLoader.prototype.load = function(extent, level, projection, callback, resolution) {
  var this_ = this;
  var a = ol.proj.toLonLat([extent[0], extent[1]]);
  var b = ol.proj.toLonLat([extent[2], extent[3]]);

  this.remaining++;


  this.geomRow = 'geometry_' + level; //this.getLODIdForResolution(resolution);

  var data = {
    "layer": this.layerName,
    "db": this.dbname,
    "geom": this.geomRow,
    "idColumn": this.idColumn,
    "level": level,
    "requestType": "getTiledGeomInBBOX",
    "extent": [a[0], a[1], b[0], b[1]]
  };

  //minX, minY, maxX, maxY
  var z = this.tileGrid.getZForResolution(resolution);
  var x = (extent[0] + (extent[2] - extent[0]) / 2);
  var y = (extent[1] + (extent[3] - extent[1]) / 2);

  //POZOR - generuje schema XYZ podle GOOGLE XYZ schematu ne podle TMS - http://wiki.osgeo.org/wiki/Tile_Map_Service_Specification
  var xyz = this.tileGrid.getTileCoordForXYAndResolution_(extent[0] + 10, extent[1] + 10, resolution);

  var dataXYZ = {
    'y': (xyz[2] * -1), 
    'x': xyz[1],
    'z': xyz[0]
  };

  var loadFromCouchDB = false;
  var loadTopojsonFormat = false;

  if(loadFromCouchDB){
    $.ajax({
      url: 'http://127.0.0.1:5984/test_db/' + dataXYZ.x + '-' + dataXYZ.y + '-' + dataXYZ.z,
      type: "get",
      datatype: 'json',
      success: function(data, status, xhr){
        var data = JSON.parse(data);
        this_.loadedContentSize += parseInt(xhr.getResponseHeader('Content-Length')) / (1024 * 1024);
        this_.remaining--;
        var z = parseInt(/[^-]*$/.exec(data._id)[0], 10);
        callback(data.FeatureCollection.features, undefined, 'first', "DF_ID", z);
      },
      error:function(er){
        return console.log("chyba: ", er);
      }   
    });
  } else {
    $.ajax({
      url: 'http://localhost:9001/se/renderTile',
      type: "get",
      data: dataXYZ,
      datatype: 'json',
      success: function(data, status, xhr){
        this_.loadedContentSize += parseInt(xhr.getResponseHeader('Content-Length')) / (1024 * 1024);
        this_.remaining--;
        if(loadTopojsonFormat){
          callback(data.json, undefined, 'first', "DF_ID", data.xyz.z, this_);
        } else {
          callback(data.json.features, undefined, 'first', "DF_ID", data.xyz.z, this_);
        }
      },
      error:function(er){
        return console.log("chyba: ", er);
      }   
    });  
  }

  //getTileCoordForCoordAndZ(coordinate, z, opt_tileCoord
  /*
  $.ajax({
    url: this_.url + data.requestType,
    type: "get",
    data: data,
    datatype: 'json',
    success: function(data, status, xhr){
      //this_.loadedContentSize += parseInt(xhr.getResponseHeader('Content-Length')) / (1024 * 1024);
      //this_.remaining--;
      //callback(data.FeatureCollection.features, data.level, 'first', "DF_ID");
    },
    error:function(er){
      console.log("xxxxx");
      callback([]);
      return console.log("chyba: ", er);
    }   
  }); 
  */
};
