// Located in: ./render-tile.js
var nano = require('nano')('http://localhost:5984');
var pg = require('pg');
var TGrid = require('./tilegrid.js');
var topojson = require("topojson");

var convertGeoToTopo = function (feature_collection) {
  //var topology = topojson.topology({collection: feature_collection, propertyTransform: function propertyTransform(feature) {return feature.properties;}});
  var topology = topojson.topology({collection: feature_collection},{"property-transform":function(object){return object.properties;}});

  return topology;
};

var renderTile = function(req, res, loadTopojsonFormat, client){
	var this_ = this;
	this.req = req;
	this.res = res;
	this.dbName = 'vfr_instalace2';
	this.idColumn = 'ogc_fid';
    this.loadTopojsonFormat = loadTopojsonFormat;

	if(loadTopojsonFormat){
		this.test_db = nano.db.use('topo_multi_db');
	} else {
		this.test_db = nano.db.use('geo_multi_db');
	}

	this.loadFromCache = false;
    //this.loadFromCache = true;

	this.layersToLoad = 0;

	if(loadTopojsonFormat){
		this.resObject = {
			"type": "FeatureCollection",
			"features": []
		};
	} else {
		this.resObject = {};
	}

	this.xyz = {
		'x': parseInt(req.param('x'), 10),
		'y': parseInt(req.param('y'), 10), 
		'z': parseInt(req.param('z'), 10)
	};

	this.ty = TGrid.gyToTy(this.xyz.y, this.xyz.z);
	this.bound = TGrid.TileLatLonBounds(this.xyz.x, this.ty + 1, this.xyz.z);
	this.id = this.xyz.x + '-' + this.xyz.y + '-' + this.xyz.z;

	this.existRowCache = {};

	this.existRowInDBCount = 0;

	if(client){
		this.client = client;
		this_.init();
		this.sharedPool = true;
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

renderTile.prototype.init = function(){
	var this_ = this;
	if(this.loadFromCache){
		//ziskani dlazdice pokud je v TGrid...pokud neni tak se vygeneruje a vlozi do CouchDB TGrid
		this.test_db.get(this.id, function(err, body) {
			if (!err) {
				this_.res.json({ "xyz" : this_.xyz, 'json': body.FeatureCollection, 'bound': this_.bound});
                this_.done();
			} else {
				var layers = ['obce', 'okresy', 'kraje', 'katastralniuzemi', 'parcely'];
				for (var i = 0; i < layers.length; i++) {
					this_.layersToLoad++;
					this_.existRowInDB(layers[i], 'geometry_' + TGrid.getGeomLODforZ(this_.xyz.z));
				}
			}
		});
	} else {
		var layers = ['obce', 'okresy', 'kraje', 'katastralniuzemi', 'parcely'];
		for (var i = 0; i < layers.length; i++) {
			this.layersToLoad++;
			this_.existRowInDB(layers[i], 'geometry_' + TGrid.getGeomLODforZ(this.xyz.z));
		  //getTile([bound[1], bound[0], bound[3], bound[2]], layers[i], 'vfr_instalace2',  'geometry_' + TGrid.getGeomLODforZ(xyz.z), 'ogc_fid', callback, loadTopojsonFormat);
	  }
	}
};


renderTile.prototype.existRowCallback = function(exist, layerName, geomRow){
	if(exist){
		this.getTile(layerName, geomRow);
	} else {
		this.layersToLoad--;
		if(this.layersToLoad == 0){
			this.res.json({ "xyz" : this.xyz, 'json': this.resObject, 'bound': this.bound});

			if(!this.sharedPool){
	    		this.done();
	    	}
			
			//this.done();
		}
	}
};

renderTile.prototype.existRowInDB = function(layerName, geomRow) {   
	var this_ = this;

	if (this.existRowCache[layerName]) {
		if (this.existRowCache[layerName][geomRow] != undefined) {
			if (this.existRowCache[layerName][geomRow] == true) {
				this.existRowCallback(true, layerName, geomRow);
				return;
			} else {
				this.existRowCallback(false);
				return;
			}
		}
	} else {
		this.existRowCache[layerName] = {};
	}

	var query = this.client.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2', [layerName, geomRow], function(err, result) {
		if (result.rowCount > 0) {
			this_.existRowCache[layerName][geomRow] = true;
			this_.existRowCallback(true, layerName, geomRow);
		} else {
			this_.existRowCache[layerName][geomRow] = false;
			this_.existRowCallback(false);
		}
	});

	query.on('end', function() {
		this_.existRowInDBCount--;
		//client.end();
		//pg.end();
	});

	/*if (err) {
		console.log('err3', err);
	}*/
};


