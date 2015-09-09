

goog.provide('app.wp.index');

goog.require('goog.asserts');
goog.require('goog.array');
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
  
  var geojsonFormat = new ol.format.GeoJSON({
    defaultDataProjection: 'EPSG:4326'
  });

  /**
   * Layer filled by merged vector tiles geometries
   * @type {ol}
   */
  var vectorLayer = new ol.layer.Vector({
      source: new ol.source.Vector({
          features: geojsonFormat.readFeatures( geojsonObject, {featureProjection: 'EPSG:3857'})
      }),
      style: styleFunction
  });

  /**
   * stores loaded data before merging and adding to map
   * @type {Array}
   */
  var tilesToMerge = [];

  var allFeatures = [];
  /**
   * Simple function for merging timing 
   * @return {[type]} [description]
   */
  var mergeTiles = function(){
    while(tilesToMerge.length) {
      var dlazdice = tilesToMerge.shift();
      var geojsonTile = topojson.feature(dlazdice, dlazdice.objects.vectile);
      if(geojsonTile.features.length > 0) {
        mergeFeatures(allFeatures, geojsonTile.features);
      }
    }
  };

  var numberOfLoadingTiles = 0;
  
  /**
   * [successFunction description]
   * @param  {string} response [description]
   * @return {undefined}      [description]
   */
  var successFunction = function(response){
    goog.asserts.assert(numberOfLoadingTiles>0);
    tilesToMerge.push(JSON.parse(response));
    numberOfLoadingTiles--;
    if(!numberOfLoadingTiles) {
      mergeTiles();
    }
  };

  var errorFunction = function(error){
    goog.asserts.assert(numberOfLoadingTiles>0);
    numberOfLoadingTiles--;
    if(!numberOfLoadingTiles) {
      mergeTiles();
    }
  };

  /**
   * Create new ol.features from geojson feature and added to layer
   * @param  {[type]} feature [description]
   * @param  {[type]} layer   [description]
   * @return {[type]}         [description]
   */
  var geojsonFeatureToLayer = function(feature, layer ) {
    var id = feature.properties.id;
    var olFeature =  geojsonFormat.readFeature(feature, {featureProjection: 'EPSG:3857'});
    goog.asserts.assert(!!olFeature.get('id'));
    layer.getSource().addFeature(olFeature);
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
   * @param  {object} features already existing and merged features
   * @param  {object} featuresToMerge features to merge
   * @return {[type]}      [description]
   */
  var mergeFeatures = function(features, featuresToMerge) {
      
    var featureToFeatures = function(f) {
      goog.asserts.assert(f.geometry.type === 'Polygon'
          || f.geometry.type === 'MultiPolygon');
      if(f.geometry.type === 'Polygon') {
        return [f];
      } else {
        return goog.array.map(f.geometry.coordinates, function(polygon) {
          return turf.polygon(polygon, f.properties);
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
        var fc = turf.featurecollection(features);
        var merged = turf.merge(fc);
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
        var merged = mergeTwoFeatures(ftm, sameIdFeature);
        var olFeatures = vectorLayer.getSource().getFeatures();
        var olFeature = goog.array.find(olFeatures, function(f) {
          return f.get('id') === ftmId;
        });
        goog.asserts.assert(!!olFeature);
        var newGeom = geojsonFormat.readGeometry(merged.geometry, {featureProjection: 'EPSG:3857'});
        olFeature.setGeometry(newGeom);
        goog.array.remove(features, sameIdFeature);
        features.push(merged);
      } else {
        features.push(ftm);
        geojsonFeatureToLayer(ftm, vectorLayer);
      }
    });
      
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
