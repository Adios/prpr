if (http.server) {
	var server = http.server();

	server.on('message', function anonymous(msg) {
		console.log('socket %d comes with: %s', msg.socket, msg.raw);
		server.removeListener('message', anonymous);
	}).listen(1227);
}
