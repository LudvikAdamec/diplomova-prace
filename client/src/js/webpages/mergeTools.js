'use strict';
goog.provide('mergeTools');

goog.require('ol.proj');
goog.require('goog.asserts');
goog.require('goog.array');
goog.require('featuresOperations');



mergeTools = function(mergeParams) {
  /**
   * stores loaded data before merging and adding to map
   * @type {Array}
  */
  this.tilesToMerge = [];

  this.featuresToMerge = [];
  
  this.allFeatures = [];
  
  this.targetLayer; 
  if(mergeParams.targetLayer){
    this.targetLayer = mergeParams.targetLayer;
  }

  this.operations = new featuresOperations();

  this.featureFormat = mergeParams.featureFormat;


}

mergeTools.prototype.setTargetLayer = function(layer){
  this.targetLayer = layer;
}

mergeTools.prototype.addTiles = function (tile) {
  this.tilesToMerge.push(tile);
};

mergeTools.prototype.addFeatures = function (feature) {
  if(feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon"){
    this.featuresToMerge.push(feature);
  }
};

mergeTools.prototype.merge = function () {
  if(this.tilesToMerge.length){
    this.mergeTiles();
  } else if(this.featuresToMerge.length) {
    this.mergeFeatures(this.allFeatures, this.featuresToMerge);
    this.featuresToMerge = [];
  }
};

/**
 * Simple function for merging timing 
 * @return {[type]} [description]
 */
mergeTools.prototype.mergeTiles = function(){
  while(this.tilesToMerge.length) {
    var dlazdice = this.tilesToMerge.shift();
    var geojsonTile = topojson.feature(dlazdice, dlazdice.objects.vectile);
    if(geojsonTile.features.length > 0) {
      this.mergeFeatures(this.allFeatures, geojsonTile.features);
    }
  }
};

/**
 * function for finding feature parts, merging and adding to this.targetLayer
 * @param  {object} features already existing and merged features
 * @param  {object} featuresToMerge features to merge
 * @return {[type]}      [description]
 */
mergeTools.prototype.mergeFeatures = function(features, featuresToMerge) {
  var this_ = this;

  var geojsonFeatureToLayer = function(feature, layer ) {
    var id = feature.properties.id;
    var olFeature =  this_.featureFormat.readFeature(feature, {featureProjection: 'EPSG:3857'});
    goog.asserts.assert(!!olFeature.get('id'));
    layer.getSource().addFeature(olFeature);
  };

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
    //console.log(f1, f2);
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

  goog.array.forEach(featuresToMerge, function(ftm) {
    goog.asserts.assert(ftm.geometry.type === 'Polygon'
      || ftm.geometry.type === 'MultiPolygon');
    var ftmId = ftm.properties.id;
    goog.asserts.assert(!!ftmId);

    var sameIdFeature = goog.array.find(features, function(f) {
      return f.properties.id === ftmId;
    });


    if(sameIdFeature) {
      var start = new Date();
      var merged = mergeTwoFeatures(ftm, sameIdFeature);
      var olFeatures = this_.targetLayer.getSource().getFeatures();
      var olFeature = goog.array.find(olFeatures, function(f) {
        return f.get('id') === ftmId;
      });
      goog.asserts.assert(!!olFeature);
      var newGeom = this_.featureFormat.readGeometry(merged.geometry, {featureProjection: 'EPSG:3857'});
      olFeature.setGeometry(newGeom);
      goog.array.remove(features, sameIdFeature);
      features.push(merged);
    } else {
      features.push(ftm);
      geojsonFeatureToLayer(ftm, this_.targetLayer);
    }
  });

};
