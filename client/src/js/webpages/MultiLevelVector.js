
goog.provide('ol.source.MultiLevelVector');

goog.require('ol.source.Vector');

/**
 * @classdesc
 * Layer source to MultiLevelVector vector data.
 *
 * @constructor
 * @param {olx.source.MultiLevelVectorOptions} options
 * @extends {ol.source.Vector}
 * @api
 */
ol.source.MultiLevelVector = function(opt_options) {

  var options = goog.isDef(opt_options) ? opt_options : {};

  goog.base(this, {
    attributions: options.attributions,
    logo: options.logo,
    projection: undefined,
    state: ol.source.State.READY,
    wrapX: goog.isDef(options.wrapX) ? options.wrapX : true
  });

  this.tileGrid = ol.tilegrid.createXYZ({
    tileSize: 256
  });

  //nastaveni view
  this.view = options.view;

  var _this = this;

  /**
   * @private
   * @type {ol.FeatureLoader}
   */
  this.loader_ = goog.nullFunction;

  if (goog.isDef(options.loader)) {
    this.loader_ = options.loader;
  } else if (goog.isDef(options.url)) {
    goog.asserts.assert(goog.isDef(options.format),
        'format must be set when url is set');
    // create a XHR feature loader for "url" and "format"
    this.loader_ = ol.featureloader.xhr(options.url, options.format);
  }

  /**
   * @private
   * @type {ol.LoadingStrategy}
   */
  this.strategy_ = goog.isDef(options.strategy) ? options.strategy :
      ol.loadingstrategy.all;

  var useSpatialIndex =
      goog.isDef(options.useSpatialIndex) ? options.useSpatialIndex : true;

  /**
   * @private
   * @type {ol.structs.RBush.<ol.Feature>}
   */
  this.featuresRtree_ = useSpatialIndex ? new ol.structs.RBush() : null;

  /**
   * @private
   * @type {ol.structs.RBush.<{extent: ol.Extent}>}
   */
  this.loadedExtentsRtree_;

  this.loadedExtentsRtrees_ = {};


  /**
   * @private
   * @type {Object.<string, ol.Feature>}
   */
  this.nullGeometryFeatures_ = {};

  /**
   * A lookup of features by id (the return from feature.getId()).
   * @private
   * @type {Object.<string, ol.Feature>}
   */
  this.idIndex_ = {};

  /**
   * A lookup of features without id (keyed by goog.getUid(feature)).
   * @private
   * @type {Object.<string, ol.Feature>}
   */
  this.undefIdIndex_ = {};

  /**
   * @private
   * @type {Object.<string, Array.<goog.events.Key>>}
   */
  this.featureChangeKeys_ = {};

  /**
   * @private
   * @type {ol.Collection.<ol.Feature>}
   */
  this.featuresCollection_ = null;

  var collection, features;
  if (options.features instanceof ol.Collection) {
    collection = options.features;
    features = collection.getArray();
  } else if (goog.isArray(options.features)) {
    features = options.features;
  }
  if (!useSpatialIndex && !goog.isDef(collection)) {
    collection = new ol.Collection(features);
  }
  if (goog.isDef(features)) {
    this.addFeaturesInternal(features);
  }
  if (goog.isDef(collection)) {
    this.bindFeaturesCollection_(collection);
  }

};
goog.inherits(ol.source.MultiLevelVector, ol.source.Vector);

/**
 * Add a feature without firing a `change` event.
 * @param {ol.Feature} feature Feature.
 * @protected
 */
ol.source.MultiLevelVector.prototype.addFeatureInternal = function(feature) {
  var featureKey = goog.getUid(feature).toString();

  if (!this.addToIndex_(featureKey, feature)) {
    return;
  }

  this.setupChangeEvents_(featureKey, feature);

  var geometry = feature.getGeometry();
  if (goog.isDefAndNotNull(geometry)) {
    var extent = geometry.getExtent();
    extent = feature.get('extent');
    if (!goog.isNull(this.featuresRtree_)) {
      this.featuresRtree_.insert(extent, feature);
    }
  } else {
    var extent = feature.get('extent');
    feature.set('active_geom', undefined);
    this.featuresRtree_.insert(extent, feature);
  }

  this.dispatchEvent(
      new ol.source.VectorEvent(ol.source.VectorEventType.ADDFEATURE, feature));
};

/**
 * Iterate through all features whose bounding box intersects the provided
 * extent (note that the feature's geometry may not intersect the extent),
 * calling the callback with each feature.  If the callback returns a "truthy"
 * value, iteration will stop and the function will return the same value.
 *
 * If you are interested in features whose geometry intersects an extent, call
 * the {@link ol.source.Vector#forEachFeatureIntersectingExtent
 * source.forEachFeatureIntersectingExtent()} method instead.
 *
 * When `useSpatialIndex` is set to false, this method will loop through all
 * features, equivalent to {@link ol.source.Vector#forEachFeature}.
 *
 * @param {ol.Extent} extent Extent.
 * @param {function(this: T, ol.Feature): S} callback Called with each feature
 *     whose bounding box intersects the provided extent.
 * @param {T=} opt_this The object to use as `this` in the callback.
 * @return {S|undefined} The return value from the last call to the callback.
 * @template T,S
 * @api
 */
