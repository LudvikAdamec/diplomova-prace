'use strict';
goog.provide('spatialIndexLoader');

goog.require('ol.source.MultiLevelVector');
goog.require('ol.proj');
goog.require('goog.asserts');
goog.require('goog.array');


/**
 * [spatialIndexLoader description]
 * @param  {[type]} url       [description]
 * @param  {[type]} layerName [description]
 * @return {[type]}           [description]
 */
spatialIndexLoader = function(params) {
    var dbParams = params.db;
    this.url = dbParams.url;
    this.layerName = dbParams.layerName;
    this.dbname = dbParams.dbname;
    this.geomRow = dbParams.geomColumn;
    this.idColumn = dbParams.idColumn;

    this.layers = params.layers;


    this.tileGrid = ol.tilegrid.createXYZ({
      tileSize: 256
    });

    this.loadedContentSize = 0;

    this.cacheIdByLevel = {};
    this.cacheIdByLevelLayer = {};

    this.idCache = [];
    this.idLayerCache = {};

    this.clipBig = true;
    this.remaining = 0;

    this.loaderFunctionCount = 0;
    this.loadGeometriesCount = 0;
    this.loadFeaturesCount = 0;

    this.logger = new logInfo();
    this.loadingExtents = 0;

    this.timeFinish = 0;
    this.timeStart = 0;

    this.geojsonFormat = new ol.format.GeoJSON({
      defaultDataProjection: 'EPSG:4326'
    });

    this.original_features_store = [];

    this.original_layers_features_store = {};

    this.mergeTool = new mergeTools({
      "featureFormat": this.geojsonFormat
    });

    this.initLayersToCache();

    console.log(this);
}


spatialIndexLoader.prototype.initLayersToCache = function(){
  var layers = Object.keys(this.layers);
  for (var i = 0; i < layers.length; i++) {
    this.cacheIdByLevelLayer[layers[i]] = {};
    this.idLayerCache[layers[i]] = [];
  }
}

/**
 * loader fuction make request on server for getting Identificators for features in extent
 * @param  {[type]}   extent     [description]
 * @param  {[type]}   resolution [description]
 * @param  {[type]}   projection [description]
 * @param  {[type]}   level       [description]
 * @param  {Function} callback   [description]
 * @return {[type]}              [description]
 */
spatialIndexLoader.prototype.loaderFunction = function(extent, resolution, projection, targetSource /* todo callback*/) {
  if(this.loadingExtents == 0){
    this.timeStart = new Date();
    console.log('timeStart');
  }

  this.loadingExtents++;

  this.logger.loadingStatusChange({"statusMessage": 'loading <i class="fa fa-spinner fa-spin"></i>'});

  var zoom = this.tileGrid.getZForResolution(resolution);
  var level = ol.source.MultiLevelVector.prototype.getLODforZ(zoom);

  this.loaderFunctionCount++;
  var this_ = this;
  var a = ol.proj.toLonLat([extent[0], extent[1]]);
  var b = ol.proj.toLonLat([extent[2], extent[3]]);

  this.remaining++;


  this.geomRow = 'geometry_' + level; //this.getLODIdForResolution(resolution);

  
  var data = {
    "db": this.dbname,
    "geom": this.geomRow,
    "idColumn": this.idColumn,
    "level": level,
    "clipBig": this.clipBig,
    "requestType": "getFeaturesIdInBboxForLayers",
    "extent": [a[0], a[1], b[0], b[1]],
    "layers": Object.keys(this.layers)
  };

  $.ajax({
    url: this_.url + data.requestType,
    type: "get",
    data: data,
    datatype: 'json',
    success: function(data){
      this_.loaderFunctionCount--;
      this_.loaderSuccessMultipleLayers(data, function(responseFeatures, level, decrease){
        this_.callback(responseFeatures, level, decrease, "DF_ID", targetSource);
      });
    },
    error:function(er){
      this_.callback([]);
      return console.log("chyba: ", er);
    }   
  }); 
  

  /*
  var data = {
    "layer": this.layerName,
    "db": this.dbname,
    "geom": this.geomRow,
    "idColumn": this.idColumn,
    "level": level,
    "clipBig": this.clipBig,
    "requestType": "getFeaturesIdInBbox",
    "extent": [a[0], a[1], b[0], b[1]]
  };

  $.ajax({
    url: this_.url + data.requestType,
    type: "get",
    data: data,
    datatype: 'json',
    success: function(data){
      this_.loaderFunctionCount--;
      this_.loaderSuccess(data, function(responseFeatures, level, decrease){
        this_.callback(responseFeatures, level, decrease, "DF_ID", targetSource);
      });
    },
    error:function(er){
      this_.callback([]);
      return console.log("chyba: ", er);
    }   
  });*/ 
  
};

