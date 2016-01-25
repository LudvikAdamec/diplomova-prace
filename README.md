# DIPLOMKA 
1] git clone
2] npm install
3] bower install
4] grunt install

5] Zalozeni DB
```
CREATE DATABASE vfr;
```

// Prepnout se do nove db vfr
```
CREATE EXTENSION postgis;
```

//PRIDAT KROVAKA - epsg.io
```
INSERT into spatial_ref_sys (srid, auth_name, auth_srid, proj4text, srtext) values ( 5514, 'EPSG', 5514, '+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=589,76,480,0,0,0,0 +units=m +no_defs ', 'PROJCS["S-JTSK / Krovak East North",GEOGCS["S-JTSK",DATUM["System_Jednotne_Trigonometricke_Site_Katastralni",SPHEROID["Bessel 1841",6377397.155,299.1528128,AUTHORITY["EPSG","7004"]],TOWGS84[589,76,480,0,0,0,0],AUTHORITY["EPSG","6156"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4156"]],PROJECTION["Krovak"],PARAMETER["latitude_of_center",49.5],PARAMETER["longitude_of_center",24.83333333333333],PARAMETER["azimuth",30.28813972222222],PARAMETER["pseudo_standard_parallel_1",78.5],PARAMETER["scale_factor",0.9999],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["X",EAST],AXIS["Y",NORTH],AUTHORITY["EPSG","5514"]]');
```

6] DATA z RUIANU

//Hromadne stazeni dat
```
python ruianDownloader.py 
```

//Import do PG database - v python souboru je mozne na zacatku zmenit parametry pripojeni k DB
```
python vfrPgImport.py 
```

//Predgeneralizovani geometrii ruianu (moznost upravit pripojeni k DB)
```
python generalizePostgis.py 
```

7] V index.js upravit parametry pripojeni k DB
```
  var loaderParams = {
      "db": {
        "layerName" : "obce", //"parcelswgs";
        "dbname" : "vfr_instalace",
        "geomColumn" : "geometry_1",
        "idColumn" : "ogc_fid",
        "url" : "http://localhost:9001/se/"
      } 
    };
```
8] spustit aplikaci
grunt



BASED on repository https://github.com/jirik/ol3ds
# ol3 devstack

* [OpenLayers 3](ol3js.org) & [Google Closure](https://developers.google.com/closure/) devstack ready for [advanced optimizations](https://developers.google.com/closure/compiler/docs/compilation_levels) using [plovr](https://github.com/bolinfest/plovr)
* [fixjsstyle and gjslint](https://developers.google.com/closure/utilities/docs/linter_howto) included
* both Linux and Windows friendly

Current versions:
* [OpenLayers](http://openlayers.org) v3.7.0
* [Closure Library](https://github.com/google/closure-library) [v2015-02-18] (https://github.com/google/closure-library/tree/567c440d2c7f2601c970ce40bc650ad2044a77d2)
* [plovr](https://github.com/bolinfest/plovr) 2.0.0

This repository is not officially supported by Google, ol3, or individual module authors.

## Requirements
* [Java 7 or higher](http://www.java.com/)
  * Windows users: `path/to/directory/with/java.exe` must be in your PATH system variable
* [Python 2.7](https://www.python.org/downloads/) (32bit or 64bit; must correspond with node.js because of node-gyp)
  * Windows users: `path/to/python/directory` and `path/to/python/directory/Scripts` must be in your PATH system variable
* [node.js](http://nodejs.org/download/) (32bit or 64bit; must correspond with Python 2.7 because of node-gyp)
* [grunt](http://gruntjs.com/) `npm install -g grunt-cli`
* [bower](http://bower.io/) `npm install -g bower`
* [git](http://git-scm.com/downloads)
  * Windows users: `path/to/directory/with/git.exe` must be in your PATH system variable

## Installation
```
git clone https://github.com/jirik/ol3ds.git
cd ol3ds
npm install
bower install
sudo grunt install (Linux) / grunt install (Windows)
```
### Problems with installation
Windows users: If you have some errors during `npm install` related to [node-gyp](https://github.com/TooTallNate/node-gyp), you will probably need to install [Microsoft Visual Studio C++ 2012 Express for Windows Desktop](http://www.microsoft.com/en-us/download/details.aspx?id=34673) and run the installation again.

## Development
* `grunt` to run dev server and open Hello World in the browser
  * Edit content of `client/src/js/webpages/index.js` and see changes in the browser
* `grunt lint` to run gjslint
* `grunt fix` to run fixjsstyle

## Build
* `grunt build` to compile the code and copy files to `client/public`
* `grunt build --map` to include also [source maps](https://developer.chrome.com/devtools/docs/javascript-debugging#source-maps)

=======
# HINTS dioplomkaVT - rendering commands....

Tilestache seed

Importing to pgsql:
shp2pgsql -I -s 4326:900913 hexagonalGrid.shp public.hexagonalGrid | psql -d gis -U postgres -h 

shp2pgsql -I -s 5514:900913 delaunyho.shp public.delaunyho | psql -d gis -U postgres -h localhost

Tilestache seed comands:
tilestache-seed.py -b 48.51 11.97 51.19 19.07 -c tilestache.cfg -l delaunyho -e topojson 9 10 11
tilestache-seed.py -b 48.51 11.97 51.19 19.07 -c tilestache.cfg -l hexagon -e topojson 9 10 11 12
tilestache-seed.py -b 49.40 15.1 49.47 15.3 -c tilestache.cfg -l parcels -e topojson 12 13 14 15 16 17 18 19 20 21
//pozor na bbox...ma prehozene souradnice nez vsechny generatory bboxu
tilestache-seed.py -b  48.51 11.97 51.19 19.07 -c tilestache.cfg -l okresy -e topojson 9 10 11 12 13

Transformace EPSG v postgisu
CREATE TABLE new_table AS 
  SELECT ST_Transform(geom,900913) AS geom, ogc_fid 
  FROM newparcel;
