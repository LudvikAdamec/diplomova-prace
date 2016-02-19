#!/usr/bin/env python
 
import psycopg2, os, json
from psycopg2.extensions import AsIs
import time
import shutil

conn = psycopg2.connect("dbname=vfr_instalace2 user=postgres password=postgres host=localhost")
start = time.time()

tempFolderName = 'generalize'
filepath = "./" + tempFolderName + "/"
filetype = '.json'

def createTempFolder():
	if not os.path.exists("./" + tempFolderName + "/"):
		os.makedirs("./" + tempFolderName + "/")

def deleteTempFolder():
	print "delete folder: /" + tempFolderName
	shutil.rmtree('./' + tempFolderName)

def createFeatureCollection():
	feature_collection = {}
	feature_collection['type'] = "FeatureCollection"
	feature_collection['features'] = []
	return feature_collection

def createSourceJson(fc, filename):
	#filename = 'obec_kod_' + str(file_name) 
	f = open(filepath + filename + filetype, 'w')
	f.write(json.dumps(fc, indent=2))
	f.close() 

def generalizeFeautureCollection(fc, percentage, filename):
	#MAPSHAPER generalization
	command = "mapshaper " + filepath + filename + filetype + " -simplify visvalingam keep-shapes " + percentage + "% -o " + filepath + filename  + "_" + percentage + filetype
	os.system(command)

	generalizedJson = ''
	with open(filepath + filename  + '_' + percentage + filetype) as data_file:
		generalizedJson = json.load(data_file)
	return generalizedJson

def deleteGeomCollumns(table, level_columns):
	cursor = conn.cursor()
	for col_name, v in level_columns.iteritems():
		cursor.execute("""SELECT column_name 
							FROM information_schema.columns 
							WHERE table_name=%s and column_name=%s;""", (table, col_name, ))			
		desiredCol = cursor.fetchone()
		if desiredCol != None:
			cursor.execute("""ALTER TABLE %s DROP COLUMN %s ;""", (AsIs(table), AsIs(col_name),));
			conn.commit()

def addGeomCollumn(table, col_name):
	cursor = conn.cursor()
	cursor.execute("""SELECT column_name 
							FROM information_schema.columns 
							WHERE table_name=%s and column_name=%s;""", (table, col_name, ))			
	desiredCol = cursor.fetchone()
	if desiredCol == None:
		#cursor.execute("""ALTER TABLE %s DROP COLUMN %s ;""", (AsIs(table), AsIs(col_name),));
		cursor.execute("""SELECT AddGeometryColumn('public',%s , %s ,4326,'geometry',2);""", (table, col_name,));
		conn.commit()

def generalizationWholePostgisTable(table, level_properties):
	cur = conn.cursor()
	feature_collection = createFeatureCollection()

	query = """SELECT ogc_fid,  ST_AsGeoJSON(ST_Transform(originalnihranice, 4326)) AS geom 
		FROM %s 
		WHERE originalnihranice IS NOT NULL"""

	cur.execute(query, (AsIs(table), ))


	for innerRow in cur:
		jsonFeature = {}
		jsonFeature['type'] = 'Feature'
		jsonFeature['properties'] = {}
		jsonFeature['properties']['ogc_fid'] = innerRow[0]
		jsonFeature['geometry'] = json.loads(innerRow[1])
		if jsonFeature['geometry'] != 'null':
			feature_collection['features'].append(jsonFeature)
	
	print len(feature_collection['features'])
	if len(feature_collection['features']) > 0:
		print "features: " + str(len(feature_collection['features']))
		generalizeLayer(table, feature_collection, level_properties, str(innerRow[0]))
	cur.close()

def generalizationMultipleTable(tables, level_properties):
	feature_collection = createFeatureCollection()
	
	for table in tables:
		cur = conn.cursor()

		query = """SELECT ogc_fid,  ST_AsGeoJSON(ST_Transform(originalnihranice, 4326)) AS geom 
			FROM %s 
			WHERE originalnihranice IS NOT NULL"""

		cur.execute(query, (AsIs(table), ))

		for innerRow in cur:
			jsonFeature = {}
			jsonFeature['type'] = 'Feature'
			jsonFeature['properties'] = {}
			jsonFeature['properties']['layer'] = table
			jsonFeature['properties']['ogc_fid'] = innerRow[0]
			jsonFeature['geometry'] = json.loads(innerRow[1])
			if jsonFeature['geometry'] != 'null':
				feature_collection['features'].append(jsonFeature)
		
		print len(feature_collection['features'])
		if len(feature_collection['features']) > 0:
			print "features: " + str(len(feature_collection['features']))
		cur.close()
	
	print len(feature_collection['features'])
	if len(feature_collection['features']) > 0:
		print "features: " + str(len(feature_collection['features']))
		generalizeMultipleLayers(tables, feature_collection, level_properties, str(innerRow[0]))
		