/**
 * loaderSucess is called by AJAX request from loader function. From responsed identificators select not loaded before id and make request for geometries.  
 * @param  {[type]}   data     [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
spatialIndexLoader.prototype.loaderSuccess = function(data, callback){
  var this_ = this;
  
  var idToDownload;
  var featuresToDownload;
  var geometriesToDownload;

  if(this.clipBig == true){
    idToDownload = this.selectIdToDownload( data.featuresId , data.level);
  } else {
    //idToDownload = this.selectNotCachedId(Object.keys(data.featuresId));
  }

  if(idToDownload && idToDownload.features.length > 0){
    this_.loadFeatures(idToDownload, data.level, data.extent, callback, this_);
  } else if(idToDownload && idToDownload.geometries){
    this_.loadGeometries(idToDownload, data.level, data.extent, callback, this_);
    callback([], 0, true, "D001");
  } else {
    callback([], 0, true, "D001");
  } 
};

/**
 * loaderSucess is called by AJAX request from loader function. From responsed identificators select not loaded before id and make request for geometries.  
 * @param  {[type]}   data     [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
spatialIndexLoader.prototype.loaderSuccessMultipleLayers = function(data, callback){
  var this_ = this;
  
  var idToDownload;
  var featuresToDownload;
  var geometriesToDownload;

  if(this.clipBig == true){
    idToDownload = this.selectIdToDownloadMultipleLayers( data.layers , data.level);
  } else {
    //idToDownload = this.selectNotCachedId(Object.keys(data.featuresId));
  }

  if(idToDownload && idToDownload.featuresCount > 0){
    this_.loadFeaturesMultipleLayers(idToDownload, data.level, data.extent, callback, this_);
  } else if(idToDownload && idToDownload.geomCount > 0){
    //this_.loadGeometries(idToDownload, data.level, data.extent, callback, this_);
    this.loadGeometriesMultipleLayers(idToDownload, data.level, data.extent, callback, this_);
    callback([], 0, true, "D001");
  } else {
    callback([], 0, true, "D001");
  } 
};

spatialIndexLoader.prototype.addToOriginal_features_store = function(feature){
  var layer = feature.properties.layer;
  if (this.original_layers_features_store[layer] == undefined) {
    this.original_layers_features_store[layer] = [];
  }

  this.original_layers_features_store[layer].push(feature);
};

spatialIndexLoader.prototype.callback = function(responseFeatures, level, decrease, message, source){
  if(decrease){
    this.loadingExtents--;
  }

  if (this.loadingExtents == 0) {
    this.timeFinish = new Date();

  };

  this.logger.loadingStatusChange({
    "statusExtents": this.loadingExtents, 
    "loadingTime": new Date() - this.timeStart
  });

  //prenest do samostatne fce
  if(this.loadingExtents == 0){
    var contentSize = Math.round(this.loadedContentSize * 100) / 100;
    this.logger.loadingStatusChange({
      "statusMessage": 'extent loaded <i class="fa fa-check"></i>', 
      "sizeMessage": contentSize + 'mb'
    });

    this.logger.loadingStatusChange({
      "statusExtents": this.loadingExtents,
      "loadingTime": this.timeFinish - this.timeStart
    });
  }

   if(this.layers != undefined){   
    for (var j = 0; j < responseFeatures.length; j++) {
      var layerName = responseFeatures[j].properties.layer;
      if(decrease){
        var layerSource = this.layers[layerName];
        this.geojsonFeatureToLayer(responseFeatures[j], layerSource, level);
      } else {
        if(responseFeatures[j].properties.original_geom){
          this.addToOriginal_features_store(responseFeatures[j]);
          if(this.loaderFunctionCount < 5 && 
            this.loadGeometriesCount < 7 && 
            this.loadFeaturesCount == 0 ){
            this.loadStoredFeatures();
          }
        } else {
          this.mergeTool.addFeaturesOnLevel(responseFeatures[j], level);
          this.mergeTool.addFeaturesOnLevelInLayer(responseFeatures[j], level, layerName)
          if(this.loaderFunctionCount < 5 && 
            this.loadGeometriesCount < 7 && 
            this.loadFeaturesCount == 0
          ){
            if(this.mergeTool.featuresToMergeOnLevelInLayer[level]){
              var layers = Object.keys(this.mergeTool.featuresToMergeOnLevelInLayer[level]);
              for (var n = 0; n < layers.length; n++) {
                if(this.mergeTool.featuresToMergeOnLevelInLayer[level][layers[n]].length){
                  console.log("merge");
                  this.logger.loadingStatusChange({"statusMessage": 'merging <i class="fa fa-spinner fa-spin"></i>'});
                  mergingStarted = new Date();
                  this.mergeTool.merge(this.mergeCallback, level, this);
                  mergingFinished = new Date();
                  totalMergeTime += mergingFinished - mergingStarted;
                  
                  this.logger.loadingStatusChange({
                    "mergingTime": totalMergeTime,
                    "statusMessage": '<i class="fa fa-check"></i>'
                  });

                }
              }
            }
            //console.log("pocet k merge:", this.mergeTool.featuresToMergeOnLevel[level].length);
          //if(this.loadingExtents == 0 && this.mergeTool.featuresToMergeOnLevel[level].length){
            //source.changed();
          }
        }

      }

    }

    this.loadStoredFeatures();


  } else {
    for (var j = 0; j < responseFeatures.length; j++) {
      if(decrease){
        this.geojsonFeatureToLayer(responseFeatures[j], source, level);
      } else {
        if(responseFeatures[j].properties.original_geom){
          this.original_features_store.push(responseFeatures[j]);
          if(this.loaderFunctionCount == 0 && 
            this.loadGeometriesCount < 7 && 
            this.loadFeaturesCount == 0 ){
            this.loadStoredFeatures(source);
          }
        } else {
          this.mergeTool.addFeaturesOnLevel(responseFeatures[j], level);
          if(this.loaderFunctionCount == 0 && 
            this.loadGeometriesCount < 7 && 
            this.loadFeaturesCount == 0 && 
            this.mergeTool.featuresToMergeOnLevel[level].length
          ){
            //console.log("pocet k merge:", this.mergeTool.featuresToMergeOnLevel[level].length);
          //if(this.loadingExtents == 0 && this.mergeTool.featuresToMergeOnLevel[level].length){
            console.log("merge");
            this.logger.loadingStatusChange({"statusMessage": 'merging <i class="fa fa-spinner fa-spin"></i>'});
            mergingStarted = new Date();
            this.mergeTool.merge(this.mergeCallback, level, source);
            mergingFinished = new Date();
            totalMergeTime += mergingFinished - mergingStarted;
            
            this.logger.loadingStatusChange({
              "mergingTime": totalMergeTime,
              "statusMessage": '<i class="fa fa-check"></i>'
            });

            source.changed();
          }
        }

      }

    }
  }
};


spatialIndexLoader.prototype.mergeCallback = function(responseObject, this_){
  if(responseObject.mergingFinished){
    /*this.logger.loadingStatusChange({"statusMessage": '<i class="fa fa-check"></i>'});
    mergingFinished = new Date();
    this.logger.loadingStatusChange({"mergingTime": totalMergeTime});*/
  } else {
      var olFeatures = this_.layers[responseObject.feature.properties.layer].getFeatures();
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

spatialIndexLoader.prototype.geojsonFeatureToLayer = function(feature, layerSource) {
  var olFeature =  this.geojsonFormat.readFeature(feature, {featureProjection: 'EPSG:3857'});
  layerSource.addFeature(olFeature);
};

spatialIndexLoader.prototype.loadFeaturesFromStoreToSource = function(store, layerSource){
  for (var j = 0; j < store.length; j++) {
    var olFeatures = layerSource.getFeatures();
    var this_ = this;
    var olFeature = goog.array.find(olFeatures, function(f) {
      return f.get('id') === store[j].properties.id;
    });

    if(olFeature){
      var olFeatureee =  this.geojsonFormat.readFeature(store[j], {featureProjection: 'EPSG:3857'});
      var testGe = this.geojsonFormat.readGeometry(store[j].geometry, {featureProjection: 'EPSG:3857'}); 
      var newGeometry = olFeatureee.getGeometry();
      olFeature.set(store[j].properties.geomRow, testGe);
    }
  };

  layerSource.changed();
};

spatialIndexLoader.prototype.loadStoredFeatures = function(source) {
  if(this.original_features_store.length > 0){
    this.loadFeaturesFromStoreToSource(this.original_features_store, source);
    this.original_features_store = [];
  } else {
    var layers = Object.keys(this.original_layers_features_store);
    for (var i = 0; i < layers.length; i++) {
      var store = this.original_layers_features_store[layers[i]];
      if( store && store.length > 0){
        this.loadFeaturesFromStoreToSource(store, this.layers[layers[i]]);
        this.original_layers_features_store[layers[i]] = [];
        this.layers[layers[i]].changed();
      }
    }
  }
};

spatialIndexLoader.prototype.getCountOfFeature = function(){
  var count = 0;
  var layers = Object.keys(this.layers);
  for (var i = 0; i < layers.length; i++) {
    count += this.layers[layers[i]].getFeatures().length;
    console.log(this.layers[layers[i]].getFeatures());
  }
    this.loadStoredFeatures();
  console.log('celkem je:', count);

  count = 0;
  layers = Object.keys(this.layers);
  for (var i = 0; i < layers.length; i++) {
    count += this.layers[layers[i]].getFeatures().length;
    console.log(this.layers[layers[i]].getFeatures());
  }
  console.log('celkem je:', count);

};



spatialIndexLoader.prototype.loadGeometries = function(idToDownload, level, extent, callback, this_) {
  this.loadGeometriesCount++;
  var stringIds = "";
  var ids = idToDownload.features.concat(idToDownload.geometries);
 
  for (var i = 0; i < ids.length; i++) {
    if(i == 0){
      stringIds += " '" + ids[i] + "'";
    } else {
      stringIds += ", '" + ids[i] + "'";
    }
  }

  var this_ = this;
  $.ajax({
    url: this.url + "getGeometry",
    type: "get",
    data:  {
      "layer": this.layerName,
      "db": this.dbname,
      "geom": this.geomRow,
      "idColumn": this.idColumn,
      "level": level,
      "requestType": "getGeometry",
      "ids": stringIds,
      "clipBig": this.clipBig,
      "extent": extent
    },
    datatype: 'json',
    success: function(data, status, xhr){
      this_.loadGeometriesCount--;
      this_.loadedContentSize += parseInt(xhr.getResponseHeader('Content-Length')) / (1024 * 1024);
      callback(data.FeatureCollection.features, data.level, false, "DS_G");
    },
    error:function(er){
      callback([]);
      console.log("chyba: ", er);
    }   
  });

};

spatialIndexLoader.prototype.loadGeometriesMultipleLayers = function(idToDownload, level, extent, callback, this_) {
  var idsInLayer = this.convertIdsArrayToString(idToDownload, 'geometries'); 


  this.loadGeometriesCount++;

  var this_ = this;
  $.ajax({
    url: this.url + "getGeometryInLayers",
    type: "get",
    data:  {
      "layer": this.layerName,
      "db": this.dbname,
      "geom": this.geomRow,
      "idColumn": this.idColumn,
      "level": level,
      "requestType": "getGeometryInLayers",
      "clipBig": this.clipBig,
      "extent": extent,
      "idsInLayer": idsInLayer 
    },
    datatype: 'json',
    success: function(data, status, xhr){
      this_.loadGeometriesCount--;
      this_.loadedContentSize += parseInt(xhr.getResponseHeader('Content-Length')) / (1024 * 1024);
      callback(data.FeatureCollection.features, data.level, false, "DS_G");
    },
    error:function(er){
      callback([]);
      console.log("chyba: ", er);
    }   
  });

};

spatialIndexLoader.prototype.loadFeatures = function(idToDownload, level, extent, callback, this_) {
  this.loadFeaturesCount++;
  var stringIds = "";
  for (var i = 0; i < idToDownload.features.length; i++) {
    if(i == 0){
      stringIds += " '" + idToDownload.features[i] + "'";
    } else {
      stringIds += ", '" + idToDownload.features[i] + "'";
    }
  }

  var this_ = this;
  $.ajax({
    url: this.url + "getFeaturesById",
    type: "get",
    data:  {
      "layer": this.layerName,
      "db": this.dbname,
      "geom": this.geomRow,
      "idColumn": this.idColumn,
      "level": level,
      "requestType": "getFeaturesById",
      "ids": stringIds,
      "extent": extent
    },
    datatype: 'json',
    success: function(data, status, xhr){
      this_.loadFeaturesCount--;
      this_.loadGeometries(idToDownload, data.level, extent, callback, this_);
      this_.loadedContentSize += parseInt(xhr.getResponseHeader('Content-Length')) / (1024 * 1024);

      // prazdne [] nebo pokud obsahuje features, tak prida uplne poprve 
      //feature vcetne atributu ale s prazdnou geometrii (nejde nacist geojson feature bez property geometry)
      callback(data.FeatureCollection.features, data.level, true, "DS_F");      
    },
    error:function(er){
      callback([]);
      console.log("chyba: ", er);
    }   
  });

};

spatialIndexLoader.prototype.convertIdsArrayToString = function(idToDownload, type){
  var layers = Object.keys(idToDownload.features);
  var idsInLayer = {};

  for (var i = 0; i < layers.length; i++) {
    idsInLayer[layers[i]] = "";
    var stringIds = "";
    for (var j = 0; j < idToDownload.features[layers[i]].length; j++) {
      if(j == 0){
        stringIds += " '" + idToDownload.features[layers[i]][j] + "'";
      } else {
        stringIds += ", '" + idToDownload.features[layers[i]][j] + "'";
      }
    }
    idsInLayer[layers[i]] = stringIds;
  }

  return idsInLayer;
};

spatialIndexLoader.prototype.loadFeaturesMultipleLayers = function(idToDownload, level, extent, callback, this_) {
  this.loadFeaturesCount++;
  var idsInLayer = this.convertIdsArrayToString(idToDownload, 'features');

  var this_ = this;
  $.ajax({
    url: this.url + "getFeaturesByIdinLayers",
    type: "get",
    data:  {
      "layer": this.layerName,
      "db": this.dbname,
      "geom": this.geomRow,
      "idColumn": this.idColumn,
      "level": level,
      "requestType": "getFeaturesByIdinLayers",
      "extent": extent,
      "idsInLayer": idsInLayer
    },
    datatype: 'json',
    success: function(data, status, xhr){
      this_.loadFeaturesCount--;
      idToDownload.geometries = idToDownload.features;
      this_.loadGeometriesMultipleLayers(idToDownload, data.level, extent, callback, this_);
      this_.loadedContentSize += parseInt(xhr.getResponseHeader('Content-Length')) / (1024 * 1024);

      // prazdne [] nebo pokud obsahuje features, tak prida uplne poprve 
      //feature vcetne atributu ale s prazdnou geometrii (nejde nacist geojson feature bez property geometry)
      callback(data.FeatureCollection.features, data.level, true, "DS_F");      
    },
    error:function(er){
      callback([]);
      console.log("chyba: ", er);
    }   
  });

};



/**
 * select from all identificators those which will be downloaded
 * @param  {[type]} ids  - identificators
 * @param  {[type]} level [description]
 * @return {[type]} ids to download
 */
spatialIndexLoader.prototype.selectIdToDownload = function(ids, level){
  var keys = Object.keys(ids);
  if(keys.length == 0){
    return false;
  }
  var idsNotInCache = this.selectNotCachedId(keys, level);
  return idsNotInCache;
};

/**
 * select from all identificators those which will be downloaded
 * @param  {[type]} ids  - identificators
 * @param  {[type]} level [description]
 * @return {[type]} ids to download
 */
spatialIndexLoader.prototype.selectIdToDownloadMultipleLayers = function(layers, level){
  var layerNames = Object.keys(layers);
  if(layerNames.length == 0){
    return false;
  }
  var idsNotInCache;

  var downloadFeature = {};
  var downloadGeom = {}; 
  var featuresCount = 0;
  var geomCount = 0;


  for (var i = 0; i < layerNames.length; i++) {
    downloadFeature[layerNames[i]] = [];
    downloadGeom[layerNames[i]] = [];

    if(layers[layerNames[i]] == 'kraje'){

    }

    var ids = Object.keys(layers[layerNames[i]]);

    for (var j = 0; j < ids.length; j++) {
      var findOnLevel = false;
      var findOnAnotherLevel = false;

      if(level){
        if(!this.cacheIdByLevelLayer[layerNames[i]][level]){
          this.cacheIdByLevelLayer[layerNames[i]][level] = [];
        }

        if (this.cacheIdByLevelLayer[layerNames[i]][level].indexOf(ids[j]) != -1){
          findOnLevel = true;
        } else {
          this.cacheIdByLevelLayer[layerNames[i]][level].push(ids[j]);
          var levels = Object.keys(this.cacheIdByLevelLayer[layerNames[i]]);
          for (var k = 0; k < levels.length; k++) {
            if(levels[k] != level){
              if (this.cacheIdByLevelLayer[layerNames[i]][levels[k]].indexOf(ids[j]) != -1){
                findOnAnotherLevel = true;
                break;
              }
            }
          }
        }

        if(findOnAnotherLevel || findOnLevel){
          downloadGeom[layerNames[i]].push(ids[j]);
          geomCount++;
        } else if(!findOnAnotherLevel && !findOnLevel){
          downloadFeature[layerNames[i]].push(ids[j]);
          featuresCount++;
        }

      } else if (this.idLayerCache[layerNames[i]].indexOf(ids[j]) == -1){
        this.idLayerCache[layerNames[i]].push(ids[j]);
        downloadFeature[layerNames[i]].push(ids[j]);
        featuresCount++;
      }
    };
  }

  var result = {
    'features': downloadFeature, 
    'geometries': downloadGeom, 
    'geomCount': geomCount, 
    'featuresCount': featuresCount
  };
  console.log(result);
  return result;
};



/**
 * NEW VERSION: should return ids for downloading feature with extent and then geometry and return also ids for downloading only geometry
 * [selectNotCachedId description]
 * @param  {[type]} ids  - feature identificators 
 * @param  {[type]} level [description] - not mandatory - only if you want caching for zooms????? not finished...
 * @return {[type]} ids not cached
 */
spatialIndexLoader.prototype.selectNotCachedId = function(ids, level) {
  var downloadFeature = [];
  var downloadGeom = []
  
  for (var i = 0; i < ids.length; i++) {
    var findOnLevel = false;
    var findOnAnotherLevel = false;

    if(level){
      if(!this.cacheIdByLevel[level]){
        this.cacheIdByLevel[level] = [];
      }

      if (this.cacheIdByLevel[level].indexOf(ids[i]) != -1){
        findOnLevel = true;
      } else {
        this.cacheIdByLevel[level].push(ids[i]);
        var levels = Object.keys(this.cacheIdByLevel);
        for (var j = 0; j < levels.length; j++) {
          if(levels[j] != level){
            if (this.cacheIdByLevel[levels[j]].indexOf(ids[i]) != -1){
              findOnAnotherLevel = true;
              break;
            }
          }
        }
      }

      if(findOnAnotherLevel || findOnLevel){
        downloadGeom.push(ids[i]);
      } else if(!findOnAnotherLevel && !findOnLevel){
        downloadFeature.push(ids[i]);
      }

    } else if (this.idCache.indexOf(ids[i]) == -1){
      this.idCache.push(ids[i]);
      downloadFeature.push(ids[i]);
    }
  };

  return {'features': downloadFeature, 'geometries': downloadGeom};
};
