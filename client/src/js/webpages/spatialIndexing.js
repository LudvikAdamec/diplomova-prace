var waterLayer = new ol.layer.Vector({
  source: new ol.source.TileVector({
    format: new ol.format.GeoJSON(),
    projection: 'EPSG:900913',
    tileGrid: ol.tilegrid.createXYZ({
      maxZoom: 19
    }),
    //url: 'http://localhost:9001/server/spatialIndexing/data/{z}/{x}/{y}.topojson',
    url: 'http://localhost:9001/public/tiles/se/{z}/{x}/{y}.geojson'
  }),
  style: new ol.style.Style({
    fill: new ol.style.Fill({
      color: '#9db9e8'
    }),
    stroke: new ol.style.Stroke({
      color: 'magenta',
      width: 2
    })
  })
});

var styles = [
  /* We are using two different styles for the polygons:
   *  - The first style is for the polygons themselves.
   *  - The second style is to draw the vertices of the polygons.
   *    In a custom `geometry` function the vertices of a polygon are
   *    returned as `MultiPoint` geometry, which will be used to render
   *    the style.
   */
  new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: 'blue',
      width: 3
    }),
    fill: new ol.style.Fill({
      color: 'rgba(0, 0, 255, 0.1)'
    })
  }),
  new ol.style.Style({
    image: new ol.style.Circle({
      radius: 2,
      fill: new ol.style.Fill({
        color: 'orange'
      })
    }),
    geometry: function(feature) {
      // return the coordinates of the first ring of the polygon
      var coordinates = feature.getGeometry().getCoordinates()[0];
      return new ol.geom.MultiPoint(coordinates);
    }
  })
];

var idCache = [];

var parseToFeatureCache = function (data) {
  var fc = {};
  try {
    fc = JSON.parse(data);
    featureCache.push(fc.features);

  } catch (error) {
    console.log(error)
  }

}

var loadFeatures = function (param) {
  $.ajax({
    url: param.url,
    type: "get",
    data:  {
      "layerName": "parcelswgs",
      "z": param.data.z,
      "requestType": param.data.requestType,
      "ids": param.data.ids
    },
    datatype: 'json',
    success: function(data){
      setTimeout(parseToFeatureCache(data.FeatureCollection), 10);
      //console.log("yeeeeeeeeeeeeeeees");
      //console.log(data)
      /*var fc = {};
      try {
        fc = JSON.parse(data.FeatureCollection);

      } catch (error) {
        console.log(error)
      }
      if( fc.features.length != data.ids.length ){
        console.log("feature = ids :", fc.features.length, data.ids.length);
      }
      */
      //setTimeout()
      //featureCache.push(fc.features);
      /*for (var i = 0; i < fc.features.length; i++) {
        //console.log("id: ", fc.features[i].properties.id);
        //console.log("---------");
        //console.log("před" ,map.getLayers().getArray(0)[0].getSource().getFeatures().length);
        geojsonFeatureToLayer(fc.features[i], vector);

        //console.log("po" ,map.getLayers().getArray(0)[0].getSource().getFeatures().length);
        //console.log("---------");
       //geojsonFeatureToLayer(fc.features[i], vector), 1000);
        
      };*/

      //console.log("FeatureCollection: ", fc);

      


      //var data = JSON.parse(data);
      //console.log(data.bboxJson);
      //console.log(JSON.stringify(data.fc));
    },
    error:function(er){
      console.log("chyba: ", er);
    }   
  }); 
};

