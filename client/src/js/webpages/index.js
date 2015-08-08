

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


  /*
  

  TODO:
  - dodelat effectiveMerging
  - predelat mergTile na mergeTiles
  - predelat succes styleFunction

    var arrToMerge = [];

    makeAsyncFunction = function(time, ){
      
    }

    var effectiveMerging = function(){
      if(arrToMerge < 3){
        setTimeout(effectiveMerging, 300);
      } else {
        var toNextMerge  = [];
        var length = arrToMerge.length;
        for(var i = 0; i < length; i++){
          toNextMerge.push(arrToMerge[i]);
        }
        
        arrToMerge.splice(0, length);

        merge(toNextMerge);
      }
    }

  */

  /**
   * [successFunction description]
   * @param  {string} data [description]
   * @return {undefined}      [description]
   */
  var successFunction = function(data){
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
      }   
  };

  var errorFunction = function(error){
    //console.log("loading err: ", error);
  };

  var geojsonFeatureToLayer = function( feature, layer ) {
      var f = new ol.format.GeoJSON();
          var olFeature =  f.readFeature( feature, {featureProjection: 'EPSG:3857'});
          layer.getSource().addFeature(olFeature);

          console.log("ol.f po pridani", getGeojson(olFeature));
      /*setTimeout(function(){
          var f = new ol.format.GeoJSON();
          var olFeature =  f.readFeature( feature, {featureProjection: 'EPSG:3857'});
          layer.getSource().addFeature(olFeature);
      }, 10);*/
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



  /**
   * [mergeLoadedTile description]
   * @param  {obj} loadedTiles - array of loaded tiles
   * @return {undefined}             [description]
   */
   var mergeTile = function(newTile) {
      console.log("mergeTile");
      var loadedTiles;
      var completedFeatures = {};
      var mergedIds = [];


      var features = newTile.features;
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

               console.log("actual type: ", features[i].geometry.type);
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

              //try {

                  var geometryWithAttr;
                  try {
                    geometryWithAttr = JSON.parse(JSON.stringify(mfeatures[0]));
                  } catch (err){
                    console.log("error in parsing: ", err);
                  }

                  var geoReader = new jsts.io.GeoJSONReader(),
                      geoWriter = new jsts.io.GeoJSONWriter();

                  var newGeometry;
                  var isFirstLoop = true;


                  //TODO dodelat atributz
                  if(mfeatures.length > 1){
                    do {
                      var a = geoReader.read(mfeatures[0]);
                      mfeatures.shift();
                      var aValid = a.geometry.isValid();

                      if(aValid){
                        if(mfeatures.length > 0 && isFirstLoop){
                          var b = geoReader.read(mfeatures[0]);
                          mfeatures.shift()
                          var bValid = b.geometry.isValid();
                          if(bValid){
                            newGeometry = a.geometry.union(b.geometry);
                          } else {
                            console.log("invalid geometry");
                          }
                        } else if(newGeometry !== undefined){
                          newGeometry  = newGeometry.union(a);
                        } 
                      } else {
                        console.log("invalid geometry");
                      }

                      isFirstLoop = false;
                    } while (mfeatures.length > 0);
                  } else if (mfeatures.length == 1){
                    newGeometry = geoReader.read(mfeatures[0]).geometry;
                    if(!newGeometry.isValid()){
                      console.log("invalid geometry");
                    }
                  }

                  console.log("geom: ",  JSON.stringify(geoWriter.write(newGeometry)));

                  try {
                    geometryWithAttr.geometry = geoWriter.write(newGeometry);
                    geojsonFeatureToLayer(geometryWithAttr, vectorLayer);
                    //removeFeatures(featuresToDelete);
                  } catch (err){
                    console.log("eror in parsing newGeometry: ", err);
                    break;
                  }
                  //console.log("newGeometry: ", geoWriter.write(newGeometry));

                  
                  //newGeometry = undefined;


              /*} catch (erro){
                console.log("chyba 1: ", erro);
                break;
              } */

                      }
      }
  };




  var map = new ol.Map({
    layers: [topoJsonURL, vectorLayer],
    renderer: 'canvas',
    target: document.getElementById('map'),
    view: new ol.View({
      center: ol.proj.fromLonLat([14.96418, 49.0756]),
      projection: 'EPSG:3857',
      maxZoom: 14,
      zoom: 10
    })
  });

  console.log(map);
  console.log(vectorLayer);



























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
