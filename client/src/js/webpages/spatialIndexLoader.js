'use strict';
goog.provide('spatialIndexLoader');

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

    this.loadedContentSize = 0;

    this.cacheIdByLevel = {};

    this.idCache = [];
    this.clipBig = true;
    this.remaining = 0;
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
spatialIndexLoader.prototype.loaderFunction = function(extent, resolution, projection, callback) {
  var this_ = this;
  var a = ol.proj.toLonLat([extent[0], extent[1]]);
  var b = ol.proj.toLonLat([extent[2], extent[3]]);

  this.remaining++;

  var level = this.getLODIdForResolution(resolution);

  this.geomRow = 'geometry_' + this.getLODIdForResolution(resolution);
  //console.log("changed geomRow?", this.geomRow);
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
      this_.loaderSuccess(data, function(responseFeatures, level, decrease){
        callback(responseFeatures, level, decrease, "DF_ID");
      });
    },
    error:function(er){
      callback([]);
      return console.log("chyba: ", er);
    }   
  }); 

};

spatialIndexLoader.prototype.loadGeometries = function(idToDownload, level, extent, callback, this_) {
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
      "clipBig": this.clipBig,
      "extent": extent
    },
    datatype: 'json',
    success: function(data, status, xhr){
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

  for (var i = 0; i < keys.length; i++) {
    if(ids[keys[i]]){
      if(idsNotInCache.features.indexOf(keys[i]) == -1){
        //console.log(idsNotInCache.features);
        //idsNotInCache.features.push(keys[i]);
        //idsNotInCache.features.push([keys[i]]);
        //console.log(idsNotInCache.features);
      }
    } 

  };

  return idsNotInCache;
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

spatialIndexLoader.prototype.getLODIdForResolution = function(resolution){
  var step = 1;

  if (resolution <= step ){
    return 9;
  } else if(resolution <= step * 2){
    return 8;
  } else if(resolution <= step * 4){
    return 7;
  } else if(resolution <= step * 8){
    return 6;
  } else if(resolution <= step * 16){
    return 5;
  } else if(resolution <= step * 32){
    return 4;
  } else if(resolution <= step * 64){
    return 3;
  } else if(resolution <= step * 128){
    return 2;
  } else if(resolution <= step * 256){
    return 1;
  } else {
    return 1;
  }

  if (resolution <= step ){
    return 9;
  } else if(resolution <= 9.6){
    return 8;
  } else if(resolution <= 19.2){
    return 7;
  } else if(resolution <= 38.4){
    return 6;
  } else if(resolution <= 76.8){
    return 5;
  } else if(resolution <= 153.6){
    return 4;
  } else if(resolution <= 307.2){
    return 3;
  } else if(resolution <= 614.4){
    return 2;
  } else if(resolution <= 1228.8){
    return 1;
  } else {
    return 1;
  }

};
