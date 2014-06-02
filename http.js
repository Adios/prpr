var http = function() {

var tcp = chrome.sockets.tcp,
	tcpServer = chrome.sockets.tcpServer,
	Event = chrome.Event || eventEmitter.Event;

if (!tcp || !tcpServer || !Event)
	return {};

function ab2str(buf) {
	return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function Server(opt_requestListener) {
	this.socketId_ = null;
	this.connections_ = [];
	this.acceptListener_ = undefined;

	this.onRequest = new Event();

	if (opt_requestListener)
		this.onRequest.addListener(opt_requestListener);
}

Server.prototype.listen = function(port, opt_address) {
	var t = this;

	tcpServer.create({}, function(server) {
		tcpServer.listen(server.socketId, opt_address || '0.0.0.0', port, function(result) {
			if (result < 0) {
				console.log('Error listening: ' + chrome.runtime.lastError.message);
				return;
			}
			t.socketId_ = server.socketId;
			t.acceptListener_ = establishConnectionForServer;
			tcpServer.onAccept.addListener(t.acceptListener_);
		});
	});

	function establishConnectionForServer(my) {
		if (my.socketId != t.socketId_)
			return;
		var c = new Connection(t, my.clientSocketId);
		t.connections_.push(c);
		c.establish();
	}
};

Server.prototype.close = function(opt_connection) {
	if (!this.socketId_)
		return;

	// close the given connection
	if (opt_connection) {
		var i = this.connections_.indexOf(opt_connection);
		if (i > -1)
			this.connections_.splice(i, 1);
		return;
	}

	// or close the server
	tcpServer.onAccept.removeListener(this.acceptListener_);
	tcpServer.disconnect(this.socketId_);
	tcpServer.close(this.socketId_);

	for (var i = this.connections_.length - 1; i >= 0; i--)
		this.connections_[i].close();
};

/**
 * Per-client logic, created when accepting a connection from Server.
 */
function Connection(server, socket) {
	this.socketId_ = socket;
	this.server = server;
	this.receiveListener_ = undefined;
	this.receiveErrorListener_ = undefined;
}

Connection.prototype.establish = function() {
	this.receiveListener_ = dataFromClient.bind(this);
	this.receiveErrorListener_ = errorFromClient.bind(this);

	tcp.onReceive.addListener(this.receiveListener_);
	tcp.onReceiveError.addListener(this.receiveErrorListener_);
	tcp.setPaused(this.socketId_, false);

	function dataFromClient(my) {
		if (my.socketId != this.socketId_)
			return;
		this.server.onRequest.dispatch(new IngressMessage(this, ab2str(my.data)));
	}

	function errorFromClient(my) {
		if (my.socketId != this.socketId_)
			return;
		console.log('Error receiving: socket: %d, code: %d', my.socketId, my.resultCode);
		this.close();
	}
};

Connection.prototype.close = function() {
	if (!this.socketId_)
		return;
	this.server.close(this);
	tcp.onReceive.removeListener(this.receiveListener_);
	tcp.onReceiveError.removeListener(this.receiveErrorListener_);
	tcp.disconnect(this.socketId_);
	tcp.close(this.socketId_);
};

/**
 * Encapsulates an incoming HTTP message, the first argument to onRequest event.
 */
function IngressMessage(client, data) {
	this.client = client;
	this.data = data;
	this.isHTTP = true;

	this.headers_ = null;

	// when receives request from clients
	this.method = '';
	this.uri = '';
	// when receives response from peers
	this.status = null;
	this.reason = '';

	this.headersBegin = -1;
	this.headersEnd = -1;

	(function determineMessageType(msg) {
		var	firstCRLF = msg.indexOf('\r\n', 13),
			symbols = msg.substring(0, firstCRLF).split(' ', 3);

		switch(symbols[0]) {
		case 'GET': case 'POST': case 'PUT': case 'DELETE':
			this.method = symbols[0];
			this.uri = symbols[1];
			break;
		case 'HTTP/1.1':
			this.status = symbols[1];
			this.reason = symbols[2];
			break;
		default:
			this.isHTTP = false;
			return;
		}
		this.headersBegin = firstCRLF + 2;
	}).call(this, data);
}

IngressMessage.prototype.headers = function() {
	if (this.headers_)
		return this.headers_;
	return this.parse().headers_;
}

IngressMessage.prototype.header = function(key) {
	if (this.headers_)
		return this.headers_[key];
	return this.parse().headers_[key];
}

IngressMessage.prototype.parse = function() {
	var	headers = {},
		message = this.data,
		headersBegin = this.headersBegin,
		headersEnd;

	this.headersEnd = headersEnd = message.indexOf('\r\n\r\n', headersBegin);

	if (headersEnd != -1) {
		var line, colon, i,
			headerLines = message.substring(headersBegin, headersEnd).split('\r\n');
		for (i = headerLines.length; i-- > 0;) {
			line = headerLines[i];
			colon = line.indexOf(':', 1);

			if (colon != -1)
				headers[line.substring(0, colon).toLowerCase()] = line.substring(colon + 2);
		}
	}

	this.headers_ = headers;
	return this;
};

return {
	server: function(requestListener) {
		return new Server(requestListener);
	}
};

}();
