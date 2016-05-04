# DIPLOMOVÁ PRÁCE 
Mapová aplikace pro vektorové dlaždice a prostorovou indexovací službu.

#Ukázka aplikace 
http://ruian.ludvikadamec.cz

## Requirements
- couchDB
- Postgis
- nodejs
- npm
- python 2.7
- grunt
- bower
- git
- JAVA 7 and higher

## Installation
1) git clone
2) npm install
3) bower install
4) sudo grunt install

5) Zalozeni DB
```
CREATE DATABASE vfr;
```

Prepnout se do nove db vfr
```
CREATE EXTENSION postgis;
```

PRIDAT KROVAKA - epsg.io
```
INSERT into spatial_ref_sys (srid, auth_name, auth_srid, proj4text, srtext) values ( 5514, 'EPSG', 5514, '+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=589,76,480,0,0,0,0 +units=m +no_defs ', 'PROJCS["S-JTSK / Krovak East North",GEOGCS["S-JTSK",DATUM["System_Jednotne_Trigonometricke_Site_Katastralni",SPHEROID["Bessel 1841",6377397.155,299.1528128,AUTHORITY["EPSG","7004"]],TOWGS84[589,76,480,0,0,0,0],AUTHORITY["EPSG","6156"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4156"]],PROJECTION["Krovak"],PARAMETER["latitude_of_center",49.5],PARAMETER["longitude_of_center",24.83333333333333],PARAMETER["azimuth",30.28813972222222],PARAMETER["pseudo_standard_parallel_1",78.5],PARAMETER["scale_factor",0.9999],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["X",EAST],AXIS["Y",NORTH],AUTHORITY["EPSG","5514"]]');
```

6) DATA z RUIANU

a) Hromadne stazeni dat
```
python public/ruianDownloader.py 
```

b) Import do PG database - v python souboru je mozne na zacatku zmenit parametry pripojeni k DB
```
python public/vfrPgImport.py 
```

c) Predgeneralizovani geometrii ruianu (moznost upravit pripojeni k DB)
```
python public/generalizePostgis.py 
```

7) V index.js upravit parametry pripojeni k DB
```
  var loaderParams = {
      "db": {
        "layerName" : "obce",
        "dbname" : "vfr_instalace",
        "geomColumn" : "geometry_1",
        "idColumn" : "ogc_fid",
        "url" : "http://localhost:9001/se/"
      } 
    };
```

8) Spustit aplikaci
```
grunt
```

## Development
* `grunt` to run dev server and open Hello World in the browser
  * Edit content of `client/src/js/webpages/index.js` and see changes in the browser
* `grunt lint` to run gjslint
* `grunt fix` to run fixjsstyle

## Build
* `grunt build` to compile the code and copy files to `client/public`
* `grunt build --map` to include also [source maps](https://developer.chrome.com/devtools/docs/javascript-debugging#source-maps)



BASED on repository https://github.com/jirik/ol3ds

### HINTS dioplomkaVT - rendering commands....

Transformace EPSG v postgisu
CREATE TABLE new_table AS 
  SELECT ST_Transform(geom,900913) AS geom, ogc_fid 
  FROM newparcel;


CouchDB
- instalace
- zalozeni db
- naimportovani
- npm install
- 