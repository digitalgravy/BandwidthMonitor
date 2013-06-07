window.onload = function(){

	var ping_data = {
		last7days: [],
		last24hours: [],
		lastHour: [],
		last5mins: []
	}
	
	var parseData = function(data){
		var retData = [];
		for(var i=0; i<data.length; i++){
			retData.push({
				x: new Date(data[i].created_at),
				y: data[i].ping ? data[i].ping : data[i].bps / 1024
			});
		}
		return retData;
	}
	
	var generateChart = function(locationID, data){
		try{
			var graph = document.querySelector('#'+locationID+' div');
			graph.parentNode.removeChild(graph);
		}catch(e){}
		var chart = new CanvasJS.Chart(locationID, {
			data:[
				{
					type: 'line',
					dataPoints: parseData(data)
				}
			]
		});
		chart.render();
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
	
	var socket = io.connect('http://localhost');

    socket.on('ping', function(data){
      //console.log(data);
      if(data.average_10sec){
        ping_data.last24hours.push({created_at: new Date().toISOString(), ping: data.average_10sec});
        generateChart('graph24hours', ping_data.last24hours);
        ping_data.lastHour = cullOldPings(ping_data.lastHour, new Date(new Date().getTime() - 1000*60*60));
        generateChart('graph1hour', ping_data.lastHour);
      }else if(data.average_5mins){
        ping_data.last7days.push({created_at: new Date().toISOString(), ping: data.average_5mins});
        generateChart('graph7days', ping_data.last7days);
      }else if(data.ping){
        document.querySelector('#todaysresults p.current').innerText = (data.ping).toFixed(2) + 'ms';
        ping_data.last5mins.push({created_at: new Date().toISOString(), ping: data.ping});
        ping_data.last5mins = cullOldPings(ping_data.last5mins, new Date(new Date().getTime() - 1000*60*5));
        generateChart('currentLatency', ping_data.last5mins);
      }
    });
    socket.on('history', function(data){
        console.log(data);
        ping_data.last24hours = data.oneDay;
        ping_data.last5mins = data.fiveMins;
        ping_data.last7days = data.oneWeek;
        ping_data.lastHour = cullOldPings(ping_data.last24hours, new Date(new Date().getTime() - 1000*60*60));
        generateChart('graph24hours', ping_data.last24hours);
        generateChart('currentLatency', ping_data.last5mins);
        generateChart('graph7days', ping_data.last7days);
        generateChart('graph1hour', ping_data.lastHour);
    });
    
	
	var latestDownload = new Date();
	var startedLoop = false;
	var calcNext = function(){
		setInterval(function(){
			var now = new Date().getTime();
			var lastD = latestDownload.getTime();
			var diff = (1000 * 60 * 10) - (now - lastD);
			// parse into mins
			var ret = '';
			if(diff > 1000 * 60){
				ret = ' in: ' + Math.floor(diff / (1000 * 60)) + ' mins, ' + Math.floor((diff - 1000 * 60 * Math.floor(diff / (1000 * 60))) /1000) + ' sec';
			}else{
				var secs = Math.floor(diff / 1000) || 0;
				if(secs <= 1){
					ret = ' now...';
				}else{
					ret = ' in: ' + secs + ' sec';
				}
			}
			document.querySelector('.download .nextime').innerText = 'Retesting '+ret;
		}, 1000);
	}
    var parseDownload = function(data){
	    latestDownload = new Date(data.created_at);
	    var bps = data.bps;
	    var kbps = bps / 1024;
	    var mbps = kbps / 1024;
	    var res = '';
	    if(mbps>1){
		    res = (mbps).toFixed(2)+' MB/s';
	    }else if(kbps > 1){
		    res = (kbps).toFixed(2)+' KB/s';
	    }else{
		    res = (bps).toFixed(2)+' B/s';
	    }
	    document.querySelector('.download .res').innerText = res;
		if(startedLoop === false){
			startedLoop = true;
			calcNext();
		}

    }
    var downloadHistory = {
	    day: [],
	    week: []
    };
    socket.on('download-history', function(data){
	    downloadHistory.week = data.oneWeek;
    	downloadHistory.day = cullOldPings(downloadHistory.week, new Date(new Date().getTime() - 1000*60*60*24));
	    parseDownload(downloadHistory.day[downloadHistory.day.length - 1]);
	   	generateChart('downloadOneDay', downloadHistory.day); 
	   	generateChart('downloadOneWeek', downloadHistory.week); 
    });
    socket.on('download-speed', function(data){
	    parseDownload({created_at: new Date().toISOString(), bps: data.bps});
	    downloadHistory.day.push({created_at: new Date().toISOString(), bps: data.bps});
	    downloadHistory.week.push({created_at: new Date().toISOString(), bps: data.bps});
	   	generateChart('downloadOneDay', downloadHistory); 
    });
	
};








