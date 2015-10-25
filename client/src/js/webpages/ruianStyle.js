'use strict';
goog.provide('ruianStyle');

goog.require('ol.proj');
goog.require('goog.asserts');
goog.require('goog.array');
goog.require('featuresOperations');

goog.require('ol.style.Fill');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');
goog.require('ol.style.Circle');

//PREPATING styling for multiple layers...based on attributes and more...
ruianStyle = function(params) {
  this.styles = {
    'original_geom': [new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'yellow',
        width: 1
      }),
      fill: new ol.style.Fill({
        color: 'rgba(225, 0, 0, 0.5)'
      })
    })],
    'clipped_geom': [new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'blue',
        width: 1
      }),
      fill: new ol.style.Fill({
        color: 'rgba(100, 0, 255, 0.5)'
      })
    })]
  };

};

ruianStyle.prototype.createStyle = function(){ 
  console.log(this);
  var this_ = this;
  return function(feature, resolution){
    console.log("createStyle");

    if(feature.get('original_geom')){
      return this_.styles['original_geom'];
    } else {
      return this_.styles['clipped_geom'];
    }
  };

};
