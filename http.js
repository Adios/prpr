var http = function() {

var tcp = chrome.sockets.tcp,
	tcpServer = chrome.sockets.tcpServer;

if (!tcp || !tcpServer || !EventEmitter)
	return {};

function ab2str(buf) {
	return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function Server() {
	EventEmitter.call(this);
	this.socketId_ = null;
}
Server.prototype.__proto__ = EventEmitter.prototype;

Server.prototype.listen = function(port) {
	var t = this;
	tcpServer.create({}, function(server) {
		tcpServer.listen(server.socketId, '0.0.0.0', port, function(result) {
			if (result < 0) {
				console.log('Error listening: ' + chrome.runtime.lastError.message);
				return;
			}

			tcpServer.onAccept.addListener(function(info) {
				if (info.socketId != server.socketId)
					return;
				t.acceptConnection_(info.clientSocketId);
			});

			t.socketId_ = server.socketId;
		});
	});
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

Server.prototype.acceptConnection_ = function(client) {
	var t = this;
	tcp.onReceive.addListener(function(info) {
		if (info.socketId != client)
			return;

		t.processRequest_(info.socketId, info.data);
	});
	tcp.onReceiveError.addListener(function(info) {
		if (info.socketId != client)
			return;

		console.log('Error receiving: socket: %d, code: %d', info.socketId, info.resultCode);
		tcp.disconnect(info.socketId);
		tcp.close(info.socketId);
	});
	tcp.setPaused(client, false);
};

Server.prototype.processRequest_ = function(socket, data) {
	this.emit('test', socket, ab2str(data));
};

return {
	Server: Server
};

}();
