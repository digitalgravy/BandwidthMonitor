var http = require('http')
  , url = require('url')
  , Db = require('mongodb').Db
  , Connection = require('mongodb').Connection
  , Server = require('mongodb').Server
  , BSON = require('mongodb').BSON
  , ObjectID = require('mongodb').ObjectID
;

var testURL = 'http://download.thinkbroadband.com/5MB.zip?rand='+parseInt(Math.random()*1000, 10);

var options = {
    host: url.parse(testURL).host,
    port: 80,
    path: url.parse(testURL).pathname
};

var getAverage = function(arr){
	var total = 0;
	for(var i=0, l=arr.length; i<l; i++){
		total += arr[i];
	}
	return total / arr.length;
}

Downloader = function(host, port, callback){
	this.db = new Db('ping-history', new Server(host, port, {auto_reconnect: true}, {}));
	this.db.open(function(){callback();});
};

Downloader.prototype.getCollection = function(callback) {
	this.db.collection('download', function(error, download_collection) {
		if( error ) callback(error);
		else callback(null, download_collection);
	});
};

Downloader.prototype.saveBytesPerSecond = function(bps, callback){
	this.getCollection(function(error, download_collection){
		if(error) callback(error)
		else{
			if(!bps.length) bps = [bps];
			download_collection.insert(bps, function(){
				callback(null, bps);
			});
		}
	});
};

Downloader.prototype.getHistory = function(from, to, callback){
	from = from || new Date(new Date().getTime() - (1000 * 60 * 60 * 24));
	to = to || new Date();
	this.getCollection(function(error, download_collection) {
      if( error ) callback(error)
      else {
        download_collection.find({ created_at: {$gte: from, $lte:to} }).toArray(function(error, results) {
          if( error ) callback(error)
          else callback(null, results)
        });
      }
    });	
};

Downloader.prototype.getDownloadSpeed = function(callback){	
	var Downloader = this;
	var now = new Date().getTime();
	console.log('Download initialising');
	http.get(options, function(res){
		var len = 0;
		var size = res.headers['content-length'];
		var complete = {};
		var timer = [];
		var timer_new = new Date().getTime();
		res
			.on('data', function(data){
				var temp_timer_new = new Date().getTime();
				timer.push(temp_timer_new - timer_new);
				timer_new = temp_timer_new;
				len += data.length;
				var percent = parseInt((100 / size) * len, 10);
				if(percent%5 === 0 && !complete[percent]){
					complete[percent] = true;
					//console.log('Downloaded: ', percent+'%');
				}
			})
			.on('end', function(){
				var timeComplete = new Date().getTime() - now;
				var avg_time = getAverage(timer);
				var avg_size = Math.round(size / timer.length);
				var secondMult = 1000 / avg_time;
				var bytesPerSecond = parseFloat((avg_size * secondMult).toFixed(3));
				var kbPerSec = parseFloat((bytesPerSecond / 1024).toFixed(3));
				var mbPerSec = parseFloat((kbPerSec / 1024).toFixed(3));
				console.log('Download complete in '+timeComplete+'ms, with an average of '+bytesPerSecond+' bytes/s ('+kbPerSec+' Kb/s) ('+mbPerSec+' Mb/s)');
				// download speed = size / timeComplete
				Downloader.saveBytesPerSecond([{bps: bytesPerSecond, created_at: new Date()}], function(){});
				callback({bps: bytesPerSecond});
			});
	});	
}


exports.Downloader = Downloader;

