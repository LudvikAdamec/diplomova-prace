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
goog.require('vectorTileLoader');
goog.require('mergeTools');
goog.require('logInfo');

goog.require('ol.Overlay.FeaturePopup');


goog.require('ol.source.MultiLevelVector');

goog.require('ol.Overlay');


var map;

/**
 * The main function.
 */
 app.wp.index = function() {
  map = new ol.Map({
    layers: [],
    renderer: 'canvas',
    target: document.getElementById('map'),
    view: new ol.View({
        center: ol.proj.fromLonLat([16.554, 49.246]),
        projection: 'EPSG:3857',
        maxZoom: 22,
        zoom: 12
      })
  });

  console.log(map);

  var bg =  new ol.layer.Tile({
    source: new ol.source.OSM()
  });

  //map.addLayer(bg);

  var geojsonFormat = new ol.format.GeoJSON({
    defaultDataProjection: 'EPSG:4326'
  });

  var tileGrid = ol.tilegrid.createXYZ({
    tileSize: 256
  });

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


  var obceSource = new ol.source.MultiLevelVector({
    view: map.getView()
  });

  var obceL = new ol.layer.Vector({
    source: obceSource,
    //minResolution: 310,
    maxResolution: 310,
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'rgba(27,50,95, 1)',
        width: 1.5
      })
    })
  });

  var okresySource = new ol.source.MultiLevelVector({
    view: map.getView()
  });

  var okresyL = new ol.layer.Vector({
    source: okresySource,
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'rgba(237,81,54, 1)',// 'rgba(245,20,20, 1)',
        width: 2.5
      })
    })
  });

  var krajeSource = new ol.source.MultiLevelVector({
    view: map.getView()
  });

  var krajeL = new ol.layer.Vector({
    source: krajeSource,
    //minResolution: 310,
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'rgba(27,50,95,1)',
        width: 5.7
      }),
      fill: new ol.style.Fill({
        color: 'rgba(233,242,249, 0.8)'
      })
    })
  });


  var katastralniuzemiSource = new ol.source.MultiLevelVector({
    view: map.getView()
  });

  var katastralniuzemiL = new ol.layer.Vector({
    source: katastralniuzemiSource,
    //minResolution: 310,
    maxResolution: 310,
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'white',
        width: 1,
      }),
      fill: new ol.style.Fill({
        color: 'rgba(156,196,228, 1)'
      })
    })
  });

  var parcelySource = new ol.source.MultiLevelVector({
    view: map.getView()
  });

  var parcelyL = new ol.layer.Vector({
    source: parcelySource,
    //minResolution: 310,
    maxResolution: 10,
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'black',
        width: 0.2
      })
    })
  });
  
  krajeL.set('name', 'Kraje');
  map.addLayer(krajeL);
  katastralniuzemiL.set('name', 'Katastralniuzemi');
  map.addLayer(katastralniuzemiL);
  obceL.set('name', 'Obce');
  map.addLayer(obceL);
  parcelyL.set('name', 'Parcely');
  map.addLayer(parcelyL);
  okresyL.set('name', 'Okresy');
  map.addLayer(okresyL);

  /**
   * parameters used ib spatialIndexLoader (make request on server from this parameters)
   * @type {Object}
   */
  var loaderParams = {
    db: {
      layerName : "obce", //"parcelswgs";
      dbname : "vfr_instalace2",
      geomColumn : "geometry_1",
      idColumn : "ogc_fid",
      url : "http://ruian-lu2.rhcloud.com/" //"http://localhost:9001/"
    },
    layers: {
      obce: obceSource,
      okresy: okresySource,
      kraje: krajeSource,
      katastralniuzemi: katastralniuzemiSource
    }
  };

  var loader = new spatialIndexLoader(loaderParams);
  var vtLoader = new vectorTileLoader(loaderParams); 
 

  var spatialLoaderFunction = function(extent, resolution, projection){
    var source = this;
    loader.loaderFunction(extent, resolution, projection, source);
  };
  
  var vectorSource;
  if(true == true){
    vectorSource = new ol.source.MultiLevelVector({
      loader: vtLoader.loaderFunction, // loaderFunctionVT,
      strategy: ol.loadingstrategy.tile(tileGrid),
      view: map.getView()
    });
  } else {
    vectorSource = new ol.source.MultiLevelVector({
      loader: spatialLoaderFunction, // loaderFunctionVT,
      strategy: ol.loadingstrategy.tile(tileGrid),
      view: map.getView()
    });
  }

    var hoverStyle = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'rgba(255, 0, 0, 1)',
            width: 2
        }),
        fill: new ol.style.Fill({
            color: 'rgba(255, 25, 25, 0.7)'
        })
    });

  var vector = new ol.layer.Vector({
    source: vectorSource,
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'green',
        width: 1
      }),
      fill: new ol.style.Fill({
        color: 'rgba(100, 0, 255, 0.5)'
      })
    })
    });

    map.addLayer(vector);

    /*map.on('click', function(evt) {
        var features = [];
        var feature = map.forEachFeatureAtPixel(evt.pixel,
            function(feature, layer) {
                features.push(feature);
            });
        if (features) {
            console.log("features on position: ", features);
        }
    });*/
    
    
    


    var findFeatureLayer = function(map, layer, pixel) {
        var f;
        map.forEachFeatureAtPixel(pixel, function(feature, actualLyr) {
            f = feature;
        }, this, function(lyr) {
            if(lyr.get('name')){
                //return true;
                return lyr.get('name') === layer.get('name');
            }
        });
        return f;
    };

    var onFeatureClick = function(evt, popup, map) {
        popup.hide();

        var i = 0;
        var features = [];
        var firstFeature;
        var fromLayer;
        var layers = map.getLayers().array_;
        var k = layers.length - 1;

        do {
            firstFeature = findFeatureLayer(map, layers[k], evt.pixel);
            if (firstFeature !== undefined) {
                fromLayer = layers[k];
            }
            k--;
        } while (k > 0 && firstFeature === undefined);


        if (firstFeature) {
            var feature = firstFeature,
                properties = feature.getKeys(),
                values = feature.getProperties();

            var headerLabel = '<strong>Vrstva: ' + fromLayer.get('name') + '</strong>';
            var ulContent = "";

            popup.headerLabel.innerHTML = headerLabel;
            
            var attributes = firstFeature.getKeys();

            for (i = 0; i < attributes.length; i++) {
                var attribute = firstFeature.get(attributes[i]);
                                
                var liContent = '<li class="property-item">' +
                                   '<div class="property-label">' +  attributes[i] + '</div>' +
                                    '<div class="property-value">' + attribute + '</div>' +
                                '</li>'; 
                
                ulContent = ulContent + liContent;
            }
            
            var popupContent = '<ul class="property-list">' + ulContent + '<ul>';
                
            var geometry = feature.getGeometry();
            if (geometry.getType() == "Point") {
                popup.show(geometry.getCoordinates(), popupContent);
            } else {
                popup.show(evt.coordinate, popupContent);
            }

        }
    };

    var popup = new ol.Overlay.FeaturePopup();
    map.addOverlay(popup);

    map.on('click', function(evt) {          
       evt.preventDefault();
       onFeatureClick(evt, popup, map);
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
    var newExtent = getExtentWithFactor(0.2, extent);
    
    newExtent = extent;
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


  var resetTimers = function() {
    timeStart = 0;
    timeFinish = 0;
    mergingStarted = 0;
    mergingFinished = 0;


    loadingStatusChange({
      "loadingTime": 0,
      "mergingTime": 0
    });
  };

  document.getElementById('resetTime').addEventListener("click", resetTimers);


};

goog.exportSymbol('main', app.wp.index);