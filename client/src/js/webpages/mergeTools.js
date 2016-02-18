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
  
  //use for spatial indexing - when one feature for all levels
  this.featuresToMerge = [];
  this.allFeatures = [];

  //use for spatial indexing - when one feature for every level
  this.featuresToMergeOnLevel = {};
  this.allFeaturesOnLevel = {};

  this.topojsonOnLevel = {};
  
  this.operations = new featuresOperations();
  this.featureFormat = mergeParams.featureFormat;
}

mergeTools.prototype.addTiles = function (tile) {
  this.tilesToMerge.push(tile);
};

mergeTools.prototype.addTopoJsonFeaturesOnLevel = function(topojsonData, level){
  if(!this.topojsonOnLevel[level]){
    this.topojsonOnLevel[level] = [];
    this.allFeaturesOnLevel[level] = [];
  }

  if(topojsonData.objects){
    this.topojsonOnLevel[level].push(topojsonData);
  }
};

mergeTools.prototype.addFeaturesOnLevel = function (feature, level) {
  //if level not exist yet -> create level cache
  if(!this.featuresToMergeOnLevel[level]){
    this.featuresToMergeOnLevel[level] = [];
    this.allFeaturesOnLevel[level] = [];
  }

  if(feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon"){
    this.featuresToMergeOnLevel[level].push(feature);
  }
};

mergeTools.prototype.mergeTopojsons = function(callback, level){
  for (var i = 0; i < this.topojsonOnLevel[level].length; i++) {
      var features = topojson.feature(this.topojsonOnLevel[level][i], this.topojsonOnLevel[level][i].objects.collection);
      for (var j = 0; j < features.features.length; j++) {
        this.addFeaturesOnLevel(features.features[j], level);
      }
      //this.featuresToMergeOnLevel[level] = this.featuresToMergeOnLevel[level].concat(features.features);
  }

  this.topojsonOnLevel[level] = [];

  this.merge(callback, level);
};


/**
 * merge function is starting point for merging by all 
 * strategies...its based on curently chached data in mergeTools
 * @param  {Function} callback - callback function - need to be called in all cases
 * @param  {[type]}   level     
 * @return {[type]}   
 */
mergeTools.prototype.merge = function (callback, level) {
  if(!this.featuresToMergeOnLevel[level]){
    this.featuresToMergeOnLevel[level] = [];
    this.allFeaturesOnLevel[level] = [];
  }

  if(this.topojsonOnLevel.length){
    this.mergeTopojsons(callback, level)
  }

  if(this.tilesToMerge.length){
    this.mergeTiles(callback);
  } else if(this.featuresToMergeOnLevel[level].length) {
    this.mergeFeatures(this.allFeaturesOnLevel[level], this.featuresToMergeOnLevel[level], callback, level);
    this.featuresToMergeOnLevel[level] = [];
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
mergeTools.prototype.mergeFeatures = function(features, featuresToMerge, callback, level) {
  var this_ = this;

  var featureToFeatures = function(f) {
    
    if(f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'){
      if(f.geometry.type === 'Polygon') {
        return [f];
      } else {
        return goog.array.map(f.geometry.coordinates, function(polygon) {
          return this_.operations.buildPolygon(polygon, f.properties);
        });
      }
    } else {
      console.log("wrong type: ", f);
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
            "mergedGeojsonGeom": merged,
            "updateExisting": true
          });
        } else {
          var newGeom = this_.featureFormat.readGeometry(ftm.geometry, {featureProjection: 'EPSG:3857'});
          features.push(ftm);
          callback({
            "feature": ftm,
            "geometry": newGeom,
            "mergedGeojsonGeom": ftm.geometry,
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