var vectorSource = new ol.source.Vector({
  projection: 'EPSG:900913',
  loader: function(extent, resolution, projection) {
    //console.log("extent, resolution, projection: ", extent, resolution, projection);
    var url = "http://localhost/cgi-bin/first.py";
    //var url = "http://localhost/test/first.py";
     /*$.getJSON(url, function(response) {
       console.log("JSON response: " + response);
    });*/
      
      //console.log("arguments: ", arguments);

      /*
      var data = {
        "extent": {
          "minX": extent[0],
          "minY": extent[1],
          "maxX": extent[2],
          "maxY": extent[3]
        }, 
        "resolution": resolution,
        "requestType": "getFeaturesIdInBbox"
      };*/

      var a = ol.proj.toLonLat([extent[0], extent[1]])
      var b = ol.proj.toLonLat([extent[2], extent[3]])

      var data = {
        "layerName": "parcelswgs",
        "x": a[0] - (a[0] - b[0]),
        "y": a[1] - (a[1] - b[1]),
        "z": map.getView().getZoom(),
        "requestType": "getFeaturesIdInBbox"
      }



      $.ajax({
        url: url,
        type: "get",
        data: data,
        datatype: 'json',
        success: function(data){
              //console.log(data)
              var zoom = data.z;
              var ids = data.featuresId;
              var idsNotInCache = [];
              for (var i = 0; i < ids.length; i++) {
                if(idCache.indexOf(ids[i]) == -1){
                  idCache.push(ids[i]);
                  idsNotInCache.push(ids[i]);
                }
              };
              //console.log(ids);


              if(idsNotInCache.length > 0){
                //TODO: dodelat Z souradnici
                param = {
                  url: url,
                  type: "get",
                  data:  {
                    "layerName": "parcelswgs",
                    "z": zoom,
                    "requestType": "getFeaturesById",
                    "ids": idsNotInCache
                  }
                };
                setTimeout(loadFeatures(param), 10);
              }
            },
        error:function(er){
          console.log("chyba: ", er);
        }   
      }); 

  },
  strategy: ol.loadingstrategy.tile(ol.tilegrid.createXYZ({
    tileSize: 256
  }))
});



var vector = new ol.layer.Vector({
  source: vectorSource,
  style: styles
  /*style: new ol.style.Style({
    fill: new ol.style.Fill({
      color: 'rgba(45,67,113, 0.4)'
    }),
    stroke: new ol.style.Stroke({
      color: 'magenta',
      width: 2,
    })
  })*/
});

var featureCache = [];

  /**
   * Simple function for merging timing 
   * @return {[type]} [description]
   */
  var effectiveMerging = function(){

    var emptyQueue = function(){
      for (var i = 0; i < featureCache.length; i++) {
        var features = featureCache.shift();
        for (var j = 0; j < features.length; j++) {
          setTimeout(geojsonFeatureToLayer(features[j], vector), 10);
        }
      }

      effectiveMerging();
    };

    if(featureCache < 3){
      setTimeout(function(){
        emptyQueue();
      }, 400);
    } else {
      emptyQueue();
    }
  };

effectiveMerging();

var addNextFromCache = function(){

}

 var geojsonFeatureToLayer = function( feature, layer ) {
      var f = new ol.format.GeoJSON();
      var olFeature =  f.readFeature( feature, {featureProjection: 'EPSG:3857'});
      layer.getSource().addFeature(olFeature);
  };




var map = new ol.Map({
  layers: [/*waterLayer,*/ vector],
  renderer: 'canvas',
  target: document.getElementById('map'),
  view: new ol.View({
    center: ol.proj.fromLonLat([15.2, 49.43]),
    maxZoom: 18,
    zoom: 16,
    projection: 'EPSG:900913'
  })
});


tileGrid = ol.tilegrid.createXYZ({
    tileSize: 256
});

var getExtentWithFactor = function (factor, extent) {
  if(factor > 0){
    var xdiff = (extent[2] - extent[0]) * factor,
        ydiff = (extent[3] - extent[1]) * factor;

    return [extent[0] - xdiff, extent[1] - ydiff, extent[2] + xdiff, extent[3] + ydiff];
  } else {
    return false;
  }
}

vectorSource.strategy_ = function (extent, resolution) {
  var newExtent = getExtentWithFactor(0.5, extent);

  var z = tileGrid.getZForResolution(resolution);
  var tileRange = tileGrid.getTileRangeForExtentAndZ(newExtent, z);
  var extents = [];
  var tileCoord = [z, 0, 0];
  for (tileCoord[1] = tileRange.minX; tileCoord[1] <= tileRange.maxX;
       ++tileCoord[1]) {
    for (tileCoord[2] = tileRange.minY; tileCoord[2] <= tileRange.maxY;
         ++tileCoord[2]) {
      extents.push(tileGrid.getTileCoordExtent(tileCoord));
    }
  }
  return extents;
} 
