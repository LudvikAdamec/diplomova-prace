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
spatialIndexLoader = function(dbParams) {

    this.url = dbParams.url;// "http://localhost:9001/se/";
    this.layerName = dbParams.layerName; //"parcelswgs";
    this.dbname = dbParams.dbname;
    this.geomRow = dbParams.geomColumn;
    this.idColumn = dbParams.idColumn;
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
    //"z": map.getView().getZoom(),
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
      //console.log(data);
      this_.loaderSuccess(data, function(responseFeatures){
        callback(responseFeatures);
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
    idToDownload = this.selectIdToDownload( data.featuresId );
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
        //"z": TODO: need to be done for possible genralization
        "requestType": "getFeaturesById",
        "ids": stringIds,
        "clipBig": this.clipBig,
        "extent": extent
      },
      datatype: 'json',
      success: function(data){
        var features = data.FeatureCollection.features;
        try {
          callback(features);
          this_.remaining--;
        } catch (err) {
          console.log(err);
        }
        
      },
      error:function(er){
        console.log("chyba: ", er);
      }   
    }); 
  } else {
    callback({});
    console.log('je to v haji');
  }
};

spatialIndexLoader.prototype.selectIdToDownload = function(ids){
  var keys = Object.keys(ids);
  if(keys.length == 0){
    return false;
  }
  var toCache = [];

  "'" + keys[i] + "'";

  var idToDownload = [];

  var counterBigToDownl = [];

  for (var i = 0; i < keys.length; i++) {
    if(ids[keys[i]]){
      counterBigToDownl.push(keys[i]);
    } else {
      toCache.push(keys[i]);
    }
  };

  var idsNotInCache = this.selectNotCachedId(toCache);
  idToDownload = counterBigToDownl.concat(idsNotInCache);

  return idToDownload;

};

spatialIndexLoader.prototype.selectNotCachedId = function(ids) {
  var notCached = [];
  for (var i = 0; i < ids.length; i++) {
    if(this.idCache.indexOf(ids[i]) == -1){
      this.idCache.push(ids[i]);
      notCached.push(ids[i]);
    }
  };
  return notCached;
};
