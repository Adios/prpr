var http = function() {

var tcp = chrome.sockets.tcp,
	tcpServer = chrome.sockets.tcpServer;

if (!tcp || !tcpServer || !EventEmitter)
	return {};

function ab2str(buf) {
	return String.fromCharCode.apply(null, new Uint8Array(buf));
}
function mixin(subject, var_objs) {
	var proto, i, p, len = arguments.length;

	for (i = 0; i++ < len - 1;) {
		proto = arguments[i].prototype;
		for (p in proto) {
			subject.prototype[p] = proto[p];
		}
	}
}

function Server() {
	EventEmitter.call(this);
	this.socketId_ = null;
}
mixin(Server, EventEmitter);

Server.prototype.listen = function(port, opt_address) {
	var t = this;

	tcpServer.create({}, function(server) {
		tcpServer.listen(server.socketId, opt_address || '0.0.0.0', port, function(result) {
			if (result < 0) {
				console.log('Error listening: ' + chrome.runtime.lastError.message);
				return;
			}
			tcpServer.onAccept.addListener(handleRequest.bind(t, server.socketId));
			t.socketId_ = server.socketId;
		});
	});

	function handleRequest(server, my) {
		if (my.socketId != server)
			return;
		tcp.onReceive.addListener(receive.bind(this, my.clientSocketId));
		tcp.onReceiveError.addListener(receiveError.bind(this, my.clientSocketId));
		tcp.setPaused(my.clientSocketId, false);
	}

	function receive(client, my) {
		if (my.socketId == client)
			this.emit('receive', my.socketId, my.data);
	}

	function receiveError(client, my) {
		if (my.socketId == client)
			this.emit('receiveError', my.socketId, my.resultCode);
	}
};

Server.prototype.close = function() {
	if (!this.socketId_)
		return;

	// tcpServer.onAccept.removeListener
	// tcp.onReceive.removeListener
	// tcp.onReceiveError.removeListener

	tcpServer.close(this.socketId_, function() {
		tcpServer.getSockets(function(infos) {
			for (var i = infos.length - 1; i >= 0; i--)
				tcp.close(infos[i].socketId);
		});
	});
};

/**
 * To encapsulate incoming HTTP messages.
 */
function IngressMessage(socket, data) {
	this.socket = socket;
	this.raw = data;
	this.headers_ = null;
	this.isHTTP = true;

	this.method = null;
	this.uri = '';

	this.status = null;
	this.reason = '';

	this.headersBegin = -1;
	this.headersEnd = -1;

	determineMessageType.call(this, data);

	function determineMessageType(msg) {
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
	}
}

IngressMessage.prototype.headers = function() {
	if (this.headers_)
		return this.headers_;
	return this.parse();
}

IngressMessage.prototype.header = function(key) {
	if (this.headers_)
		return this.headers_[key];
	return this.parse()[key];
}

IngressMessage.prototype.parse = function() {
	var	headers = {},
		raw = this.raw,
		headersBegin = this.headersBegin,
		headersEnd;

	this.headersEnd = headersEnd = raw.indexOf('\r\n\r\n', headersBegin);

	if (headersEnd != -1) {
		var line, colon, i,
			headerLines = raw.substring(headersBegin, headersEnd).split('\r\n');
		for (i = headerLines.length; i-- > 0;) {
			line = headerLines[i];
			colon = line.indexOf(':', 1);

			if (colon != -1)
				headers[line.substring(0, colon).toLowerCase()] = line.substring(colon + 2);
		}
	}

	this.headers_ = headers;
	return headers;
};

function createHTTPServer() {
	var server = new Server();

	server.addListener('receive', function(socket, data) {
		server.emit('message', new IngressMessage(socket, ab2str(data)));
	});
	server.addListener('receiveError', function(socket, code) {
		console.log('Error receiving: socket: %d, code: %d', socket, code);
		tcp.disconnect(socket);
		tcp.close(socket);
	});
	return server;
}

return {
	server: createHTTPServer
};

}();