def generalizeMultipleLayers(tables, feature_collection, level_columns, fileName):
	createTempFolder()
	fileName = ''
	for table in tables:
		fileName = fileName + '_' + table

	fileName = fileName + "_" + fileName

	createSourceJson(feature_collection, fileName)
	for k, v in level_columns.iteritems():
		if len(feature_collection['features']) > 0:
			generalizedJson = generalizeFeautureCollection(feature_collection, v, fileName)
			if type(generalizedJson['features']) is list:
				cursorGeom = conn.cursor()
				geom_column = k

				for table in tables:
					addGeomCollumn(table, geom_column)
				
				for feature in generalizedJson['features']:
					print feature['properties']
					layerName = str(feature['properties']['layer'])
					jsonGeom = str(json.dumps(feature['geometry']))

					ogc_fidentificator = str(feature['properties']['ogc_fid'])
					feature['geometry']['crs'] = json.loads('{"type":"name","properties":{"name":"EPSG:4326"}}')
					geom = json.dumps(feature['geometry'])

					cursorGeom.execute(""" UPDATE %s
						SET %s = (SELECT ST_GeomFromGeoJSON(%s))
						WHERE ogc_fid = %s;""", (AsIs(layerName), AsIs(geom_column), geom, ogc_fidentificator))
					conn.commit()
					################################
					# BREAK for real test need to be deleted
					#break
	#deleteTempFolder()

def generalizePostgisTableByTable(table, byTable, level_properties):
	cur = conn.cursor()
	cur.execute("SELECT ogc_fid FROM %s;", (AsIs(byTable), ))
	print "pocet radku: " + str(cur.rowcount)
	for row in cur:
		feature_collection = createFeatureCollection()

		curInner= conn.cursor()
		ogc_fid = row[0]

		query1 = """SELECT ogc_fid,  ST_AsGeoJSON(ST_Transform(originalnihranice, 4326)) AS geom 
			FROM %s 
			WHERE originalnihranice IS NOT NULL AND
			ST_WITHIN(definicnibod, (SELECT originalnihranice FROM %s WHERE ogc_fid = %s))"""

		curInner.execute(query1, (AsIs(table), AsIs(byTable) ,ogc_fid,))

		for innerRow in curInner:
			jsonFeature = {}
			jsonFeature['type'] = 'Feature'
			jsonFeature['properties'] = {}
			jsonFeature['properties']['ogc_fid'] = innerRow[0]
			jsonFeature['geometry'] = json.loads(innerRow[1])
			if jsonFeature['geometry'] != 'null':
				feature_collection['features'].append(jsonFeature)
		
		print len(feature_collection['features'])
		if len(feature_collection['features']) > 0:
			generalizeLayer(table, feature_collection, level_properties, str(ogc_fid))
	cur.close()

def generalizePostgisTableByBBOX(table, level_properties, bbox):
	print "POZOR JE NASTAVEN LIMIT NA 10 000 PRVKU!!!!!!!!!!!!!!!!!!!!!!"

	#cur.execute("SELECT ogc_fid FROM %s WHERE obce.geometry_12&&ST_MakeEnvelope(bbox[0], bbox[1], bbox[2], bbox[3], 4326);", (AsIs(byTable), ))
	cur = conn.cursor()
	
	query = """SELECT ogc_fid, ST_AsGeoJSON(ST_Transform(originalnihranice, 4326)) AS geom  
		FROM %s 
		WHERE originalnihranice IS NOT NULL AND %s.originalnihranice&&ST_MakeEnvelope(%s, %s, %s, %s, 5514) LIMIT 10000;"""

	cur.execute(query, (AsIs(table), AsIs(table), AsIs(bbox[0]), AsIs(bbox[1]), AsIs(bbox[2]), AsIs(bbox[3]), ))
	feature_collection = createFeatureCollection()

	for innerRow in cur:
		jsonFeature = {}
		jsonFeature['type'] = 'Feature'
		jsonFeature['properties'] = {}
		jsonFeature['properties']['ogc_fid'] = innerRow[0]
		jsonFeature['geometry'] = json.loads(innerRow[1])
		if jsonFeature['geometry'] != 'null':
			feature_collection['features'].append(jsonFeature)
	
	print len(feature_collection['features'])
	if len(feature_collection['features']) > 0:
		print "features: " + str(len(feature_collection['features']))
		generalizeLayer(table, feature_collection, level_properties, str(innerRow[0]))
	cur.close()



