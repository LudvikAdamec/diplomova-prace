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
    this.map = params.map.map;
    this.url = dbParams.url;// "http://localhost:9001/se/";
    this.layerName = dbParams.layerName; //"parcelswgs";
    this.dbname = dbParams.dbname;
    this.geomRow = dbParams.geomColumn;
    this.idColumn = dbParams.idColumn;

    this.cacheIdByZoom = {
      16: [],
      17: [],
      18: [],
      19: []
    };

    this.idCache = [];
    this.clipBig = true;
    this.remaining = 0;
}

spatialIndexLoader.prototype.loaderFunction = function(extent, resolution, projection, callback) {
  var this_ = this;
  var a = ol.proj.toLonLat([extent[0], extent[1]]);
  var b = ol.proj.toLonLat([extent[2], extent[3]]);

  this.remaining++;

  var data = {
    "layer": this.layerName,
    "db": this.dbname,
    "geom": this.geomRow,
    "idColumn": this.idColumn,
    //"x": a[0] - (a[0] - b[0]),
    //"y": a[1] - (a[1] - b[1]),
    "zoom": this.map.getView().getZoom(),
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
      return console.log("chyba: ", er);
    }   
  }); 

};

spatialIndexLoader.prototype.loaderSuccess = function(data, callback){
  var this_ = this;
  //TODO
  // - udelat kontrolu, ktera bude kontrolovat nacitani vsech dlazdic....nekdy se data z dlazdice nedostanou do prohlizece
  
  var idToDownload;// = Object.keys( data.featuresId );
  if(this.clipBig == true){
    idToDownload = this.selectIdToDownload( data.featuresId , data.zoom);
  } else {
    idToDownload = this.selectNotCachedId(Object.keys(data.featuresId));
  }

  this_.debugRemaining--;


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
      success: function(data){
        var features = data.FeatureCollection.features;
        try {
          callback(features, data.zoom);
        } catch (err) {
          console.log("error in callback: ", err);
        }
        
      },
      error:function(er){
        console.log("chyba: ", er);
      }   
    }); 
  } else {
    callback({});
    console.log('no geometry for downloading');
  }
};

spatialIndexLoader.prototype.selectIdToDownload = function(ids, zoom){
  var keys = Object.keys(ids);
  if(keys.length == 0){
    return false;
  }
  var toCache = [];
  var idToDownload = [];
  var counterBigToDownl = [];

  for (var i = 0; i < keys.length; i++) {
    if(ids[keys[i]]){
      counterBigToDownl.push(keys[i]);
    } else {
      toCache.push(keys[i]);
    }
  };

  var idsNotInCache = this.selectNotCachedId(toCache, zoom);
  idToDownload = counterBigToDownl.concat(idsNotInCache);

  return idToDownload;

};

spatialIndexLoader.prototype.selectNotCachedId = function(ids, zoom) {
  var notCached = [];
  for (var i = 0; i < ids.length; i++) {
    if(zoom){
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
