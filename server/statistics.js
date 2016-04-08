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

    sortable.sort(function(a, b) {return a[1] - b[1]});

    var clean_results = this.deleteExtremes(sortable);

    var finalResults = {};
    for (var i = 0; i < clean_results.length; i++) {
        finalResults[clean_results[i][0]] = results[clean_results[i][0]];
    }

    return finalResults;
};


Statistics.deleteExtremes = function(sorted, results){
    var toDeleteCount = sorted.length - 50;
    if(toDeleteCount > 0){
        var deletedCount = toDeleteCount / 2;
        sorted.splice(0, deletedCount);
        sorted.splice(49, toDeleteCount - deletedCount);
        return sorted;
    } else {
        return null;
    }

};

Statistics.calculateAverages = function(results, key1, key2){
    var sum = 0;
    var keys = Object.keys(results);
    for (var i = 0; i < keys.length; i++) {
        sum += results[keys[i]][key1][key2];
    }

    var average = sum / keys.length;
    return average;
};

Statistics.saveCalculatedResults = function (result, dbName) {
    var results_db = nano.db.use('calculated_results');

    results_db.insert(result, dbName, function(err, body){
      if(!err){
        //awesome
      }
    });
};

Statistics.loadDatabaseDocs = function(dbName) {
    var db = nano.db.use(dbName),
        results = {},
        this_ = this;
    
    this.downloadStatistics(db, function(statistics){
        results = this_.calculateCompleteLoadingTimes(statistics);
        
        var results_cleaned = this_.sortIds(results);

        var calculation_results = {
            "average_init_loading": this_.calculateAverages(results_cleaned, 'init', 'loading'),
            "average_init_merging": this_.calculateAverages(results_cleaned, 'init', 'merging'),
            "average_panLeft_loading": this_.calculateAverages(results_cleaned, 'panLeft', 'loading'),
            "average_panLeft_merging": this_.calculateAverages(results_cleaned, 'panLeft', 'merging'),
            "average_zoomin_loading": this_.calculateAverages(results_cleaned, 'zoomin', 'loading'),
            "average_zoomin_merging": this_.calculateAverages(results_cleaned, 'zoomin', 'merging'),
            "average_zoomout3x_loading": this_.calculateAverages(results_cleaned, 'zoomout3x', 'loading'),
            "average_zoomout3x_merging": this_.calculateAverages(results_cleaned, 'zoomout3x', 'merging')
        };

        calculation_results["average_sum_loading"] = (
            calculation_results.average_init_loading + 
            calculation_results.average_panLeft_loading + 
            calculation_results.average_zoomin_loading +
            calculation_results.average_zoomout3x_loading
        );

        calculation_results["average_sum_merging"] = (
            calculation_results.average_init_merging + 
            calculation_results.average_panLeft_merging + 
            calculation_results.average_zoomin_merging +
            calculation_results.average_zoomout3x_merging
        );

        this_.saveCalculatedResults(calculation_results, dbName);

    });
    
    return "NANO HoHooooHo HoHooooHo";
};