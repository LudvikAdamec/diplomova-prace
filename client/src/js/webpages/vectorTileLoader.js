'use strict';
goog.provide('vectorTileLoader');

goog.require('ol.proj');
goog.require('goog.asserts');
goog.require('goog.array');
goog.require('ol.source.MultiLevelVector');
goog.require('logInfo');
goog.require('measureTool');

var that;

/**
 * [vectorTileLoader description]
 * @param  {[type]} url       [description]
 * @param  {[type]} layerName [description]
 * @return {[type]}           [description]
 */
vectorTileLoader = function(params) {
    console.log(params);

    var dbParams = params.db;
    this.url = dbParams.url;
    this.dbname = dbParams.dbname;
    this.geomRow = dbParams.geomColumn;
    this.idColumn = dbParams.idColumn;
    this.logger = new logInfo();

    //this.layerName = params.layers[0].name;

    this.layers = params.layers;

    this.loadedContentSize = 0;
    this.remaining = 0;
    this.tileGrid = ol.tilegrid.createXYZ({
      tileSize: 256
    });

    this.loadingExtents = 0;

    this.vtCache = [];

    this.vtLayerCache = {};

    this.geojsonFormat = new ol.format.GeoJSON({
      defaultDataProjection: 'EPSG:4326'
    });

    this.mergeTool = new mergeTools({
      "featureFormat": this.geojsonFormat
    });
    
    this.activeMeasuring = false;
    this.measuringTool = new measureTool({});


    //DBEUG toto asi neni uplne spravne....zrejme to udela globalni promennou
    that = this;

    this.format = 'topojson';
    this.format = 'geojson';

    this.source;


}

vectorTileLoader.prototype.loaderFunction = function(extent, resolution, projection) {
  that.source = this;
  //console.log("that", that);
  if(that.loadingExtents == 0){
    timeStart = new Date();
    console.log(timeStart);
  }

  that.logger.loadingStatusChange({"statusMessage": 'loading <i class="fa fa-spinner fa-spin"></i>'});
  var zoom = that.tileGrid.getZForResolution(resolution);
  var level = ol.source.MultiLevelVector.prototype.getLODforZ(zoom);
  that.loadingExtents++;
  that.load(extent, level, projection, that.callback, resolution, this);
};

vectorTileLoader.prototype.geojsonFeatureToLayer = function(feature, layer) {
  var olFeature =  this.geojsonFormat.readFeature(feature, {featureProjection: 'EPSG:3857'});
  layer.addFeature(olFeature);
};

var totalTime = 0;  
var timeStart = new Date();
var timeFinish = 0;
var mergingStarted = 0;
var mergingFinished = 0;
var totalMergeTime = 0;

var lastLoadingExtents;

var fromLastLoading;

var restartTimer;
function startTimer() {
    restartTimer = setTimeout(function(){ location.reload(); }, 30000);
}
function stopTimer() {
    clearTimeout(restartTimer);
}

