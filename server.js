if (http.server) {
	http.server(onRequest).listen(1227);

	function onRequest(req, response) {
		if (req.isHTTP) {
			console.log('socket %d comes with:\n%s', req.client.socketId_, req.data);
			console.dir(req.headers());
		}
		req.client.close();
		//req.client.server.close();
	}
}
