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
		response.writeHead(200, { 'Content-Length': data.byteLength });
		response.end(data);
		console.log('segment: %s-%s served', m[2], m[3]);
	}, function() {
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

//	console.log('[%d][youtube] %c', req.client.socketId_, 'color: #3914af; font-weight: bold; font-style: italic;');

	video(m[5] + ':' + m[2]).retrieve(parseInt(m[3]), parseInt(m[4]), function(data) {
		response.writeHead(200, { 'Content-Length': data.byteLength });
		response.end(data);
	}, function(v) {
		console.log('segment not found: %s-%s', m[3], m[4]);
		req.client.pipe(m[1], req.buffer, function(data) {
			v.segment(parseInt(m[3]), parseInt(m[4])).store(new Blob(data), function() {
				v.index.store(function() {
					console.log('store segment complete');
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
		response.writeHead(200, { 'Content-Length': data.byteLength });
		response.end(data);
	}, function(v) {
		console.log('segment not found: %s-%s', m[3], m[4]);
		req.client.pipe_.mirrorCallback = function(data) {
			v.segment(parseInt(m[3]), parseInt(m[4])).store(new Blob(data), function() {
				v.index.store(function() {
					console.log('ok') });
			});
		};
	});
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
