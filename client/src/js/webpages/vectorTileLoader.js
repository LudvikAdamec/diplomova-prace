'use strict';
goog.provide('vectorTileLoader');

goog.require('ol.proj');
goog.require('goog.asserts');
goog.require('goog.array');

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
vectorTileLoader.prototype.loaderFunction = function(extent, level, projection, callback) {
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

  $.ajax({
    url: this_.url + data.requestType,
    type: "get",
    data: data,
    datatype: 'json',
    success: function(data, status, xhr){
      this_.loadedContentSize += parseInt(xhr.getResponseHeader('Content-Length')) / (1024 * 1024);
      this_.remaining--;
      callback(data.FeatureCollection.features, data.level, 'first', "DF_ID");
    },
    error:function(er){
      console.log("xxxxx");
      callback([]);
      return console.log("chyba: ", er);
    }   
  }); 

};
