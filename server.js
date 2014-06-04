if (http.server) {
	var prpr = http.server(),
		// $1: host, used to pipe to, prevent to parse header.
		// $2: itag.
		// $3: range.
		// $4: video id, but there should exist better id retrival methods. FIXME
		youPattern = /^GET http:\/\/([^\/]+)\/videoplayback?.*itag=([\d]+).*range=([\d-]+)[^]+Referer: .*watch\?v=(\w+)/m;

	prpr.onRequest.addListener(prprOnRequest);
	prpr.onProxyRequest.addListener(prprOnProxyRequest);
	prpr.listen(1227);
}

function prprOnRequest(req, response) {
	var match, id;

	if (!req.http || !(match = req.data.match(youPattern))) {
		req.client.close();
		return;
	}

	id = match[4] + ':'  + match[2] + ':' + match[3];

	console.log('[%d][youtube] %c%s', req.client.socketId_, 'color: #3914af; font-weight: bold; font-style: italic;', id);

	req.client.pipe(match[1], req.buffer);
}

function prprOnProxyRequest(req, response) {
	var match, id;

	if (!req.http || !(match = req.data.match(youPattern))) {
		req.client.close();
		return;
	}

	id = match[4] + ':'  + match[2] + ':' + match[3];

	console.log('[%d][youtube] %c%s', req.client.socketId_, 'color: #876ed7; font-weight: bold; font-style: italic;', id);
}
