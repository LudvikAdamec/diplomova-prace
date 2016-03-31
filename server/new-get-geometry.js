// Located in: ./new-get-geometry.js
var nano = require('nano')('http://localhost:5984');
var pg = require('pg');

var NewGetGeometry = function(req, res, client){
	var this_ = this;
	this.req = req;
	this.res = res;

	this.feature_collection = {
		"type": "FeatureCollection",
		"features": []
	};

	this.layerName = req.param('layer');
	this.dbName = req.param('db');
	this.geomRow = req.param('geom');
	this.idColumn = req.param('idColumn');
	this.clipBig = req.param('clipBig');
	this.extent = req.param('extent');
	this.idsInLayer = req.param('idsInLayer');


	this.extentConverted = this.extent.map(function(x) {
		return parseFloat(x, 10);
	});

	this.extent = this.extentConverted;

	this.extentArea = (this.extent[2] - this.extent[0]) * (this.extent[3] - this.extent[1]);
	this.layerNames = Object.keys(this.idsInLayer);
	this.layersToLoad = 0;//layerNames.length;
	//layersToLoadSum = layersToLoadSum + layersToLoad;
	this.ready = false;

	if(client){
		this.client = client;
		this.sharedPool = true;
		this.init();
	} else {	
		var connectionString = "postgres://postgres:postgres@localhost/" + this.dbName;
		pg.connect(connectionString, function(err, client, done) {
			if (err) {
				console.log('err2', err);
			}
			this.sharedPool = false;
			this_.client = client;
			this_.done = done;
			this_.init();
		});
	}
};

NewGetGeometry.prototype.init = function(){
	for (var i = 0; i < this.layerNames.length; i++) {
		if(i == this.layerNames.length - 1 ){
			this.ready = true;
		}

		this.layersToLoad++;

		if (this.idsInLayer[this.layerNames[i]] != '') {
			this.queryGeometryInLayers(this.layerNames[i], this.idsInLayer[this.layerNames[i]]);
		} else {
			this.queryGeometryInLayersCallback([]);
		}
	}
};

NewGetGeometry.prototype.queryGeometryInLayers = function(layerName, ids){
	var this_ = this;
	var queryString;
	var features = [];
	if(this.clipBig != "true"){
		/*queryString = 'SELECT ' + idColumn + ' AS id, ' + 
						"ST_AsGeoJSON(' + geomRow + ', 5) AS geom, " +
						"ST_XMin(geometry_9) AS minx, " + 
						"ST_YMin(geometry_9) AS miny, " + 
						"ST_XMax(geometry_9) AS maxx, " + 
					"ST_YMax(geometry_9) AS maxy " +
				  'FROM ' + layerName + ' WHERE ' + idColumn + ' IN(' + ids + ')';*/
	} else {
		var envelop = "ST_MakeEnvelope(" + this.extent[0] + ", " + this.extent[1] + ", " + this.extent[2] + ", " + this.extent[3] + ", 4326)";
		queryString = "" +  
		"SELECT " + 
		this.idColumn + " AS id, " +
		"ST_AsGeoJSON(" + this.geomRow + ", 6) AS geom, " +
		"CASE   WHEN ST_Area(" + this.geomRow + " ) > " + (this.extentArea * 2) + 
		" THEN ST_AsGeoJSON(ST_Intersection( " + envelop + ", " + this.geomRow + " ), 6)" +
		" ELSE 'null'" +
		" END AS clipped_geom, " + 
		"CASE   WHEN ST_Area(" + this.geomRow + " ) <= " + (this.extentArea * 2) + 
		" THEN " + "ST_AsGeoJSON(" + this.geomRow + ", 6 ) "  +
		" ELSE 'null' " +
		" END AS original_geom " +
		"FROM " + layerName + " " +
		"WHERE " + this.idColumn + " IN(" + ids + ")";
	}  

	var query = this.client.query(queryString, function(err, content){
		if(err){
			console.log('err3',err);
		}
	});

	query.on('row', function(row) {        
		var geom;

		if(this_.clipBig != "true"){
			geom = row.geom;
		} else {
			if(row.clipped_geom == 'null') {
				geom = row.original_geom;
			} else {
				geom = row.clipped_geom;
			}
		}

		var jsonFeature = {
			"type": "Feature",
			"properties": {
				"id": row.id,
				"layer": layerName
			},
			"geometry": JSON.parse(geom)
		};


		jsonFeature.properties['geomRow'] = this_.geomRow;

		if(row.clipped_geom == 'null') {
			jsonFeature.properties['original_geom'] = true;
		} else {
			jsonFeature.properties['original_geom'] = false;
		}

		features.push(jsonFeature);
	});

	query.on('end', function() {
		this_.queryGeometryInLayersCallback(features);
		//done();
	});

};


NewGetGeometry.prototype.queryGeometryInLayersCallback = function(features){
	//dWait++;
	for (var i = 0; i < features.length; i++) {
		this.feature_collection.features.push(features[i]);
	}

	this.layersToLoad--;
	
	if (this.layersToLoad <= 0) {
		this.res.json({
			"FeatureCollection": this.feature_collection,
			"ids": this.idsInLayer,
			"level": this.req.param('level')
		});

		if(!this.sharedPool){
    		this.done();
    	}
		
		//done();
		//this.client.end();
		//pg.end();
	}
};


module.exports = NewGetGeometry;
