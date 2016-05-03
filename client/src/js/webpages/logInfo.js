goog.provide('logInfo');

goog.require('ol.proj');
goog.require('goog.asserts');
goog.require('goog.array');

/**
 * [logInfo description]
 * @return {[type]} [description]
 */
logInfo = function() {};

logInfo.prototype.loadingStatusChange = function (statusObject){    
	if(statusObject.sizeMessage !== undefined){
	  var sizeDiv = document.getElementById('sizeStatus');
	  sizeDiv.innerHTML = "";
	  sizeDiv.innerHTML = statusObject.sizeMessage;
	}

	if(statusObject.statusMessage){
	  var statusDiv = document.getElementById('loadingStatus');
	  statusDiv.innerHTML = "";
	  statusDiv.innerHTML = statusObject.statusMessage;
	}

	if(statusObject.statusExtents !== undefined){
	  var extentsDiv = document.getElementById('extentsStatus');
	  extentsDiv.innerHTML = "";
	  extentsDiv.innerHTML = statusObject.statusExtents;
	}

	if(statusObject.loadingTime !== undefined){
	  var timeDiv = document.getElementById('loadingTime');
	  timeDiv.innerHTML = "";
	  timeDiv.innerHTML = statusObject.loadingTime;
	}

	if(statusObject.mergingTime !== undefined){
	  var mergingTimeDiv = document.getElementById('mergingTime');
	  mergingTimeDiv.innerHTML = "";
	  mergingTimeDiv.innerHTML = statusObject.mergingTime;
	}
};