ol.source.MultiLevelVector.prototype.forEachFeatureInExtent =
    function(extent, callback, opt_this) {
  if (!goog.isNull(this.featuresRtree_)) {
    
    var res = this.view.getResolution();
    var geomRow = 'geometry_' + this.getLODforRes(res);
    this.featuresRtree_.forEachInExtent(extent, function(feature){
      var newGeom = feature.get(geomRow);
      var active_geom = feature.get('active_geom');
      
      if(newGeom && (active_geom === undefined || active_geom !== geomRow)){
        //funcionality for decreasing count of setgeometry on feature
        feature.setGeometry(newGeom);
        feature.set('active_geom', geomRow);
      }
      
    }, opt_this);
    
    return this.featuresRtree_.forEachInExtent(extent, callback, opt_this);
  } else if (!goog.isNull(this.featuresCollection_)) {
    return this.featuresCollection_.forEach(callback, opt_this);
  }
};

/**
 * @param {ol.Extent} extent Extent.
 * @param {number} resolution Resolution.
 * @param {ol.proj.Projection} projection Projection.
 */
ol.source.MultiLevelVector.prototype.loadFeatures = function(
    extent, resolution, projection) {
  
  var LOD = this.getLODforRes(resolution);
  var loadedExtentsRtree = this.loadedExtentsRtrees_[LOD];
  if(loadedExtentsRtree === undefined){
    this.loadedExtentsRtrees_[LOD] = new ol.structs.RBush();
    loadedExtentsRtree = this.loadedExtentsRtrees_[LOD];
  } 

  var extentsToLoad = this.strategy_(extent, resolution);
  var i, ii;
  for (i = 0, ii = extentsToLoad.length; i < ii; ++i) {
    var extentToLoad = extentsToLoad[i];
    var alreadyLoaded = loadedExtentsRtree.forEachInExtent(extentToLoad,
        /**
         * @param {{extent: ol.Extent}} object Object.
         * @return {boolean} Contains.
         */
        function(object) {
          return ol.extent.containsExtent(object.extent, extentToLoad);
        });
    if (!alreadyLoaded) {
      this.loader_.call(this, extentToLoad, resolution, projection);
      loadedExtentsRtree.insert(extentToLoad, {extent: extentToLoad.slice()});
    }
  }
};


/**
 * @param {goog.events.Event} event Event.
 * @private
 */
ol.source.MultiLevelVector.prototype.handleFeatureChange_ = function(event) {
  var feature = /** @type {ol.Feature} */ (event.target);
  var featureKey = goog.getUid(feature).toString();
  var geometry = feature.getGeometry();
  if (!goog.isDefAndNotNull(geometry)) {
    if (!(featureKey in this.nullGeometryFeatures_)) {
      if (!goog.isNull(this.featuresRtree_)) {
        this.featuresRtree_.remove(feature);
      }
      this.nullGeometryFeatures_[featureKey] = feature;
    }
  } else {
    //
    //
    //
    //
    // WAS CHANGED: extent z atributu
    //
    //
    //
    //
    var extent = geometry.getExtent();
    extent = feature.get('extent');
    if (featureKey in this.nullGeometryFeatures_) {
      delete this.nullGeometryFeatures_[featureKey];
      if (!goog.isNull(this.featuresRtree_)) {
        this.featuresRtree_.insert(extent, feature);
      }
    } else {
      if (!goog.isNull(this.featuresRtree_)) {
        this.featuresRtree_.update(extent, feature);
      }
    }
  }
  var id = feature.getId();
  var removed;
  if (goog.isDef(id)) {
    var sid = id.toString();
    if (featureKey in this.undefIdIndex_) {
      delete this.undefIdIndex_[featureKey];
      this.idIndex_[sid] = feature;
    } else {
      if (this.idIndex_[sid] !== feature) {
        removed = this.removeFromIdIndex_(feature);
        goog.asserts.assert(removed,
            'Expected feature to be removed from index');
        this.idIndex_[sid] = feature;
      }
    }
  } else {
    if (!(featureKey in this.undefIdIndex_)) {
      removed = this.removeFromIdIndex_(feature);
      goog.asserts.assert(removed,
          'Expected feature to be removed from index');
      this.undefIdIndex_[featureKey] = feature;
    } else {
      goog.asserts.assert(this.undefIdIndex_[featureKey] === feature,
          'feature keyed under %s in undefIdKeys', featureKey);
    }
  }
  this.changed();
  this.dispatchEvent(new ol.source.VectorEvent(
      ol.source.VectorEventType.CHANGEFEATURE, feature));
};



ol.source.MultiLevelVector.prototype.getLODforRes = function(resolution){
  var step = 1;
  if (resolution <= step ){
    return 9;
  } else if(resolution <= step * 2){
    return 8;
  } else if(resolution <= step * 4){
    return 7;
  } else if(resolution <= step * 8){
    return 6;
  } else if(resolution <= step * 16){
    return 5;
  } else if(resolution <= step * 32){
    return 4;
  } else if(resolution <= step * 64){
    return 3;
  } else if(resolution <= step * 128){
    return 2;
  } else if(resolution <= step * 256){
    return 1;
  } else {
    return 1;
  }

};


ol.source.MultiLevelVector.prototype.getLODforZ = function(z){
  if (z > 17 ){
    return 9;
  } else if(z >= 17){
    return 8;
  } else if(z >= 16){
    return 7;
  } else if(z >= 15){
    return 6;
  } else if(z >= 14){
    return 5;
  } else if(z >= 13){
    return 4;
  } else if(z >= 12){
    return 3;
  } else if(z >= 11){
    return 2;
  } else if(z >= 10){
    return 1;
  } else {
    return 1;
  }
};
