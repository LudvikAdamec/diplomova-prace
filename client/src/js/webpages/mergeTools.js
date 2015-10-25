'use strict';
goog.provide('mergeTools');

goog.require('ol.proj');
goog.require('goog.asserts');
goog.require('goog.array');
goog.require('featuresOperations');


/**
 * tool for merging geometries (only merge data and pass them via callback back)
 * @param  {[type]} mergeParams - parameters
 * @return {[type]}             [description]
 */
mergeTools = function(mergeParams) {
  /**
   * stores loaded data before merging and adding to map
   * @type {Array}
  */
 
  //use for vector tiles
  this.tilesToMerge = [];
  
  //use for spatial indexing - when one feature for all zooms
  this.featuresToMerge = [];
  this.allFeatures = [];

  //use for spatial indexing - when one feature for every zoom level
  this.featuresToMergeOnZoom = {};
  this.allFeaturesOnZoom = {};
  
  this.operations = new featuresOperations();
  this.featureFormat = mergeParams.featureFormat;
}

mergeTools.prototype.addTiles = function (tile) {
  this.tilesToMerge.push(tile);
};

mergeTools.prototype.addFeaturesOnZoom = function (feature, zoom) {
  //if zoom not exist yet -> create zoom cache
  if(!this.featuresToMergeOnZoom[zoom]){
    this.featuresToMergeOnZoom[zoom] = [];
    this.allFeaturesOnZoom[zoom] = [];
  }

  if(feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon"){
    this.featuresToMergeOnZoom[zoom].push(feature);
  }
};


/**
 * merge function is starting point for merging by all 
 * strategies...its based on curently chached data in mergeTools
 * @param  {Function} callback - callback function - need to be called in all cases
 * @param  {[type]}   zoom     
 * @return {[type]}   
 */
mergeTools.prototype.merge = function (callback, zoom) {
  if(!this.featuresToMergeOnZoom[zoom]){
    this.featuresToMergeOnZoom[zoom] = [];
    this.allFeaturesOnZoom[zoom] = [];
  }

  if(this.tilesToMerge.length){
    this.mergeTiles(callback);
  } else if(this.featuresToMergeOnZoom[zoom].length) {
    this.mergeFeatures(this.allFeaturesOnZoom[zoom], this.featuresToMergeOnZoom[zoom], callback, zoom);
    this.featuresToMergeOnZoom[zoom] = [];
  } else if(this.featuresToMerge.length) {
    this.mergeFeatures(this.allFeatures, this.featuresToMerge, callback);
    this.featuresToMerge = [];
  } else {
    callback({
      "mergingFinished": true
    });
  }
};

/**
 * function for merging unmerged tiles saved in tilesToMerge
 * @return {[type]} [description]
 */
mergeTools.prototype.mergeTiles = function(callback){
  while(this.tilesToMerge.length) {
    var dlazdice = this.tilesToMerge.shift();
    var geojsonTile = topojson.feature(dlazdice, dlazdice.objects.vectile);
    if(geojsonTile.features.length > 0) {
      this.mergeFeatures(this.allFeatures, geojsonTile.features, callback);
    }
  }
};

/**
 * function for finding feature parts, merging and sending them back by callback function
 * @param  {object} features already existing and merged features
 * @param  {object} featuresToMerge features to merge
 * @return {[type]}      [description]
 */
mergeTools.prototype.mergeFeatures = function(features, featuresToMerge, callback, zoom) {
  var this_ = this;

  var featureToFeatures = function(f) {
    goog.asserts.assert(f.geometry.type === 'Polygon'
      || f.geometry.type === 'MultiPolygon');
    if(f.geometry.type === 'Polygon') {
      return [f];
    } else {
      return goog.array.map(f.geometry.coordinates, function(polygon) {
        return this_.operations.buildPolygon(polygon, f.properties);
      });
    }
  }


  var mergeTwoFeatures = function(f1, f2) {
    var features = featureToFeatures(f1);
    goog.array.extend(features, featureToFeatures(f2));
    goog.array.forEach(features, function(f) {
      goog.asserts.assert(f.geometry.type === 'Polygon');
    });
    try {
      var merged = this_.operations.mergePolygons(features);
    } catch(e) {
      console.log(e);
      merged = f1;
    }
    return merged;
  };

   var finishedCallback = function(){
    callback({
      "mergingFinished": true
    });
  }

  var remaingFeaturesToMerge = featuresToMerge.length;
  if(remaingFeaturesToMerge == 0){
     callback({
      "mergingFinished": true
    });
  }

  goog.array.forEach(featuresToMerge, function(ftm) {
    --remaingFeaturesToMerge;

    if(ftm.geometry.type === 'Polygon'|| ftm.geometry.type === 'MultiPolygon'){
      var ftmId = ftm.properties.id;
      
      if(!!ftmId){
        var sameIdFeature = goog.array.find(features, function(f) {
          return f.properties.id === ftmId;
        });

        if(sameIdFeature) {
          var start = new Date();
          var merged = mergeTwoFeatures(ftm, sameIdFeature);
          var newGeom = this_.featureFormat.readGeometry(merged.geometry, {featureProjection: 'EPSG:3857'});
          goog.array.remove(features, sameIdFeature);
          features.push(merged);
          callback({
            "feature" : ftm,
            "geometry": newGeom,
            "updateExisting": true
          });
        } else {
          features.push(ftm);
          callback({
            "feature": ftm,
            "geometry": ftm,
            "updateExisting": false
          });
        }
      }
    }


    if(remaingFeaturesToMerge == 0){
      finishedCallback();
    }

  });

};
