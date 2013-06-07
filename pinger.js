var exec = require('child_process').exec
  , Db = require('mongodb').Db
  , Connection = require('mongodb').Connection
  , Server = require('mongodb').Server
  , BSON = require('mongodb').BSON
  , ObjectID = require('mongodb').ObjectID;


Pinger = function(host, port, callback){
	this.db = new Db('ping-history', new Server(host, port, {auto_reconnect: true}, {}));
	this.db.open(function(){callback();});
};

Pinger.prototype.localData = {};

Pinger.prototype.getCollection = function(callback) {
	this.db.collection('pings', function(error, pings_collection) {
		if( error ) callback(error);
		else callback(null, pings_collection);
	});
};

Pinger.prototype.savePing = function(pings, callback){
	this.getCollection(function(error, ping_collection){
		if(error) callback(error)
		else{
			if(!pings.length) pings = [pings];
			ping_collection.insert(pings, function(){
				callback(null, pings);
			});
		}
	});
};

Pinger.prototype.ping = function(save, callback){
	var Pinger = this;
	save = save || false;
	exec('ping -c 1 google.com', function(err, stdout, stderr){
		try{
			var out = parseFloat(stdout.split('\n')[1].split('time=')[1].split(' '));
		}catch(e){
			var out = 20000;
		}
		if(save){
			Pinger.savePing([{ping: out, created_at: new Date()}], function(err, pings){
				if(err){
					console.log(err);
				}
			});
		}
		callback(null, out);
	});
};

Pinger.prototype.getHistory = function(from, to, callback){
	from = from || new Date(new Date().getTime() - (1000 * 60 * 60 * 24));
	to = to || new Date();
	this.getCollection(function(error, ping_collection) {
      if( error ) callback(error)
      else {
        ping_collection.find({ created_at: {$gte: from, $lte:to} }).toArray(function(error, results) {
          if( error ) callback(error)
          else callback(null, results)
        });
      }
    });	
};

Pinger.prototype.cullOldPings = function(from, callback){
	from = from || new Date(new Date().getTime() - (1000 * 60 * 60 * 24 * 7));
	this.getCollection(function(error, ping_collection) {
      if( error ) callback(error)
      else {
		ping_collection.find({ created_at: {$lte:from} }).toArray(function(err,res){
			var count = res.length;	
	        ping_collection.remove({ created_at: {$lte:from} });
			ping_collection.find({ created_at: {$lte:from} }).toArray(function(err,res){
				var removed = count - res.length;
				callback(null, removed);
			});
		});
      }
    });
};

Pinger.prototype.thinOldPings = function(toTime, callback){
	toTime = toTime || new Date(new Date().getTime() - (1000 * 60 * 60 * 24));
	this.getCollection(function(error, ping_collection) {
      if( error ) callback(error)
      else {
      	ping_collection.find({created_at: {$gte: new Date(0), $lte: toTime}}).toArray(function(error, results){
	      	if(error) callback(error)
	      	else{
	      		var count = 0;
		      	for(var i=0, item=null, rL = results.length, seconds=null; i<rL; i++){
			      	item = results[i];
			      	seconds = new Date(item.created_at).getSeconds();
			      	if(seconds>30){
				      	ping_collection.remove({_id:item._id}, true);
				      	count++;
			      	}
		      	}
		      	callback(null, count);
	      	}
      	});
      }
	});
};

exports.Pinger = Pinger;
