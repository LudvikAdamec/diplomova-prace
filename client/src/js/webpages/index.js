

goog.provide('app.wp.index');

goog.require('goog.asserts');
goog.require('ol.Map');
goog.require('ol.View');
goog.require('ol.format.TopoJSON');
goog.require('ol.layer.Vector');
goog.require('ol.proj');
goog.require('ol.source.TileVector');
goog.require('ol.style.Fill');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');
goog.require('ol.source.Vector');
goog.require('ol.style.Circle');
goog.require('ol.style.Style')
goog.require('ol.format.GeoJSON');
goog.require('ol.tilegrid.TileGrid');


/**
 * The main function.
 */
 app.wp.index = function() {


  /**
   * Styles for identification merged geometry type 
   *   
   * @type {Object}
   */
  var styles = {
    'Point': [new ol.style.Style({
      image: new ol.style.Circle({
        radius: 5,
        fill: null,
        stroke: new ol.style.Stroke({color: 'red', width: 1})
      })
    })],
    'LineString': [new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'green',
        width: 1
      })
    })],
    'MultiLineString': [new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'green',
        width: 1
      })
    })],
    'MultiPoint': [new ol.style.Style({
      image: new ol.style.Circle({
        radius: 5,
        fill: null,
        stroke: new ol.style.Stroke({color: 'red', width: 1})
      })
    })],
    'MultiPolygon': [new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'yellow',
        width: 3
      }),
      fill: new ol.style.Fill({
        color: 'rgba(0, 155, 0, 0.3)'
      })
    })],
    'Polygon': [new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'blue',
        lineDash: [4],
        width: 3
      }),
      fill: new ol.style.Fill({
        color: 'rgba(155, 0, 155, 0.3)'
      })
    })],
    'GeometryCollection': [new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'magenta',
        width: 2
      }),
      fill: new ol.style.Fill({
        color: 'magenta'
      }),
      image: new ol.style.Circle({
        radius: 10,
        fill: null,
        stroke: new ol.style.Stroke({
          color: 'magenta'
        })
      })
    })],
    'Circle': [new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'red',
        width: 2
      }),
      fill: new ol.style.Fill({
        color: 'rgba(255,0,0,0.2)'
      })
    })]
  };

  var styleFunction = function(feature, resolution) {
    return styles[feature.getGeometry().getType()];
  };

  //pomucka pro lokalizaci polohy v mape pri nenacteni ostatnich vrstev
  var geojsonObject = {
    'type': 'FeatureCollection',
    'crs': {
      'type': 'name',
      'properties': {
        'name': 'EPSG:4326'
      }
    },
    'features': [
      {
        'type': 'Feature',
        'geometry': {
          'type': 'Point',
          'coordinates': [14.46418, 50.0756]
        }
      }
    ]
  };

  /**
   * Layer filled by merged vector tiles geometries
   * @type {ol}
   */
  var vectorLayer = new ol.layer.Vector({
      source: new ol.source.Vector({
          features: (new ol.format.GeoJSON()).readFeatures( geojsonObject, {featureProjection: 'EPSG:3857'})
      }),
      style: styleFunction
  });

  var geojsonFormat = new ol.format.GeoJSON();

  /**
   * Method for converting ol.feature to geojson feature
   * @param  {[type]} feature [description]
   * @return {[type]}         [description]
   */
  var getGeojson = function(feature){
      return geojsonFormat.writeFeature(feature, {featureProjection: 'EPSG:3857'});
  };

  /**
   * stores loaded data before merging and adding to map
   * @type {Array}
   */
  var arrToMerge = [];

  /**
   * Simple function for merging timing 
   * @return {[type]} [description]
   */
  var effectiveMerging = function(){

    var data = {};
    data.features = [];
    console.log('pocet dlazdic arrToMerge', arrToMerge.length);
    while(arrToMerge.length) {
      var dlazdice = JSON.parse(arrToMerge.shift());
      var geojsonTile = topojson.feature(dlazdice, dlazdice.objects.vectile);
      console.log('pocet objektu v dlazdici', arrToMerge.length+1, ':', geojsonTile.features.length);
      if(geojsonTile.features.length > 0){
        for (var i = 0; i < geojsonTile.features.length; i++) {
          data.features.push(geojsonTile.features[i]);
        };
        mergeData(data);
      }
    }

  };

  var numberOfLoadingTiles = 0;
  
  /**
   * [successFunction description]
   * @param  {string} data [description]
   * @return {undefined}      [description]
   */
  var successFunction = function(data){
    goog.asserts.assert(numberOfLoadingTiles>0);
    arrToMerge.push(data);
    numberOfLoadingTiles--;
    console.log('pocet zbyvajicich dlazdic k nahrani', numberOfLoadingTiles);
    if(!numberOfLoadingTiles) {
      effectiveMerging();
    }
  };

  var errorFunction = function(error){
    goog.asserts.assert(numberOfLoadingTiles>0);
    numberOfLoadingTiles--;
    if(!numberOfLoadingTiles) {
      effectiveMerging();
    }
    console.log("Error: ", error);
  };

  /**
   * Create new ol.features from geojson feature and added to layer
   * @param  {[type]} feature [description]
   * @param  {[type]} layer   [description]
   * @return {[type]}         [description]
   */
  var geojsonFeatureToLayer = function( feature, layer ) {
      var f = new ol.format.GeoJSON();
      var olFeature =  f.readFeature( feature, {featureProjection: 'EPSG:3857'});
      layer.getSource().addFeature(olFeature);
  };

  /**
   * Remove features from vectorLayer
   * @param  {[type]} features [description]
   * @return {[type]}          [description]
   */
  var removeFeatures = function(features){
      for (var i = 0; i < features.length; i++) {
          vectorLayer.getSource().removeFeature(features[i]);
      };
  };

  //topojson layer with tileLoadFunction for merging and adding features to vectorLayer
  var topojsonVTLayer = new ol.layer.Vector({
      preload: Infinity,
      source: new ol.source.TileVector({
      format: new ol.format.TopoJSON(),
      tileLoadFunction: function(url){
        numberOfLoadingTiles++;
          $.ajax({url: url, success: successFunction, error: errorFunction});
      },
      url: 'http://localhost:9001/public/tiles/parcels/{z}/{x}/{y}.topojson',
      //url: 'http://localhost:9001/public/tiles/delaunyho/{z}/{x}/{y}.topojson',
      //url: 'http://localhost:9001/public/tiles/hexagon/{z}/{x}/{y}.topojson',
      //url: 'http://localhost:9001/public/okresy//{z}/{x}/{y}.topojson',
      projection: 'EPSG:3857',
      tileGrid: ol.tilegrid.createXYZ({
        maxZoom: 23
      })  
    })
  });

  /**
   * function for finding feature parts, merging and adding to vectorLayer
   * @param  {object} data  - object containing features (array of geojson features)
   * @return {[type]}      [description]
   */
  var mergeData = function(data) {    
      var mergedIds = [];

      var features = data.features;
      for (var i = 0; i < features.length; i++) {
          if(mergedIds.indexOf(features[i].properties.id) === -1){
              var mId = features[i].properties.id;
              var nameId = features[i].properties.nazev;
              
              if(mId == 'undefined'){
                  console.log("undefined identificator -- unable to merge");
              }

              mergedIds.push(mId);
              var featuresToDelete = [];

              /**
               * [mSegments description] features for merge
               * @type {Array}
               */
               var mfeatures = [];

               mfeatures.push(features[i]);

              //najdi vsechny dalsi se stejnym id v features.data
              for(var j = 0; j < features.length; j++){
                  if(features[i] !== features[j] && features[i].properties.id === features[j].properties.id){
                      mfeatures.push(features[j]);  //pridej segment
                  }
              }

              //prohledej ostatni features
              var featuresMap = vectorLayer.getSource().getFeatures();
              for(var l = 0; l < featuresMap.length; l++){
                  if(featuresMap[l].get('id') == mId){ 
                      var f = getGeojson(featuresMap[l]);
                      mfeatures.push(JSON.parse(f));
                      featuresToDelete.push(featuresMap[l]);
                  }
              }

              try {

                if(mfeatures.length > 1){
                  var fc = turf.featurecollection(mfeatures);
                  var merged = turf.merge(fc);
                  geojsonFeatureToLayer(merged, vectorLayer);
                } else if(mfeatures.length == 1){
                  geojsonFeatureToLayer(mfeatures[0], vectorLayer);
                }


              } catch (erro){
                  console.log("ERROR - merge data: ", erro);
                  for (var k = 0; k < mfeatures.length; k++) {
                    //prida alespon puvodni rozdelene geometrie aby nedoslo k jejich ztrate
                    geojsonFeatureToLayer(mfeatures[k], vectorLayer);
                    
                  };
              } 

              removeFeatures(featuresToDelete);
          }
      }
  };


  var map = new ol.Map({
    layers: [topojsonVTLayer, vectorLayer],
    renderer: 'canvas',
    target: document.getElementById('map'),
    view: new ol.View({
      //center: ol.proj.fromLonLat([14.46418, 50.0756]),
      center: ol.proj.fromLonLat([15.2, 49.43]),
      projection: 'EPSG:3857',
      maxZoom: 22,
      zoom: 17
    })
  });

};

goog.exportSymbol('main', app.wp.index);
