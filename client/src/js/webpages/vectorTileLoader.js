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
    this.tileGrid = ol.tilegrid.createXYZ({
      tileSize: 256
    });

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
vectorTileLoader.prototype.loaderFunction = function(extent, level, projection, callback, resolution) {
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
    'y': (xyz[2] * -1), //xyz[1],
    'x': xyz[1],
    'z': xyz[0]
  }


  //http://localhost:9001/se/renderTile?x=1118&y=1346&z=11

  $.ajax({
    url: 'http://localhost:9001/se/renderTile',
    type: "get",
    data: dataXYZ,
    datatype: 'json',
    success: function(data, status, xhr){

      console.log("xyz", data);
    },
    error:function(er){
      return console.log("chyba: ", er);
    }   
  }); 


  //getTileCoordForCoordAndZ(coordinate, z, opt_tileCoord

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
