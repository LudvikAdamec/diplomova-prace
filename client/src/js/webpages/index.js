'use strict';
//TODO: dodelat cache na dotazy identifikatoru v bbox...posila se nyni znytecne


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
goog.require('ol.proj');
goog.require('ol.LoadingStrategy');
goog.require('ol.geom.MultiPoint');
goog.require('ol.layer.Tile');
goog.require('ol.source.OSM');

goog.require('spatialIndexLoader');
//goog.require('featuresOperations');
goog.require('mergeTools');

goog.require('ruianStyle');


/**
 * The main function.
 */
 app.wp.index = function() {

  var method = "spatialIndexing";
  //var method = "vectorTiling";
  
  var styles = [
    new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'blue',
        width: 3
      }),
      fill: new ol.style.Fill({
        color: 'rgba(0, 0, 255, 0.1)'
      })
    })
  ];

  //var center = [14.46418, 50.0756];
  var center = [15.2, 49.43];
  var initZoom = 17;

  var map = new ol.Map({
    layers: [],
    renderer: 'canvas',
    target: document.getElementById('map'),
    view: new ol.View({
        center: ol.proj.fromLonLat(center),
        projection: 'EPSG:3857',
        maxZoom: 22,
        zoom: initZoom
      })
  });

  console.log(map);

  var bg =  new ol.layer.Tile({
    source: new ol.source.OSM()
  });

  map.addLayer(bg);

  var geojsonFormat = new ol.format.GeoJSON({
    defaultDataProjection: 'EPSG:4326'
  });

  var tileGrid = ol.tilegrid.createXYZ({
    tileSize: 256
  });

  var testGrid = ol.tilegrid.createXYZ({
    tileSize: 256
  });



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


  if(method == "spatialIndexing"){

    var loaderParams = {
      "map": {
        "map" : map
      },
      "db": {
        "layerName" : "parcelswgs", //"parcelswgs";
        "dbname" : "vfr",
        "geomColumn" : "geom_4326",
        "idColumn" : "ogc_fid",
        "url" : "http://localhost:9001/se/"
      } 
    };
    
    var geojsonFeatureToLayer = function(feature, layer ) {
      var id = feature.properties.id;
      var olFeature =  geojsonFormat.readFeature(feature, {featureProjection: 'EPSG:3857'});
      goog.asserts.assert(!!olFeature.get('id'));

      if(vectorSource.zooms[map.getView().getZoom()]){
        vectorSource.zooms[map.getView().getZoom()].push(olFeature);
      } else {
        vectorSource.zooms[map.getView().getZoom()] = [olFeature];
      }
    };

    /**
     * Create instance of loader and mergeTool then create loaderFunction which call loaderFunction in loader and add callback function param
     */
    var mergeTool = new mergeTools({
      "featureFormat": geojsonFormat,
      "map": map
    });

    var loader = new spatialIndexLoader(loaderParams);

    var loaderFunction = function(extent, resolution, projection) {
      var callback = function(responseFeatures, zoom){
        for (var j = 0; j < responseFeatures.length; j++) {
          if(responseFeatures[j].properties.original_geom){
            geojsonFeatureToLayer(responseFeatures[j], vector);
          } else {

            var mergeCallback = function(obj){
              if(!obj.update){
                geojsonFeatureToLayer(obj.geometry, vector);
              } else {
                var olFeatures = vector.getSource().getFeatures();
                var olFeature = goog.array.find(olFeatures, function(f) {
                  return f.get('id') === obj.feature.properties.id;
                });
                goog.asserts.assert(!!olFeature);
                olFeature.setGeometry(obj.geometry);
              }
            };
            mergeTool.addFeaturesOnZoom(responseFeatures[j], zoom);
            mergeTool.merge(mergeCallback, zoom);

          }
        }
      };
      loader.loaderFunction(extent,resolution, projection, callback);
    };

    ol.source.Vector.prototype.zooms = {
      16: [],
      17: [],
      18: [],
      19: [],
      20: []
    };

    ol.source.Vector.prototype.forEachFeatureInExtentAtResolution = function(extent, resolution, f, opt_this) {
      var features = this.zooms[map.getView().getZoom()];
      if(features.length){
        var keys = Object.keys(features); 
        if(keys.length){
          var i = 0;
          var ii = keys.length;
          for (i; i < ii; ++i) {
            var result = f.call(opt_this, features[keys[i]]);
            if (result) {
              return result;
            }
          } 
        }
      }
      return undefined;
    };

    ol.source.Vector.prototype.getFeatures = function() {
      var zooms = this.zooms;
      var features = [];
      var key;
      for (key in zooms) {
        goog.array.extend(features, zooms[key]);
      }
      return features;
    };

    var vectorSource = new ol.source.Vector({
      projection: 'EPSG:900913',
      loader: loaderFunction,
      strategy: ol.loadingstrategy.tile(tileGrid)
    });

    //var ruian = new ruianStyle();
    var ruianStyleFunction = (new ruianStyle()).createStyle();


    var vector = new ol.layer.Vector({
      source: vectorSource,
      style: new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: 'blue',
          width: 1
        }),
        fill: new ol.style.Fill({
          color: 'rgba(100, 0, 255, 0.5)'
        })
      })
    });

    map.addLayer(vector);
    console.log("source", vectorSource, " layer", vector);

    /**
     * get map extent for loading behind current map
     * @param  {[type]} factor [description]
     * @param  {[type]} extent [description]
     * @return {[type]}        [description]
     */
    var getExtentWithFactor = function (factor, extent) {
      if(factor > 0){
        var xdiff = (extent[2] - extent[0]) * factor,
        ydiff = (extent[3] - extent[1]) * factor;

        return [extent[0] - xdiff, extent[1] - ydiff, extent[2] + xdiff, extent[3] + ydiff];
      } else {
        return false;
      }
    };

    /**
     * method overriding strategy for preloading behind map extent
     * @param  {[type]} extent     [description]
     * @param  {[type]} resolution [description]
     * @return {[type]}            [description]
     */
    vectorSource.strategy_ = function (extent, resolution) {
      var newExtent = getExtentWithFactor(0.5, extent);

      var z = tileGrid.getZForResolution(resolution);
      var tileRange = tileGrid.getTileRangeForExtentAndZ(newExtent, z);
      var extents = [];
      var tileCoord = [z, 0, 0];
      for (tileCoord[1] = tileRange.minX; tileCoord[1] <= tileRange.maxX; ++tileCoord[1]) {
        for (tileCoord[2] = tileRange.minY; tileCoord[2] <= tileRange.maxY; ++tileCoord[2]) {
          extents.push(tileGrid.getTileCoordExtent(tileCoord));
        }
      }
      return extents;
    }; 



  } else if (method == "vectorTiling"){
    var styles = {
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
          width: 1
        }),
        fill: new ol.style.Fill({
          color: 'rgba(20, 100, 255, 0.5)'
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
      })]
    };

    var styleFunction = function(feature, resolution) {
      return styles[feature.getGeometry().getType()];
    };

    /**
     * Layer filled by merged vector tiles geometries
     * @type {ol}
     */
     var vectorLayer = new ol.layer.Vector({
      source: new ol.source.Vector(),
      style: styleFunction
    });


    var merge = new mergeTools({
      "targetLayer": vectorLayer,
      "featureFormat": geojsonFormat
    });

    var numberOfLoadingTiles = 0;
    
    /**
     * [successFunction description]
     * @param  {string} response [description]
     * @return {undefined}      [description]
     */
     var successFunction = function(response){
      goog.asserts.assert(numberOfLoadingTiles>0);
      merge.addTiles(JSON.parse(response));
      numberOfLoadingTiles--;
      if(!numberOfLoadingTiles) {

        var mergeCallback = function(obj){
          if(!obj.update){
            geojsonFeatureToLayer(obj.geometry, vectorLayer);
          } else {
            var olFeatures = vectorLayer.getSource().getFeatures();
            var olFeature = goog.array.find(olFeatures, function(f) {
              return f.get('id') === obj.feature.properties.id;
            });
            goog.asserts.assert(!!olFeature);
            olFeature.setGeometry(obj.geometry);
          }
        };
        merge.merge(mergeCallback);

      }
    };

    var errorFunction = function(error){
      goog.asserts.assert(numberOfLoadingTiles>0);
      numberOfLoadingTiles--;
      if(!numberOfLoadingTiles) {
        merge.merge();
      }
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
        tileGrid: tileGrid  
      })
    });

    map.addLayer(topojsonVTLayer);
    map.addLayer(vectorLayer);
  }


};

goog.exportSymbol('main', app.wp.index);