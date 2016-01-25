#RUIAN TO Postgis importer - use command ogr2ogr and take all xml.gz files from ./data folder
import os
import glob

os.chdir("./data")

i = 0;
for file in glob.glob("*.xml.gz"):
	print(file + "started")
	command = "ogr2ogr -f PostgreSQL PG:\"dbname='vfr' host='localhost' port='5432' user='postgres' password='postgres'\" -append " + str(file)
	os.system(command)
	print(file + "finished")
