if (http && http.Server) {
	var server = new http.Server();
	var socketId;
	var key;

	server.listen(1227);
	server.addEventListener('request', function(req) {
		// stage 1 grep and write back to client.
		socketId = req.socketId_;

		var vid = /v=([^ &#]+)/.exec(req.headers.Referer)[1];
		var itag = /itag=([^&]+)&/.exec(req.url)[1];
		var range = /range=([^&]+)&/.exec(req.url)[1];
		key = vid + ' ' + itag + ' ' + range;

		cacheMiss(req);
/*
		window.webkitRequestFileSystem(window.PERSISTENT, 2*1024*1024*1024, function(fs) {
			fs.root.getFile(key, {}, function(fileEntry) {
				fileEntry.file(function(file) {
					var reader = new FileReader();
					reader.onloadend = function() {
						cacheHit(req, this.result);
					}
					reader.readAsArrayBuffer(file);
				});
			}, function(e) {
				switch (e.name) {
				case 'NotFoundError':
					cacheMiss(req);
					break;
				default:
					console.log(e);
					break;
				}
			});
		}, console.log);
*/
	});

	var cacheHit = function(req, result) {
		var headerMap = {};
		headerMap['Access-Control-Allow-Origin'] = 'http://www.youtube.com';
		headerMap['Access-Control-Allow-Credentials'] = 'true';
		headerMap['Timing-Allow-Origin'] = 'http://www.youtube.com';
		headerMap['Men-In-The-Middle'] = 'hit';
		headerMap['Content-Length'] = result.byteLength;

		req.socketId_ = socketId;
		req.writeHead(200, headerMap);
		req.end(result);
		console.log(socketId);
	};

	var cacheMiss = function(req) {
		var xhr = new XMLHttpRequest();
		xhr.onloadend = function() {

			var headerMap = {};

			headerMap['Access-Control-Allow-Origin'] = 'http://www.youtube.com';
			headerMap['Access-Control-Allow-Credentials'] = 'true';
			headerMap['Timing-Allow-Origin'] = 'http://www.youtube.com';
			headerMap['Men-In-The-Middle'] = 'miss';
			headerMap['Content-Length'] = this.response.byteLength;

			req.socketId_ = socketId;
			req.writeHead(this.status, headerMap);
			req.end(this.response);
/*
			var t = this;

			if (this.status == 200 && headerMap['Content-Length'] > 0) {
				window.webkitRequestFileSystem(window.PERSISTENT, 2*1024*1024*1024, function(fs) {
					fs.root.getFile(key, {}, function(fileEntry) {
						fileEntry.file(function(file) {
							var reader = new FileReader();
							reader.onloadend = function() {
								console.log('ok');
							}
						});
					}, function(e) {
						switch (e.name) {
						case 'NotFoundError':
							fs.root.getFile(key, {create: true}, function(fileEntry) {
								fileEntry.createWriter(function(fileWriter) {
									fileWriter.onwriteend = function(e) {
										console.log(key + ' write done.');
									};
									fileWriter.onerror = function(e) {
										console.log(key + ' write failed: ' + e);
									};

									var dataView = new DataView(t.response);
									if (itag = '140')
										var blob = new Blob([dataView], { type: 'audio/mp4' });
									else
										var blob = new Blob([dataView], { type: 'video/webm' });
									fileWriter.write(blob);
								});
							});
							break;
						default:
							console.log(e);
							break;
						};
					}, console.log);
				});
			}
*/
		};
		// bypass=true to prevent proxy intercept loop
		xhr.open('GET', req.url + 'bypass=true');
		xhr.responseType = 'arraybuffer';
		xhr.send();
	};
}


