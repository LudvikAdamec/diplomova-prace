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

//goog.require('ol.FeatureOverlay');

goog.require('ol.source.MultiLevelVector');

goog.require('ol.Overlay');


var map;

/**
 * The main function.
 */
app.wp.index = function() {

    var init = function(selectedMethod) {
        
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

        var bg = new ol.layer.Tile({
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
        var geojsonFeatureToLayer = function(feature, layer, level) {
            var olFeature = geojsonFormat.readFeature(feature, { featureProjection: 'EPSG:3857' });
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
                
        map.addLayer(krajeL);
        map.addLayer(katastralniuzemiL);
        map.addLayer(obceL);
        map.addLayer(parcelyL);
        map.addLayer(okresyL);

        /**
         * parameters used ib spatialIndexLoader (make request on server from this parameters)
         * @type {Object}
         */
        var loaderParams = {
            db: {
                dbname: "vfr_instalace2",
                geomColumn: "geometry_1",
                idColumn: "ogc_fid",
                url: document.location.origin //"http://localhost:9001/"
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

        var spatialLoaderFunction = function(extent, resolution, projection) {
            var source = this;
            loader.loaderFunction(extent, resolution, projection, source);
        };

        var vectorSource;
        if (selectedMethod == 'selectVT') {
            vectorSource = new ol.source.MultiLevelVector({
                loader: vtLoader.loaderFunction, // loaderFunctionVT,
                strategy: ol.loadingstrategy.tile(tileGrid),
                view: map.getView()
            });
        } else if(selectedMethod == 'selectSIS'){
            vectorSource = new ol.source.MultiLevelVector({
                loader: spatialLoaderFunction, // loaderFunctionVT,
                strategy: ol.loadingstrategy.tile(tileGrid),
                view: map.getView()
            });
        }

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

        var getFeatureLayerAtPixel = function(pixel) {
            var featuresAtPixel = {};
            var layerName;
            var selected;
            var feature = map.forEachFeatureAtPixel(pixel, function(f, layer) {
                if (layer.get('name')) {
                    featuresAtPixel[layer.get('name')] = {
                        'feature': f,
                        'layer': layer
                    };
                }
                //return feature;
            });

            if (Object.keys(featuresAtPixel).length > 0) {
                if (featuresAtPixel.Obce) {
                    selected = featuresAtPixel.Obce;
                } else if (featuresAtPixel.Okresy) {
                    selected = featuresAtPixel.Okresy;
                } else if (featuresAtPixel.Kraje) {
                    selected = featuresAtPixel.Kraje;
                }
            }

            return selected;

        };

        var onFeatureClick = function(evt, popup, map) {
            popup.hide();

            var selected = getFeatureLayerAtPixel(evt.pixel);
            
            if (selected) {
                var feature = selected.feature,
                    fromLayer = selected.layer,
                    properties = feature.getKeys(),
                    values = feature.getProperties();

                var headerLabel = '<strong>Vrstva: ' + fromLayer.get('name') + '</strong>';
                var ulContent = "";

                popup.headerLabel.innerHTML = headerLabel;

                var attributes = feature.getKeys();

                for (var i = 0; i < attributes.length; i++) {
                    var attribute = feature.get(attributes[i]);

                    var liContent = '<li class="property-item">' +
                        '<div class="property-label">' + attributes[i] + '</div>' +
                        '<div class="property-value">' + attribute + '</div>' +
                        '</li>';

                    ulContent = ulContent + liContent;
                }

                var popupContent = '<ul class="property-list">' + ulContent + '<ul>';

                var geometry = feature.getGeometry();
                
                popupLayer.getSource().addFeature(feature);
                if (geometry.getType() == "Point") {
                    popup.show(geometry.getCoordinates(), popupContent);
                } else {
                    popup.show(evt.coordinate, popupContent);
                }

            }
        };
        
        //layer for storing overlay features
        var collection = new ol.Collection();
        var featureOverlay = new ol.layer.Vector({
            map: map,
            source: new ol.source.Vector({
                features: collection,
                useSpatialIndex: false
            }),
            style: new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: 'rgba(255,0,0, 0)',
                    width: 2
                }),
                fill: new ol.style.Fill({
                    color: 'rgba(255,0,0,0.3)'
                })
            }),
            updateWhileAnimating: true,
            updateWhileInteracting: true
        });

        var highlight;
        var displayFeatureInfo = function(pixel) {
            var selectedFeature;
            if (highlight) {
                featureOverlay.getSource().removeFeature(highlight);
                highlight = null;
            }

            var selectedFeature = getFeatureLayerAtPixel(pixel);
            if (selectedFeature) {
                selectedFeature = selectedFeature.feature;
                if (selectedFeature !== highlight) {
                    if (selectedFeature) {
                        featureOverlay.getSource().addFeature(selectedFeature);
                    }
                    highlight = selectedFeature;
                }
            }

        };
        
        //LAYER for storing selected feature with popup
        var selectedFeature;
        var selectedCollection = new ol.Collection();
        var popupLayer = new ol.layer.Vector({
            map: map,
            source: new ol.source.Vector({
                features: selectedCollection,
            }),
            style: new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: 'rgba(255,255, 0, 0.5)',
                    width: 2
                }),
                fill: new ol.style.Fill({
                    color: 'rgba(200,200, 10, 1)'
                })
            }),
            updateWhileAnimating: true,
            updateWhileInteracting: true
        });

        var popup = new ol.Overlay.FeaturePopup();
        map.addOverlay(popup);
   
        popup.on('close', function (params) {
           popupLayer.getSource().clear();
        });

        map.on('click', function(evt) {
            evt.preventDefault();
            onFeatureClick(evt, popup, map);
        });

        map.on('pointermove', function(evt) {
            if (evt.dragging) {
                return;
            }
            var pixel = map.getEventPixel(evt.originalEvent);
            displayFeatureInfo(pixel);
        });

        map.on('click', function(evt) {
            displayFeatureInfo(evt.pixel);
        });



        /**
         * create extent for loading behind current map - factor increase current map extent (0 = not increased extent)
         * @param  {[type]} factor
         * @param  {[type]} extent - current map extent
         * @return {[type]} new calculated extent or false
         */
        var getExtentWithFactor = function(factor, extent) {
            if (factor > 0) {
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
        vectorSource.strategy_ = function(extent, resolution) {
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
        
        krajeL.set('name', 'Kraje');
        katastralniuzemiL.set('name', 'Katastralniuzemi');
        obceL.set('name', 'Obce');
        parcelyL.set('name', 'Parcely');
        okresyL.set('name', 'Okresy');

        
        document.getElementById('control-status-wrapper').addEventListener('click', function () {
            var contentDiv = document.getElementById('statusWrapper');
            if(contentDiv.style.display == 'none'){
                contentDiv.style.display = 'block';
            } else {
                contentDiv.style.display = 'none';
            }
        });
        
        document.getElementById('control-status-wrapper').style.display = 'block';

        var log = new logInfo();
        var resetTimers = function() {
            timeStart = 0;
            timeFinish = 0;
            mergingStarted = 0;
            mergingFinished = 0;
            log.loadingStatusChange({
                "loadingTime": 0,
                "mergingTime": 0,
                "sizeMessage": 0
            });
        };

        document.getElementById('resetTime').addEventListener("click", resetTimers);

    };

    document.getElementById('selectVT').addEventListener('click', function () {
        document.getElementById('chooseMethodPanel').style.display = 'none';
        init('selectVT');
    });
    
    document.getElementById('selectSIS').addEventListener('click', function () {
        document.getElementById('chooseMethodPanel').style.display = 'none';
        init('selectSIS');
    });

};

goog.exportSymbol('main', app.wp.index);