def generalizeLayer(layerName, feature_collection, level_columns, fileName):
	createTempFolder()
	fileName = layerName + "_" + fileName
	createSourceJson(feature_collection, fileName)
	for k, v in level_columns.iteritems():
		if len(feature_collection['features']) > 0:
			generalizedJson = generalizeFeautureCollection(feature_collection, v, fileName)
			if type(generalizedJson['features']) is list:
				cursorGeom = conn.cursor()
				geom_column = k
				addGeomCollumn(layerName, geom_column)
				
				for feature in generalizedJson['features']:
					jsonGeom = str(json.dumps(feature['geometry']))

					ogc_fidentificator = str(feature['properties']['ogc_fid'])
					feature['geometry']['crs'] = json.loads('{"type":"name","properties":{"name":"EPSG:4326"}}')
					geom = json.dumps(feature['geometry'])

					cursorGeom.execute(""" UPDATE %s
						SET %s = (SELECT ST_GeomFromGeoJSON(%s))
						WHERE ogc_fid = %s;""", (AsIs(layerName), AsIs(geom_column), geom, ogc_fidentificator))
					conn.commit()
					################################
					# BREAK for real test need to be deleted
					#break
	deleteTempFolder()

def generalizeLayer_parcely():
	print "need to be implemented - brutal force is not solution :D"
	#NEVER EVER RUN THIS COMMANDS -> pouze pro jihomoravsky kraj to bude hledat pro kazdou obec prunik s kazdou parcelou (682 x 2 710 230 = 1 842 956 400)
	level_properties = {'geometry_1': '10'}
	generalizePostgisTableByBBOX('parcely', level_properties, [16.43, 49.15, 16.73, 49.25]);
	#deleteGeomCollumns('obce', level_properties)
	#generalizePostgisTableByTable('parcely', 'obce', level_properties)

def generalizeLayer_katastralni_uzemi():
	print "need to be implemented - brutal force is not solution :D"
	#NEVER EVER RUN THIS COMMANDS -> pouze pro jihomoravsky kraj to bude hledat pro kazdou obec prunik s kazdou parcelou (682 x 2 710 230 = 1 842 956 400)
	level_properties = {'geometry_1': '10'}
	generalizePostgisTableByBBOX('katastralniuzemi', level_properties, [-609248.656, -1164916.752, -592043.962, -1152356.271]);
	#deleteGeomCollumns('obce', level_properties)
	#generalizePostgisTableByTable('parcely', 'obce', level_properties)

def generalizeLayer_obce():
	level_properties = {'geometry_8': '1', 'geometry_9': '1.5', 'geometry_10': '2.7', 'geometry_11': '4', 'geometry_12': '5', 'geometry_13': '7', 'geometry_14': '10', 'geometry_15': '20', 'geometry_16': '25', 'geometry_17': '30', 'geometry_18': '40', 'geometry_19': '50', 'geometry_20': '60'}
	deleteGeomCollumns('obce', level_properties)
	generalizationWholePostgisTable('obce', level_properties)
	#generalizePostgisTableByTable('obce', 'kraje', level_properties)

def generalizeLayer_okresy():
	level_properties = {'geometry_6': '0.06', 'geometry_7': '0.15', 'geometry_8': '0.5', 'geometry_9': '1', 'geometry_10': '1.5', 'geometry_11': '2', 'geometry_12': '5', 'geometry_13': '15', 'geometry_14': '25', 'geometry_15': '35', 'geometry_16': '40', 'geometry_17': '50', 'geometry_18': '75'}
	deleteGeomCollumns('okresy', level_properties)
	generalizationWholePostgisTable('okresy', level_properties)
	#generalizePostgisTableByTable('okresy', 'kraje', level_properties)

def generalizeLayer_obce_okresy():
	level_properties = {'geometry_8': '1', 'geometry_9': '1.5', 'geometry_10': '2.7', 'geometry_11': '4', 'geometry_12': '5', 'geometry_13': '7', 'geometry_14': '10', 'geometry_15': '20', 'geometry_16': '25', 'geometry_17': '30', 'geometry_18': '40', 'geometry_19': '50', 'geometry_20': '60'}
	deleteGeomCollumns('obce', level_properties)
	deleteGeomCollumns('okresy', level_properties)
	generalizationMultipleTable(['obce','okresy', 'kraje', 'katastralniuzemi'], level_properties)

#generalize layers
print "generalizeLayer_parcely"
#generalizeLayer_parcely()

print "----------------------------------------------------"

print "generalizeLayer_obce"
#generalizeLayer_obce()

print "generalizeLayer_okresy"
#generalizeLayer_okresy()

print "generalizeLayer_katastralni_uzemi"
#generalizeLayer_katastralni_uzemi()

print "generalizeLayer_obce_okresy"
print generalizeLayer_obce_okresy()



#TODO
#ALTER TABLE my_table ALTER COLUMN geom SET DATA TYPE geometry(MultiPolygon) USING ST_Multi(geom);

conn.close()
end = time.time()
print "generalization finished in: " + str(end - start) + " ms"