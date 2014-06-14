var VNS = 'http://192.168.0.103:3216';

if (http.server) {
	var prpr = http.server(),
		// $1: host, used to pipe to, prevent to parse header.
		// $2: itag.
		// $3: range begin.
		// $4: range end.
		// $5: video id, but there should exist better id retrival methods. FIXME
		youPattern = /^GET http:\/\/([^\/]+)\/videoplayback?.*itag=([\d]+).*range=([\d]+)-([\d]+)[^]+Referer: .*watch\?v=(\w+)/m;

	prpr.onRequest.addListener(prprOnRequest);
	prpr.onProxyRequest.addListener(prprOnProxyRequest);
	prpr.listen(1227);

	http.server(onServe).listen(1989);
}

function onServe(req, response) {
	var m;

	if (!req.http || !(m = req.uri.match(/^\/([^\/]+)\/(\d+)-(\d+)$/))) {
		req.client.close();
		return;
	}

	video(m[1]).serve(parseInt(m[2]), parseInt(m[3]), function(data) {
		debug(req.client.socketId_, m[1], 'serves %s-%s.', m[2], m[3]);
		response.writeHead(200, { 'Content-Length': data.byteLength });
		response.end(data);
	}, function() {
		debug(req.client.socketId_, 'onServe', 'segment %s-%s not found.', m[2], m[3]);
		response.writeHead(404, { 'Content-Length': 0 });
		response.end();
	});
}

function prprOnRequest(req, response) {
	var m;

	if (!req.http || !(m = req.data.match(youPattern))) {
		req.client.close();
		return;
	}

	video(m[5] + ':' + m[2]).retrieve(parseInt(m[3]), parseInt(m[4]), function(data) {
		debug(req.client.socketId_, m[5] + ':' + m[2], '%s-%s retrieve ok.', m[3], m[4]);
		response.writeHead(200, { 'Content-Length': data.byteLength });
		response.end(data);
	}, function(v) {
		req.client.pipe(m[1], req.buffer, function(data) {
			v.segment(parseInt(m[3]), parseInt(m[4])).store(new Blob(data), function(s) {
				v.index.store(function() {
					s.update(VNS, function() {
						debug(req.client.socketId_, v.name, '%s save & update ok.', s.name_);
					});
				});
			});
		});
	});
}

function prprOnProxyRequest(req, response) {
	var m;

	if (!req.http || !(m = req.data.match(youPattern))) {
		req.client.close();
		return;
	}

	video(m[5] + ':' + m[2]).retrieve(parseInt(m[3]), parseInt(m[4]), function(data) {
		debug(req.client.socketId_, m[5] + ':' + m[2], '%s-%s retrieve ok.', m[3], m[4]);
		response.writeHead(200, { 'Content-Length': data.byteLength });
		response.end(data);
	}, function(v) {
		req.client.pipe(m[1], req.buffer, function(data) {
			v.segment(parseInt(m[3]), parseInt(m[4])).store(new Blob(data), function(s) {
				v.index.store(function() {
					s.update(VNS, function() {
						debug(req.client.socketId_, v.name, '%s save & update ok.', s.name_);
					});
				});
			});
		});
	});
}

function debug(name, state, opt_message, va_args) {
    var log = '[%s][%s] %c',
        color = 'color: #3914af; font-weight: bold; font-style: italic;';

    if (opt_message)
        log += opt_message;
    console.log.apply(console, [log, name, state, color].concat(Array.prototype.splice.call(arguments, 3)));
}

//	console.log('[%d][youtube] %c%s', req.client.socketId_, 'color: #876ed7; font-weight: bold; font-style: italic;', id);
// 12345678901234567890123456
// AAAAAAA
//     AAABBBBBBB
//           BBBBCCCCCCCCC
//            BBBCCCCCCCCCDDD
//
//   AAAAABBBBBBBCCC
/*
var v = video('maaya');
v.segment(0, 6).store('AAAAAAA', function() {
	v.segment(4, 13).store('AAABBBBBBB', function() {
		v.segment(10, 22).store('BBBBCCCCCCCCC', function() {
			v.segment(11, 25).store('BBBCCCCCCCCCDDD', function() {
				v.index.store(function(i, file) {
					v.retrieve(0, 10000, function(data) {
						console.log(String.fromCharCode.apply(null, new Uint8Array(data)));
					}, function() {});
				});
			});
		});
	});
});
*/
