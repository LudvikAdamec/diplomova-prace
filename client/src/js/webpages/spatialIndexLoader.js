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

  this.geomRow = 'geometry_' + this.getLODIdForResolution(resolution);
  //console.log("changed geomRow?", this.geomRow);
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
      this_.loaderSuccess(data, function(responseFeatures, zoom, decrease){
        callback(responseFeatures, zoom, decrease);
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
  var featuresToDownload;
  var geometriesToDownload;

  if(this.clipBig == true){
    idToDownload = this.selectIdToDownload( data.featuresId , data.zoom);
  } else {
    //idToDownload = this.selectNotCachedId(Object.keys(data.featuresId));
  }

  var extent = data.extent;


  if(idToDownload && idToDownload.features && idToDownload.features.length > 0){
    var stringIds = "";
    for (var i = 0; i < idToDownload.features.length; i++) {
      if(i == 0){
        stringIds += " '" + idToDownload.features[i] + "'";
      } else {
        stringIds += ", '" + idToDownload.features[i] + "'";
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

        for (var i = 0; i < idToDownload.geometries.length; i++) {
          stringIds += ", '" + idToDownload.geometries[i] + "'";
        }

        this_.loadedContentSize += parseInt(xhr.getResponseHeader('Content-Length')) / (1024 * 1024);
        
        $.ajax({
          url: this_.url + "getGeometry",
          type: "get",
          data:  {
            "layer": this_.layerName,
            "db": this_.dbname,
            "geom": this_.geomRow,
            "idColumn": this_.idColumn,
            "zoom": data.zoom,
            "requestType": "getGeometry",
            "ids": stringIds,
            "clipBig": this_.clipBig,
            "extent": extent
          },
          datatype: 'json',
          success: function(data, status, xhr){
            this_.loadedContentSize += parseInt(xhr.getResponseHeader('Content-Length')) / (1024 * 1024);
            callback(data.FeatureCollection.features, data.zoom, false);
          },
          error:function(er){
            callback([]);
            console.log("chyba: ", er);
          }   
        });

        callback(data.FeatureCollection.features, data.zoom, true);
        


      },
      error:function(er){
        callback([]);
        console.log("chyba: ", er);
      }   
    }); 
  } else {
    callback([], 0, true);
    //console.log('no geometry for downloading');
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
  
  var idsNotInCache = this.selectNotCachedId(keys, zoom);

  for (var i = 0; i < keys.length; i++) {
    if(ids[keys[i]]){
      if(idsNotInCache.features.indexOf(ids[keys[i]]) == -1){
        idsNotInCache.features.push(ids[keys[i]]);
      }
    } 

  };

  return idsNotInCache;
};


/**
 * NEW VERSION: should return ids for downloading feature with extent and then geometry and return also ids for downloading only geometry
 * [selectNotCachedId description]
 * @param  {[type]} ids  - feature identificators 
 * @param  {[type]} zoom [description] - not mandatory - only if you want caching for zooms????? not finished...
 * @return {[type]} ids not cached
 */
spatialIndexLoader.prototype.selectNotCachedId = function(ids, zoom) {
  var downloadFeature = [];
  var downloadGeom = []
  
  for (var i = 0; i < ids.length; i++) {
    var findOnZoom = false;
    var findOnAnotherZoom = false;

    if(zoom){
      if(!this.cacheIdByZoom[zoom]){
        this.cacheIdByZoom[zoom] = [];
      }

      if (this.cacheIdByZoom[zoom].indexOf(ids[i]) != -1){
        findOnZoom = true;
      } else {
        this.cacheIdByZoom[zoom].push(ids[i]);
        var zooms = Object.keys(this.cacheIdByZoom);
        for (var j = 0; j < zooms.length; j++) {
          if(zooms[j] != zoom){
            if (this.cacheIdByZoom[zooms[j]].indexOf(ids[i]) != -1){
              findOnAnotherZoom = true;
              break;
            }
          }
        }
      }

      if(findOnAnotherZoom || findOnZoom){
        downloadGeom.push(ids[i]);
      } else if(!findOnAnotherZoom && !findOnZoom){
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
