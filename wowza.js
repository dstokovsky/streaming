var config = require('./lib/config'),
    StreamModel = require('./lib/mongoose').StreamModel,
    path = require('path'),
    express = require('express'),
    log = require('./lib/log')(module),
    app = express(),
    http = require('http'),
    auth = require("http-auth"),
    xmlParser = require('xml2js'),
    urlParser = require('url'),
    fs = require('fs'),
    path = require('path'),
    async = require('async');
    
var wowzaStreamingServer = config.get('wowza'),
    protocol = wowzaStreamingServer['protocol'],
    streamingProtocol = wowzaStreamingServer['streamingProtocol'],
    streamingPort = wowzaStreamingServer['streamingPort'],
    serverHost = wowzaStreamingServer['server'],
    serverPort = wowzaStreamingServer['streamsPort'],
    serverPath = [ wowzaStreamingServer['streamsUrlPath'], wowzaStreamingServer['streamsUrlParams'] ].join( '' ),
    serverSettings = {
        host: serverHost,
        port: serverPort,
        path: serverPath,
        auth: [wowzaStreamingServer["streamsUser"], wowzaStreamingServer["streamsPassword"]].join(":")
    },
    storage = wowzaStreamingServer["streamsStoragePath"];

var basic = auth.basic({
    realm: "Private Area",
    file: __dirname + "/.htpasswd",
    contentType: "json"
});

function _collectActiveStreams( streamsXml ){
    var activeStreams = [];
    xmlParser.parseString( streamsXml, function(err, result){
        if( result["WowzaStreamingEngine"].hasOwnProperty( "Stream" ) && result["WowzaStreamingEngine"]["Stream"].length > 0 ){
            result["WowzaStreamingEngine"]["Stream"].forEach(function(item){
                activeStreams.push( { "url": [ streamingProtocol, [ [ serverHost, streamingPort ].join(":"), item["$"]["applicationName"] ].join("/") ].join(""), "stream": item["$"]["streamName"] } );
            });
        }
    });

    return activeStreams;
}

function _collectInactiveStreams(){
    var inactiveStreams = [];
    fs.readdirSync(storage).forEach(function(file){
        inactiveStreams.push( { "url": [ protocol, serverHost, "/", path.basename( [storage, file].join("/") ) ].join("") } );
    });

    return inactiveStreams;
}

function _updateStreams( streams ){
    async.parallel([
        function(){
            streams["active"].forEach(function(strm){
		var existedStream = StreamModel.findOne({ name: strm["stream"] }, function(err, stream){
                    if( err ){
                        log.error('Internal error: %s', err.message);
                        return;
		    }
                    if( !stream ){
                        stream = new StreamModel({
                            name: strm["stream"],
                            url: strm["url"],
                            status: true
                        });
                    }
                    stream.status = true;
                    stream.save(function( err ){
			if( err ){
			    log.error('Internal error: %s', err.message);
			}
		    });
		});
            });
	},
	function(){
            streams["inactive"].forEach(function(strm){
                var url = urlParser.parse( strm["url"] );
                var streamName = url["path"].replace(".mp4", "").replace("/", "");
	        StreamModel.findOne({ name: streamName }, function(err, stream){
		    if( err ){
                        log.error('Internal error: %s', err.message);
                        return;
                    }
		    if( !stream ){
                        stream = new StreamModel({
                            name: streamName,
                            url: strm["url"]
                        });
                    }
		    stream.status = false;
		    stream.save(function(err){
			if( err ){
  		            log.error('Internal error: %s', err.message);
			}
		    });
       	        });
	    });
	}
    ], function(err, results){
        if( err ){
            log.error('Internal error: %s', err.message);
        }
    });
}

function collectStreams(){
    var streams = { "active": [], "inactive": [] };
    http.get(serverSettings, function(resp){
        resp.on('data', function (chunk) {
            streams["active"] = _collectActiveStreams( chunk.toString() );
            _updateStreams(streams);
        });
        streams["inactive"] = _collectInactiveStreams();

        resp.on('error', function (e) {
            console.log( e );
        });
    });
}

app.use(auth.connect(basic));

app.listen(config.get('port'), function(){
    console.log('Express server listening on port ' + config.get('port'));
    setInterval(collectStreams, 5000);
});

app.get('/api/streams', function (req, res) {
    return StreamModel.find({}, "url name", function (err, streams) {
        if ( err ) {
            res.statusCode = 500;
            log.error('Internal error(%d): %s',res.statusCode,err.message);
            return res.send({ error: 'Server error' });
        }

        return res.send( streams );
    });
});

