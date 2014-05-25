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

Server.prototype.listen = function(port) {
	var t = this;

	tcpServer.create({}, function(server) {
		tcpServer.listen(server.socketId, '0.0.0.0', port, function(result) {
			if (result < 0) {
				console.log('Error listening: ' + chrome.runtime.lastError.message);
				return;
			}
			tcpServer.onAccept.addListener(acceptConnection.bind(t, server.socketId));
			t.socketId_ = server.socketId;
		});
	});

	function acceptConnection(server, my) {
		if (my.socketId != server)
			return;

		tcp.onReceive.addListener(processRequest.bind(this, my.clientSocketId));
		tcp.onReceiveError.addListener(processError.bind(this, my.clientSocketId));
		tcp.setPaused(my.clientSocketId, false);
	}

	function processError(client, my) {
		if (my.socketId != client)
			return;
		console.log('Error receiving: socket: %d, code: %d', client, my.resultCode);
		tcp.disconnect(client);
		tcp.close(client);
	}

	function processRequest(client, my) {
		if (my.socketId != client)
			return;
		this.emit('test', client, ab2str(my.data));
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

return {
	Server: Server
};

}();
