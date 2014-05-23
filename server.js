if (http && http.Server) {
	var server = new http.Server();

	server.listen(1227);

	server.on('test', function anonymous(socket, data) {
		console.log('%d comes with: %s', socket, data);
		server.removeListener('test', anonymous);
	});
}
