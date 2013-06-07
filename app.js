
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , path = require('path')
  , io = require('socket.io')
  , Pinger = require('./pinger').Pinger
  , Downloader = require('./downloader').Downloader;

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

app.locals({
	latency:{
		random: (Math.random() * 1000).toFixed(2),
		ping: 20000
	}
})

setInterval(function(){
	app.locals.latency.random = (Math.random() * 1000).toFixed(2);
}, 10);


// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);

var server = http.createServer(app)
io = io.listen(server); 
io.set('log level', 1); 

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

// pinger
var pinger = new Pinger('localhost', 27017, function(){

	var ping_hist_10_sec = [],
		ping_hist_5_min = [],
		ping_hist_5_min_avg = [],
		ping_hist_hourly = [];
	
	var averagePing = function(ping){
		ping_hist_10_sec.push(ping);
		if(ping_hist_10_sec.length > 6){
			ping_hist_10_sec.splice(0,1);
		}
		var avg = 0;
		for(var p=0;p<ping_hist_10_sec.length;p++){
			avg += ping_hist_10_sec[p];
		}
		avg = parseFloat((avg / ping_hist_10_sec.length).toFixed(2));
		app.locals.latency.averagePing = avg;
		io.sockets.emit('ping', {
			'average_10sec': avg
		});
		ping_hist_5_min_avg.push(avg);
		if(ping_hist_5_min_avg.length >= 30){
			avg = 0;
			for(p=0;p<ping_hist_5_min_avg.length;p++){
				avg += ping_hist_5_min_avg[p];
			}
			avg = parseFloat((avg / ping_hist_5_min_avg.length).toFixed(2));
			io.sockets.emit('ping', {
				'average_5mins': avg
			});
			ping_hist_5_min_avg = [];
		}
	};
	
	var cullOldPings = function(data, time){
		var newData = [];
		for(var i=0, dL=data.length, d=null, t=null; i<dL; i++){
			d=data[i];
			t=new Date(d.created_at).getTime();
			if(t>time.getTime()){
				newData.push(d);
			}
		}
		return newData;
	}
	
	setInterval(function(){
		pinger.ping(false, function(err, ping){
			// update ping
			io.sockets.emit('ping', {
				'ping': ping
			});
			app.locals.latency.ping = ping;
			ping_hist_5_min.push({
				created_at: new Date().toISOString(),
				ping: ping
			});
			ping_hist_5_min = cullOldPings(ping_hist_5_min, new Date(new Date().getTime() - 1000*60*5));			});
	}, 500);	
	
	setInterval(function(){
		pinger.ping(true, function(err, ping){
			averagePing(ping);
		});
	}, 10000);	
	pinger.ping(true, function(err, ping){
		averagePing(ping);
	});
	
	// Remove old pings every hour
	// Thin old pings every hour
	setInterval(function(){
		pinger.cullOldPings(null, function(err, count){
			console.log('cullOldPings:: ', count, ' records removed');
		});
		pinger.thinOldPings(null, function(err, count){
			console.log('thinOldPings:: ', count, ' records removed');
		});
	}, 1000 * 60 * 60)
	pinger.cullOldPings(null, function(err, count){
		console.log('cullOldPings:: ', count, ' records removed');
	});
	pinger.thinOldPings(null, function(err, count){
		console.log('thinOldPings:: ', count, ' records removed');
	});
	
	
	
	io.sockets.on('connection', function(socket){
		pinger.getHistory(null,null,function(err, oneDay){
			pinger.getHistory(new Date( new Date().getTime() - 1000 * 60 * 60 * 24 * 7 ), null, function(err, oneWeek){
				socket.emit('history', {oneDay: oneDay, fiveMins: ping_hist_5_min, oneWeek: oneWeek});
			});
		});
	});
	
});


var downloader = new Downloader('localhost', 27017, function(){ 

	io.sockets.on('connection', function(socket){
		downloader.getHistory(new Date( new Date().getTime() - 1000 * 60 * 60 * 24 * 7 ),null,function(err, oneWeek){
			socket.emit('download-history', {oneWeek:oneWeek});
		});
	});

	// try download every 10 mins
	setInterval(function(){
		downloader.getDownloadSpeed(function(data){
			io.sockets.emit('download-speed', data);
		});
	}, 1000 * 60 * 10);
	downloader.getDownloadSpeed(function(data){
		io.sockets.emit('download-speed', data);
	});
	
});