renderTile.prototype.getTile = function(layerName, geomRow){
	var this_ = this;
	var extent = [this.bound[1], this.bound[0], this.bound[3], this.bound[2]];


	var extentConverted = extent.map(function (x) {
		return parseFloat(x, 10);
	});

	var feature_collection = {
		"type": "FeatureCollection",
		"features": []
	};

	var envelop =  'ST_MakeEnvelope(' + extentConverted[0] + ', ' + extentConverted[1] + ', ' + extentConverted[2] + ', ' + extentConverted[3] + ', 4326)';

  
  	var queryString = ' SELECT ' + this.idColumn + ' AS id, ' +
                  'ST_AsGeoJSON(ST_Intersection( ' + envelop + ', ' + geomRow + ' ), 6) AS geom, ' +
                  'FROM ' + layerName + ' WHERE ' + layerName + '.' + geomRow + '&&' + envelop;

  	queryString = ' SELECT ' + this.idColumn + ' AS id, ' +
                  "ST_XMin(ST_Transform(" + geomRow + ",3857)) AS minx, ST_YMin(ST_Transform(" + geomRow + ", 3857)) AS miny, ST_XMax(ST_Transform(" + geomRow + ", 3857)) AS maxx, ST_YMax(ST_Transform(" + geomRow + ", 3857)) AS maxy, " +

                  'CASE WHEN ' + geomRow + ' @ ' + envelop + 
                    ' THEN ST_AsGeoJSON(' + geomRow + ', 6)' +
                    ' ELSE ST_AsGeoJSON(ST_Intersection( ' + envelop + ', ' + geomRow + ' ), 6) ' +
                    ' END AS geom, ' +
                   'CASE WHEN ' + envelop + ' @ ' + geomRow + 
                    ' THEN 1' +
                    ' ELSE 0' +
                    ' END AS status ' +  
                  'FROM ' + layerName + ' WHERE ' + layerName + '.' + geomRow + '&&' + envelop;

	var query = this.client.query(queryString, function(err, result){
		if(err){
			console.log(err);
		}
	});

	query.on('row', function(row) {   
		var geom;
		geom = row.geom;

		var jsonFeature = {
			"type": "Feature",
			"properties": {
				"id": row.id,
				"status": row.status,
				"extent": [row.minx, row.miny, row.maxx, row.maxy]

			},
			"geometry": JSON.parse(geom)
		};

		if(this_.loadTopojsonFormat){
			jsonFeature.properties.layer = layerName;
		}

		jsonFeature.properties['geomRow'] = geomRow;
		feature_collection.features.push(jsonFeature);
	});

	query.on('end', function() {
		//client.end();
		this_.getTileCallback(feature_collection, layerName);
		//pg.end();
		return 0;
	});

	/*if(err) {
		console.log(err);
	}*/

};


renderTile.prototype.getTileCallback = function(feature_collection, layerName){
	this.layersToLoad--; 
    var fCount = feature_collection.features.length;
    var jsonData = feature_collection;

    //TOPO TODO: predelat na jedno pole a dat vsechny features do nej
    //UDELAT konverzi do topojsonu
    
    if(this.loadTopojsonFormat){
    	this.resObject.features = this.resObject.features.concat(jsonData.features);
    } else {
    	this.resObject[layerName] = jsonData;
    }

    if(this.layersToLoad == 0){
    	if(this.loadTopojsonFormat){
    		this.resObject = convertGeoToTopo(this.resObject);
    	}
        
    	this.res.json({ "xyz" : this.xyz, 'json': this.resObject, 'bound': this.bound});
        //this.done();
    	if(!this.sharedPool){
    		this.done();
    	}
    }

    if(fCount && this.layersToLoad == 0 && this.loadFromCache){
    	var data = { 
    		id: this.id,
    		FeatureCollection: this.resObject
    	};

    	this.test_db.insert(data, this.id, function(err, body){
    		if(err){

    			console.log("errorr: ", err);
    		}
    	});
    }	
};

module.exports = renderTile;
