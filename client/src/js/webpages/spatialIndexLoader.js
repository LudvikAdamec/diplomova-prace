
goog.provide('spatialIndexLoader');

goog.require('ol.proj');
goog.require('goog.asserts');
goog.require('goog.array');


spatialIndexLoader = function(initialCount) {
    this._count = initialCount || 0;
    this.url = "http://localhost:9001/se/";
    this.idCache = [];
}

spatialIndexLoader.load = function (k, v) {
    return spatialIndexLoader.loaderFunction;
}; 

spatialIndexLoader.prototype.loaderFunction = function(extent, resolution, projection, callback) {
  var this_ = this;
  var a = ol.proj.toLonLat([extent[0], extent[1]]);
  var b = ol.proj.toLonLat([extent[2], extent[3]]);

  var data = {
    "layerName": "parcelswgs",
    //"x": a[0] - (a[0] - b[0]),
    //"y": a[1] - (a[1] - b[1]),
    //"z": map.getView().getZoom(),
    "requestType": "getFeaturesIdInBbox",
    "extent": [a[0], a[1], b[0], b[1]]
  };

  $.ajax({
    url: this.url + data.requestType,
    type: "get",
    data: data,
    datatype: 'json',
    success: function(data){
      this_.loaderSuccess(data, function(responseFeatures){
        callback(responseFeatures);
      });
    },
    error:function(er){
      return console.log("chyba: ", er);
    }   
  }); 

};

spatialIndexLoader.prototype.loaderSuccess = function(data, callback){
  var idsNotInCache = this.selectNotCachedId(data.featuresId);
  if(idsNotInCache.length > 0){
    var param = {
      url: this.url,
      type: "get",
      data:  {
        "layerName": "parcelswgs",
        //"z": data.z,
        "requestType": "getFeaturesById",
        "ids": idsNotInCache
      }
    };
    
    $.ajax({
      url: param.url + param.data.requestType,
      type: "get",
      data:  {
        "layerName": "parcelswgs",
        "z": param.data.z,
        "requestType": param.data.requestType,
        "ids": param.data.ids
      },
      datatype: 'json',
      success: function(data){
        var features = data.FeatureCollection.features;
        callback(features);
      },
      error:function(er){
        console.log("chyba: ", er);
      }   
    }); 



    //loadFeaturesByIds(params);
  }
};

spatialIndexLoader.prototype.selectNotCachedId = function(ids) {
  var notCached = "";
  for (var i = 0; i < ids.length; i++) {
    if(this.idCache.indexOf(ids[i]) == -1){
      this.idCache.push(ids[i]);
      if(notCached == ""){
        notCached = "'" + ids[i] + "'";
      } else {
        notCached = notCached + ", '" +  ids[i] + "'";
      }

    }
  };

  return notCached;

};

spatialIndexLoader.loadFeaturesByIds = function (param) {
};
