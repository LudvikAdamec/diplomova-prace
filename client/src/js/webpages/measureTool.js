'use strict';
goog.provide('measureTool');

goog.require('ol.source.MultiLevelVector');
goog.require('ol.proj');
goog.require('goog.asserts');
goog.require('goog.array');



/**
 * tool for automatic measuring
 * @param  {[type]} params - parameters
 * @return {[type]}             [description]
 */
measureTool = function(params) {
    this.measuringResults = [];
    this.measuringProperties = ['init', 'panLeft', 'zoomin', 'zoomin', 'zoomout3x'];
    this.dbName = params.db;
}

measureTool.prototype.addResults = function(loadingTime, mergingTime) {
    this.measuringResults.push({ loading: loadingTime, merging: mergingTime });
};

measureTool.prototype.panMap = function(factor, toSide) {
    var currentExtent = map.getView().calculateExtent(map.getSize());
    var currentCenter = map.getView().getCenter();
    var width = currentExtent[2] - currentExtent[0];

    if (toSide == 'left') {
        var newCenter = [currentCenter[0] - (factor * width), currentCenter[1]];
        map.getView().setCenter(newCenter);
        console.log("moved");
    } else {
        throw "side not implemented";
    }
};

measureTool.prototype.zoomin = function(levels) {
    map.getView().setZoom(map.getView().getZoom() + levels);
};

measureTool.prototype.zoomout = function(levels) {
    map.getView().setZoom(map.getView().getZoom() - levels);
};

measureTool.prototype.saveResultsToDB = function() {
    var results = {};
    for (var i = 0; i < this.measuringProperties.length; i++) {
        results[this.measuringProperties[i]] = this.measuringResults[i];
    }

    $.ajax({
        url: 'http://localhost:9001/saveStatToDB/',
        type: "POST",
        data: JSON.stringify(
            { "results": results,  "dbName": this.dbName}
        ),
        contentType: 'application/json',
        datatype: 'text/plain',
        success: function() {
            location.reload();
        },
        error: function(er) {
            return console.log("chyba: ", er);
        }
    });
};

measureTool.prototype.measureNextProperty = function() {
    console.log(this.measuringResults);

    if (true == true) {
        if (this.measuringResults.length == this.measuringProperties.length) {
            this.saveResultsToDB();
        } else {
            switch (this.measuringResults.length) {
                case 1:
                    this.zoomin(1);
                    break;
                case 2:
                    this.panMap(1, 'left');
                    break;
                case 3:
                    this.zoomin(1);
                    break;
                case 4:
                    this.zoomin(1);
                    break;
                case 5:
                    this.zoomout(3);
                    break;
            }
        }
    }
    // body...
};