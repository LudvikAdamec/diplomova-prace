goog.provide('featuresOperations');

goog.require('ol.proj');
goog.require('goog.asserts');
goog.require('goog.array');

/**
 * [featuresOperations description]
 * @return {[type]} [description]
 */
featuresOperations = function() {};

featuresOperations.prototype.buildPolygon = function(coordinates, properties){
	var polygon = {
		"type": "Feature",
		"geometry": {
			"type": "Polygon",
			"coordinates": coordinates
		},
		"properties": properties
	};

	if (!polygon.properties) {
		polygon.properties = {};
	}

	return polygon;
};

featuresOperations.prototype.mergePolygons = function(polygons) {
	var merged = polygons[0];
	for (var i = 0; i < polygons.length; i++) {
		if(polygons[i].geometry){
			merged = this.buildUnion(merged, polygons[i]);
		}
	}
	return merged;
};

featuresOperations.prototype.buildUnion = function(poly1, poly2){
	var reader = new jsts.io.GeoJSONReader();
	var a = reader.read(JSON.stringify(poly1.geometry));
	var b = reader.read(JSON.stringify(poly2.geometry));
	var union = a.union(b);
	var parser = new jsts.io.GeoJSONParser();

	union = parser.write(union);
	return {
		type: 'Feature',
		geometry: union,
		properties: poly1.properties
	};
};