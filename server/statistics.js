// Located in: ./statistics.js

var Statistics = module.exports;

var nano = require('nano')('http://localhost:5984');


Statistics.sendMessage = function(param1, param2) {

}

Statistics.sendImage = function(param1, param2) {

}

Statistics.getDocument = function(db, documentID) {

}

Statistics.downloadStatistics = function(db, callback) {
    var docList = {};
    db.list(function(err, body) {
        var remain = 0;
        for (var i = 0; i < body.rows.length; i++) {
            remain++;
            var row = body.rows[i];
            db.get(row.id, function(err, body) {
                remain--;
                if (err) {
                    console.log(err);
                } else {
                    docList[body._id] = body.results;
                }

                if (remain == 0) {
                    callback(docList);
                }
            });
        }
    });
};

Statistics.calculateCompleteLoadingTimes = function(results){
    var ids = Object.keys(results);
    console.log(ids.length);
    for (var i = 0; i < ids.length; i++){
        var result = results[ids[i]];
        //console.log(result);
        var sumLoad = result.init.loading + 
            result.panLeft.loading + 
            result.zoomin.loading + 
            result.zoomout3x.loading;
        
        var sumMerge = result.init.merging + 
            result.panLeft.merging + 
            result.zoomin.merging + 
            result.zoomout3x.merging;
        
        result.sum = {
            "loading": sumLoad,
            "merging": sumMerge
        };
    }
    return results;
};

Statistics.sortIds = function(results){
  var sortable = [];
  for(var result in results){
      sortable.push([result, results[result].sum.loading]);
  }  
  
  sortable.sort(function(a, b) {return a[1] - b[1]})
  console.log(sortable);
};

Statistics.loadDatabaseDocs = function(dbName) {
    var db = nano.db.use(dbName),
        results = {},
        this_ = this;
    
    this.downloadStatistics(db, function(statistics){
        //console.log("statistics: ", Object.keys(statistics));
        results = this_.calculateCompleteLoadingTimes(statistics);
        //console.log(results);
        this_.sortIds(results);        
    });
    
    return "NANO HoHooooHo HoHooooHo";
}