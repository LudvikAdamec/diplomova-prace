

goog.provide('app.wp.index');

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

//goog.provide('ol.proj');



/**
 * The main function.
 */
 app.wp.index = function() {

 var image = new ol.style.Circle({
    radius: 5,
    fill: null,
    stroke: new ol.style.Stroke({color: 'red', width: 1})
  });

  var styles = {
    'Point': [new ol.style.Style({
      image: image
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
      image: image
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


  var vectorLayer = new ol.layer.Vector({
      source: new ol.source.Vector({
          features: (new ol.format.GeoJSON()).readFeatures( geojsonObject, {featureProjection: 'EPSG:3857'})
      }),
      style: styleFunction
  });



 
  var geojsonFormat = new ol.format.GeoJSON();



  var cachedTiles = [];
  var cachedFeatures = [];
  var cachedOlSource = new ol.source.Vector();

  /**
   * [getGeojson description]
   * @param  {ol.feature} feature [description]
   * @return {string}         [description]
   */
  var getGeojson = function(feature){
      return geojsonFormat.writeFeature(feature, {featureProjection: 'EPSG:3857'});
  };


  /**
   * [vektoroveDlazdice description]
   * @type {Array}
   */
  var vektoroveDlazdice = [];

  var arrToMerge = [];


  var status = "empty";
  /*setInterval(function(){
    if(status == "notEmpty");
  }, 1000);*/

  setTimeout(function(){
    effectiveMerging();
  }, 1500);

  var effectiveMerging = function(){
    var emptyQueue = function(){
      var data = {};
      data.features = [];

      for (var i = 0; i < arrToMerge.length; i++) {
        var dlazdice = JSON.parse(arrToMerge.shift());
        var geojsonTile = topojson.feature(dlazdice, dlazdice.objects.vectile);
        if(geojsonTile.features.length > 0){
          // data.features.push(geojsonTile.features);
          for (var i = 0; i < geojsonTile.features.length; i++) {
            data.features.push(geojsonTile.features[i]);
          };
          
          mergeData(data);
        }
      }

      effectiveMerging();

    };

    if(arrToMerge < 3){
      setTimeout(function(){
        emptyQueue();
      }, 400);
    } else {
      emptyQueue();
    }
  };

  /**
   * [successFunction description]
   * @param  {string} data [description]
   * @return {undefined}      [description]
   */
  var successFunction = function(data){
    arrToMerge.push(data);
    /*
      console.log("success");
      var dlazdice = JSON.parse(data);
      var geojsonTile = topojson.feature(dlazdice, dlazdice.objects.vectile);
      if(geojsonTile.features.length > 0){
          if (vectorLayer.getSource().getFeatures().length > 2) {
              mergeTile(geojsonTile);     
          } else {
              for(var i = 0; i < geojsonTile.features.length; i++){
                  geojsonFeatureToLayer(geojsonTile.features[i], vectorLayer);
              }
          }   
      }  */ 
  };

  var errorFunction = function(error){
    //console.log("loading err: ", error);
  };

  var geojsonFeatureToLayer = function( feature, layer ) {
      var f = new ol.format.GeoJSON();
      var olFeature =  f.readFeature( feature, {featureProjection: 'EPSG:3857'});
      layer.getSource().addFeature(olFeature);
  };

  var removeFeatures = function(features){
      for (var i = 0; i < features.length; i++) {
          vectorLayer.getSource().removeFeature(features[i]);
      };
  };

  var topoJsonURL = new ol.layer.Vector({
      preload: Infinity,
    source: new ol.source.TileVector({
      format: new ol.format.TopoJSON(),
      tileLoadFunction: function(url){
          $.ajax({url: url, success: successFunction, error: errorFunction});
      },
      url: 'http://localhost:9001/public/okresy//{z}/{x}/{y}.topojson',
      projection: 'EPSG:3857',
      tileGrid: ol.tilegrid.createXYZ({
        maxZoom: 23
      })  
    }),
    style: new ol.style.Style({
      fill: new ol.style.Fill({
        color: '#9db9e8'
      }),
      stroke: new ol.style.Stroke({
        color: "#ffccdd",
        width: 2
      })
    })
  });




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

              /**
               * [bfeatures description] features for buffer operation
               * @type {Array}
               */
               var bfeatures = [];

               mfeatures.push(features[i]);

              //najdi vsechny dalsi se stejnym id v teto tile
              for(var j = 0; j < features.length; j++){
                  if(features[i] !== features[j] && features[i].properties.id === features[j].properties.id){
                      mfeatures.push(features[j]);  //pridej segment
                      //bfeatures.push(turf.buffer(features[j], 5, "meters"));
                  }
              }


              //prohledej ostatni segments
              var featuresMap = vectorLayer.getSource().getFeatures();
              for(var l = 0; l < featuresMap.length; l++){
                  if(featuresMap[l].get('id') == mId){ 
                      var f = getGeojson(featuresMap[l]);
                      mfeatures.push(JSON.parse(f));
                      featuresToDelete.push(featuresMap[l]);
                  }
              }

              try {

                  var fc = turf.featurecollection(mfeatures);

                  //if(fc.features.length > 0){
                          var merged = turf.merge(fc);
                          //console.log("merged: ", merged);
                          geojsonFeatureToLayer(merged, vectorLayer);
                  //}

              } catch (erro){
                  console.log("chyba 1: ", erro);
                  break;
              } 

              
              removeFeatures(featuresToDelete);

              console.log("z teto tile je: ", mfeatures);
          }
      }
  };




  var map = new ol.Map({
    layers: [topoJsonURL, vectorLayer],
    renderer: 'canvas',
    target: document.getElementById('map'),
    view: new ol.View({
      center: ol.proj.fromLonLat([14.46418, 50.0756]),
      projection: 'EPSG:3857',
      maxZoom: 14,
      zoom: 10
    })
  });



























/*

var topoJsonURL2 = new ol.layer.Vector({
  source: new ol.source.TileVector({
    format: new ol.format.TopoJSON(),
    projection: 'EPSG:3857',
    tileGrid: ol.tilegrid.createXYZ({
      maxZoom: 25
    }),
    url: 'http://localhost:3100/okresy/{z}/{x}/{y}.topojson'
    //url: 'http://localhost:8080/okresy/{z}/{x}/{y}.topojson'
  }),
  style: new ol.style.Style({
    fill: new ol.style.Fill({
      color: '#9db9e8'
    }),
    stroke: new ol.style.Stroke({
      color: "#ffccdd",
      width: 2
    })
  })
});
*/



};
goog.exportSymbol('main', app.wp.index);