vectorTileLoader.prototype.callback = function(responseFeatures, level, decrease, message, zoom, this_){
  stopTimer();
  startTimer();
  if(!level){
    level = this_.source.getLODforZ(zoom);
  }

  this_.loadingExtents--;

  if(this_.loadingExtents > 1){
    if(fromLastLoading) {
      if(fromLastLoading - new Date() > 20000){
        location.reload();
      }
    }
    fromLastLoading = new Date();
  }


  if (this_.loadingExtents == 0) {
      timeFinish = new Date();
  };

  var contentSize = Math.round(this_.loadedContentSize * 100) / 100;
  this_.logger.loadingStatusChange({
    "statusExtents": this_.loadingExtents, 
    "loadingTime": new Date() - timeStart,
    "sizeMessage": contentSize + 'mb'
  });
  

  if(this_.format != 'topojson'){
    if(this_.loadingExtents == 0){
      var contentSize = Math.round(this_.loadedContentSize * 100) / 100;
      console.log("contentSize:", contentSize);
      this_.logger.loadingStatusChange({
        "statusMessage": 'Doba nacteni vsech dlazdic: ' + timeFinish - timeStart + ' s - ' + 'extent loaded <i class="fa fa-check"></i>', 
        "sizeMessage": contentSize + 'mb'
      });

      this_.logger.loadingStatusChange({
        "statusExtents": this_.loadingExtents,
        "loadingTime": timeFinish - timeStart
      });

    }

    // REFACTOROVAT - PODMINKA DODELAT i pro single layer
    var aha = Object.keys(responseFeatures);

    for(var m = 0; m < aha.length; m++){
      var features = responseFeatures[aha[m]].features;
      if(!this_.vtLayerCache[aha[m]]){
        this_.vtLayerCache[aha[m]] = [];
      }
   
      for (var j = 0; j < features.length; j++) {
        var id = features[j].properties.id;
        if(this_.vtLayerCache[aha[m]].indexOf(id) == -1){
          this_.vtLayerCache[aha[m]].push(id);
          this_.geojsonFeatureToLayer(features[j], this_.layers[aha[m]]);
        }

        this_.mergeTool.addFeaturesOnLevelInLayer(features[j], level, aha[m]);        
      }
    }
  } else {
    for (var j = 0; j < responseFeatures.objects.collection.geometries.length; j++) {

      var feature = responseFeatures.objects.collection.geometries[j];

      if(!this_.vtLayerCache[feature.properties.layer]){
        this_.vtLayerCache[feature.properties.layer] = [];
      }

      var id = feature.properties.id;
      if(this_.vtLayerCache[feature.properties.layer].indexOf(id) == -1){
        this_.vtLayerCache[feature.properties.layer].push(id);
        var f = {
          type: "Feature",
          properties: feature.properties,
          geometry: {
            "type": "Polygon",
            "coordinates": []
          }
        };
        
        this_.geojsonFeatureToLayer(f, this_.layers[feature.properties.layer]);
      }     
    }

     //TOPO TODO: kontrola jestli to takto muze zustat
    this_.mergeTool.addTopoJsonFeaturesOnLevel(responseFeatures, level);   
  }

  if(lastLoadingExtents != undefined && lastLoadingExtents != 0 && this_.loadingExtents < lastLoadingExtents){
    return 0;
  }

  //MULTIPLE LAYERS in tile - geojson
  if(this_.loadingExtents < 5){
    lastLoadingExtents = this_.loadingExtents;
    if(this_.mergeTool.featuresToMergeOnLevelInLayer[level]){
      var layers = Object.keys(this_.mergeTool.featuresToMergeOnLevelInLayer[level]);
      for (var n = 0; n < layers.length; n++) {
        if(this_.mergeTool.featuresToMergeOnLevelInLayer[level][layers[n]].length){
          mergingStarted = new Date();
           this_.mergeTool.merge(this_.mergeMultipleCallback, level, this_);
          mergingFinished = new Date();
          totalMergeTime += mergingFinished - mergingStarted;
          this_.logger.loadingStatusChange({"mergingTime": totalMergeTime});
          this_.source.changed();
          break;
        }
      }
      
      if (this_.activeMeasuring) {
          this_.measuringTool.addResults((mergingStarted - timeStart), totalMergeTime);
          timeStart = new Date();
          totalMergeTime = 0;
          this_.measuringTool.measureNextProperty();
      } else {
          timeStart = new Date();
          totalMergeTime = 0;
      }
    }
  }  

  //SINGLE and MULTIPLE LAYERS in tile - topojson
  if(this_.loadingExtents < 5 && this_.mergeTool.topojsonOnLevel[level] && this_.mergeTool.topojsonOnLevel[level].length){
    lastLoadingExtents = this_.loadingExtents;
    console.log("merge");
    mergingStarted = new Date();
    this_.mergeTool.mergeTopojsons(this_.mergeMultipleCallback, level, this_);
    mergingFinished = new Date();
    totalMergeTime += mergingFinished - mergingStarted;
    this_.logger.loadingStatusChange({"mergingTime": totalMergeTime});
    this_.source.changed();

      if (this_.activeMeasuring) {
          this_.measuringTool.addResults((mergingStarted - timeStart), totalMergeTime);
          timeStart = new Date();
          totalMergeTime = 0;
          this_.measuringTool.measureNextProperty();
      } else {
        timeStart = new Date();
        totalMergeTime = 0;
      }
  }

  //SINGLE LAYER in tile - geojson
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

vectorTileLoader.prototype.mergeMultipleCallback = function(responseObject, that, layerName){
  if(responseObject.mergingFinished){
    //loadingStatusChange({"statusMessage": '<i class="fa fa-check"></i>'});
    //mergingFinished = new Date();
    //loadingStatusChange({"mergingTime": totalMergeTime});
  } else {
    var source = that.layers[layerName];
    if (source) {
      var olFeatures = source.getFeatures();
      var olFeature = goog.array.find(olFeatures, function(f) {
        return f.get('id') === responseObject.feature.properties.id;
      });

      if(!olFeature){
        console.log(responseObject.feature.properties.id);
      }

      goog.asserts.assert(!!olFeature);
      if(olFeature){
        
        //funcionality for decreasing count of setgeometry on feature
        var active_geom = olFeature.get('active_geom');
        if(active_geom === responseObject.feature.properties.geomRow){
          olFeature.setGeometry(responseObject.geometry);
        }
        
        olFeature.set(responseObject.feature.properties.geomRow, responseObject.geometry);
      }
    } else {
      console.log("error - no reference on ol3 layer object");
    }

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
    var url;

    if(this_.format == 'topojson'){
      url = 'http://localhost:9001/se/topojsonTile';
    } else {
       url = 'http://localhost:9001/se/renderTile';
    }

    $.ajax({
      url: url,
      type: "get",
      data: dataXYZ,
      datatype: 'json',
      success: function(data, status, xhr){
        this_.loadedContentSize += parseInt(xhr.getResponseHeader('Content-Length')) / (1024 * 1024);
        this_.remaining--;
        if(loadTopojsonFormat){
          callback(data.json, undefined, 'first', "DF_ID", data.xyz.z, this_);
        } else {
          callback(data.json, undefined, 'first', "DF_ID", data.xyz.z, this_);
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
