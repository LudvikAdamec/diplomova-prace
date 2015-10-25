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

    this.cacheIdByZoom = {};

    this.idCache = [];
    this.clipBig = true;
    this.remaining = 0;
}

/**
 * loader fuction make request on server for getting Identificators for features in extent
 * @param  {[type]}   extent     [description]
 * @param  {[type]}   resolution [description]
 * @param  {[type]}   projection [description]
 * @param  {[type]}   zoom       [description]
 * @param  {Function} callback   [description]
 * @return {[type]}              [description]
 */
spatialIndexLoader.prototype.loaderFunction = function(extent, resolution, projection, zoom, callback) {
  var this_ = this;
  var a = ol.proj.toLonLat([extent[0], extent[1]]);
  var b = ol.proj.toLonLat([extent[2], extent[3]]);

  this.remaining++;

  var data = {
    "layer": this.layerName,
    "db": this.dbname,
    "geom": this.geomRow,
    "idColumn": this.idColumn,
    "zoom": zoom,
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
      this_.loaderSuccess(data, function(responseFeatures, zoom){
        callback(responseFeatures,zoom);
      });
    },
    error:function(er){
      callback([]);
      return console.log("chyba: ", er);
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
  if(this.clipBig == true){
    idToDownload = this.selectIdToDownload( data.featuresId , data.zoom);
  } else {
    idToDownload = this.selectNotCachedId(Object.keys(data.featuresId));
  }

  var extent = data.extent;
  if(idToDownload.length > 0){
    var stringIds = "";
    for (var i = 0; i < idToDownload.length; i++) {
      if(i == 0){
        stringIds += " '" + idToDownload[i] + "'";
      } else {
        stringIds += ", '" + idToDownload[i] + "'";
      }
    }
    
    $.ajax({
      url: this.url + "getFeaturesById",
      type: "get",
      data:  {
        "layer": this.layerName,
        "db": this.dbname,
        "geom": this.geomRow,
        "idColumn": this.idColumn,
        "zoom": data.zoom,
        "requestType": "getFeaturesById",
        "ids": stringIds,
        "clipBig": this.clipBig,
        "extent": extent
      },
      datatype: 'json',
      success: function(data, status, xhr){
        this_.loadedContentSize += parseInt(xhr.getResponseHeader('Content-Length')) / (1024 * 1024);
        callback(data.FeatureCollection.features, data.zoom);
      },
      error:function(er){
        callback([]);
        console.log("chyba: ", er);
      }   
    }); 
  } else {
    callback({});
    console.log('no geometry for downloading');
  }
};


/**
 * select from all identificators those which will be downloaded
 * @param  {[type]} ids  - identificators
 * @param  {[type]} zoom [description]
 * @return {[type]} ids to download
 */
spatialIndexLoader.prototype.selectIdToDownload = function(ids, zoom){
  var keys = Object.keys(ids);
  
  if(keys.length == 0){
    return false;
  }
  
  var toCache = [];
  var idToDownload = [];
  var bigFeaturesId = [];

  //detect if geometry will be clipped by extent 
  for (var i = 0; i < keys.length; i++) {
    if(ids[keys[i]]){
      bigFeaturesId.push(keys[i]);
    //or if original geom will be sended 
    } else {
      toCache.push(keys[i]);
    }
  };

  var idsNotInCache = this.selectNotCachedId(toCache, zoom);
  idToDownload = bigFeaturesId.concat(idsNotInCache);
  return idToDownload;
};


/**
 * [selectNotCachedId description]
 * @param  {[type]} ids  - feature identificators 
 * @param  {[type]} zoom [description] - not mandatory - only if you want caching for zooms????? not finished...
 * @return {[type]} ids not cached
 */
spatialIndexLoader.prototype.selectNotCachedId = function(ids, zoom) {
  var notCached = [];
  for (var i = 0; i < ids.length; i++) {
    if(zoom){
      if(!this.cacheIdByZoom[zoom]){
        this.cacheIdByZoom[zoom] = [];
      }

      if (this.cacheIdByZoom[zoom].indexOf(ids[i]) == -1){
        this.cacheIdByZoom[zoom].push(ids[i]);
        notCached.push(ids[i]);
      }
    } else if (this.idCache.indexOf(ids[i]) == -1){
      this.idCache.push(ids[i]);
      notCached.push(ids[i]);
    }
  };
  return notCached;
};
