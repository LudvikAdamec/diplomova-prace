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
goog.require('mergeTools');

goog.require('ol.source.MultiLevelVector');

goog.require('ol.Overlay');

/**
 * The main function.
 */
 app.wp.index = function() {

  var method = "spatialIndexing";
  //var method = "vectorTiling";


  var center = [15.2, 49.43];
  center = [16.554, 49.246]
  
  var initZoom = 12;

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

  if(method == "spatialIndexing"){

    /**
     * function add  geojson feature
     * @param  {[type]} feature - geojson feature
     * @param  {[type]} layer   - target ol.layer
     * @param  {[type]} level    - level of detail of feature
     * @return {undefined}         
     */
    var geojsonFeatureToLayer = function(feature, layer, level ) {
      var olFeature =  geojsonFormat.readFeature(feature, {featureProjection: 'EPSG:3857'});
      vectorSource.addFeature(olFeature);
    };

    /**
     *  instance of mergeTool
     */
    var mergeTool = new mergeTools({
      "featureFormat": geojsonFormat
    });

    /**
     * parameters used ib spatialIndexLoader (make request on server from this parameters)
     * @type {Object}
     */
    var loaderParams = {
      "db": {
        "layerName" : "obce", //"parcelswgs";
        "dbname" : "vfr",
        "geomColumn" : "geometry_1",
        "idColumn" : "ogc_fid",
        "url" : "http://localhost:9001/se/"
      } 
    };


    var loader = new spatialIndexLoader(loaderParams);

    /**
     * count of currently loading extents (after getting response is count decreased)
     * @type {Number}
     */
    var loadingExtents = 0;


    /*
      specific loader function - take care for loading data, merging and displaying them on map
        - different behaviour for original not divided geometries and splited geometries
     */
    var loaderFunction = function(extent, resolution, projection) {

      loadingStatusChange({"statusMessage": 'loading <i class="fa fa-spinner fa-spin"></i>'});
      
      var callback = function(responseFeatures, level, decrease){

        if(decrease){
          loadingExtents--;
        }

        if(loadingExtents == 0){
          var contentSize = Math.round(loader.loadedContentSize * 100) / 100;
          loadingStatusChange({
            "statusMessage": 'extent loaded <i class="fa fa-check"></i>', 
            "sizeMessage": contentSize + 'mb'
          });
        }

        for (var j = 0; j < responseFeatures.length; j++) {
          var mergeCallback = function(responseObject){
            if(responseObject.mergingFinished){
              loadingStatusChange({"statusMessage": '<i class="fa fa-check"></i>'});
            } else {
                var olFeatures = vector.getSource().getFeatures();
                var olFeature = goog.array.find(olFeatures, function(f) {
                  return f.get('id') === responseObject.feature.properties.id;
                });
                goog.asserts.assert(!!olFeature);
                if(olFeature){
                  var olFeatureee =  geojsonFormat.readFeature(responseObject.feature);
                  olFeature.set(responseObject.feature.properties.geomRow, responseObject.geometry);
                }
            }
          };

          if(decrease){
            geojsonFeatureToLayer(responseFeatures[j], vector, level);
          } else {
            if(responseFeatures[j].properties.original_geom){
              var olFeatures = vector.getSource().getFeatures();
              var olFeature = goog.array.find(olFeatures, function(f) {
                return f.get('id') === responseFeatures[j].properties.id;
              });

              if(olFeature){
                var olFeatureee =  geojsonFormat.readFeature(responseFeatures[j], {featureProjection: 'EPSG:3857'});
                var testGe = geojsonFormat.readGeometry(responseFeatures[j].geometry, {featureProjection: 'EPSG:3857'}); 
                var newGeometry = olFeatureee.getGeometry();
                olFeature.set(responseFeatures[j].properties.geomRow, testGe);
                //vectorSource.changed();
              }

            } else {
              mergeTool.addFeaturesOnLevel(responseFeatures[j], level);
              if(loadingExtents == 0 && mergeTool.featuresToMergeOnLevel[level].length){
                loadingStatusChange({"statusMessage": 'merging <i class="fa fa-spinner fa-spin"></i>'});
                mergeTool.merge(mergeCallback, level);
                //skutecne to ma byt tady to changed a ne v merge callback
                //vectorSource.changed();
              }
            }

          }

        }
      };

      loader.loaderFunction(extent,resolution, projection ,callback);
      loadingExtents++;

    };

    var vectorSource = new ol.source.MultiLevelVector({
      loader: loaderFunction,
      strategy: ol.loadingstrategy.tile(tileGrid),
      view: map.getView()
    });

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
   
    map.on('click', function(evt) {
      var feature = map.forEachFeatureAtPixel(evt.pixel,
          function(feature, layer) {
            return feature;
          });
      if (feature) {
          console.log("id: ", feature.get('id'), feature);
      }
    });

    /**
     * create extent for loading behind current map - factor increase current map extent (0 = not increased extent)
     * @param  {[type]} factor
     * @param  {[type]} extent - current map extent
     * @return {[type]} new calculated extent or false
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
      "featureFormat": geojsonFormat
    });

    var numberOfLoadingTiles = 0;
    var loadedContentSize = 0;

    
    /**
     * [successFunction description]
     * @param  {string} response [description]
     * @return {undefined}      [description]
     */
     var successFunction = function(response, status, xhr){
      loadedContentSize += parseInt(xhr.getResponseHeader('Content-Length')) / (1024 * 1024);

      goog.asserts.assert(numberOfLoadingTiles > 0);
      merge.addTiles(JSON.parse(response));
      numberOfLoadingTiles--;
      if(!numberOfLoadingTiles) {

        var mergeCallback = function(obj){
          if(!obj.mergingFinished){
            if(!obj.updateExisting){
              geojsonFeatureToLayer(obj.geometry, vectorLayer);
            } else {
              var olFeatures = vectorLayer.getSource().getFeatures();
              var olFeature = goog.array.find(olFeatures, function(f) {
                return f.get('id') === obj.feature.properties.id;
              });
              goog.asserts.assert(!!olFeature);
              olFeature.setGeometry(obj.geometry);
            }
          } else {
            loadingStatusChange({
              "statusMessage": '<i class="fa fa-check"></i>',
              "sizeMessage": ((Math.round(loadedContentSize * 100) / 100) + 'mb')
            });
          }
        };

        loadingStatusChange({"statusMessage": '<i class="fa fa-check"></i>'});
        merge.merge(mergeCallback);

      }
    };

    var errorFunction = function(error){
      goog.asserts.assert(numberOfLoadingTiles>0);
      numberOfLoadingTiles--;
      if(!numberOfLoadingTiles) {
          loadingStatusChange({"statusMessage": 'merging <i class="fa fa-spinner fa-spin"></i>'});
          merge.merge();
      }
    };

    //topojson layer with tileLoadFunction for merging and adding features to vectorLayer
    var topojsonVTLayer = new ol.layer.Vector({
      preload: Infinity,
      source: new ol.source.TileVector({
        format: new ol.format.TopoJSON(),
        tileLoadFunction: function(url){
          loadingStatusChange({"statusMessage": 'loading <i class="fa fa-spinner fa-spin"></i>'});
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


  var loadingStatusChange = function (statusObject){    
    if(statusObject.sizeMessage){
      var sizeDiv = document.getElementById('sizeStatus');
      sizeDiv.innerHTML = "";
      sizeDiv.innerHTML = statusObject.sizeMessage;
    }

    if(statusObject.statusMessage){
      var statusDiv = document.getElementById('loadingStatus');
      statusDiv.innerHTML = "";
      statusDiv.innerHTML = statusObject.statusMessage;
    }

  };

};

goog.exportSymbol('main', app.wp.index);