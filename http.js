var http = function() {

var socket = chrome.socket;

if (!socket)
	return {};

var responseMap = {
	200: 'OK',
	206: 'Partial Content',
	301: 'Moved Permanently',
	304: 'Not Modified',
	400: 'Bad Request',
	401: 'Unauthorized',
	403: 'Forbidden',
	404: 'Not Found',
	413: 'Request Entity Too Large',
	414: 'Request-URI Too Long',
	500: 'Internal Server Error'
};

var extensionTypes = {
	'css': 'text/css',
	'html': 'text/html',
	'htm': 'text/html',
	'jpg': 'image/jpeg',
	'jpeg': 'image/jpeg',
	'js': 'text/javascript',
	'png': 'image/png',
	'svg': 'image/svg+xml',
	'txt': 'text/plain',
	'mp4': 'video/mp4'
};

/**
 * Convert from an ArrayBuffer to a string.
 * @param {ArrayBuffer} buffer The array buffer to convert.
 * @return {string} The textual representation of the array.
 */
var arrayBufferToString = function(buffer) {
	var array = new Uint8Array(buffer);
	var str = '';
	for (var i = 0; i < array.length; ++i) {
		str += String.fromCharCode(array[i]);
	}
	return str;
};

/**
 * Convert a string to an ArrayBuffer.
 * @param {string} string The string to convert.
 * @return {ArrayBuffer} An array buffer whose bytes correspond to the string.
 */
var stringToArrayBuffer = function(string) {
	var buffer = new ArrayBuffer(string.length);
	var bufferView = new Uint8Array(buffer);
	for (var i = 0; i < string.length; i++) {
		bufferView[i] = string.charCodeAt(i);
	}
	return buffer;
};

/**
 * An event source can dispatch events. These are dispatched to all of the
 * functions listening for that event type with arguments.
 * @constructor
 */
function EventSource() {
	this.listeners_ = {};
};

EventSource.prototype = {
	/**
	 * Add |callback| as a listener for |type| events.
	 * @param {string} type The type of the event.
	 * @param {function(Object|undefined): boolean} callback The function to call
	 *     when this event type is dispatched. Arguments depend on the event
	 *     source and type. The function returns whether the event was "handled"
	 *     which will prevent delivery to the rest of the listeners.
	 */
	addEventListener: function(type, callback) {
		if (!this.listeners_[type])
			this.listeners_[type] = [];
		this.listeners_[type].push(callback);
	},

	/**
	 * Remove |callback| as a listener for |type| events.
	 * @param {string} type The type of the event.
	 * @param {function(Object|undefined): boolean} callback The callback
	 *     function to remove from the event listeners for events having type
	 *     |type|.
	 */
	removeEventListener: function(type, callback) {
		if (!this.listeners_[type])
			return;
		for (var i = this.listeners_[type].length - 1; i >= 0; i--) {
			if (this.listeners_[type][i] == callback) {
				this.listeners_[type].splice(i, 1);
			}
		}
	},

	/**
	 * Dispatch an event to all listeners for events of type |type|.
	 * @param {type} type The type of the event being dispatched.
	 * @param {...Object} var_args The arguments to pass when calling the
	 *     callback function.
	 * @return {boolean} Returns true if the event was handled.
	 */
	dispatchEvent: function(type, var_args) {
		if (!this.listeners_[type])
			return false;
		for (var i = 0; i < this.listeners_[type].length; i++) {
			if (this.listeners_[type][i].apply(null, Array.prototype.slice.call(arguments, 1))) {
				return true;
			}
		}
	}
};

function HttpServer() {
	EventSource.apply(this);
	this.readyState_ = 0;
}

HttpServer.prototype = {
	__proto__: EventSource.prototype,

	listen: function(port) {
		var t = this;
		socket.create('tcp', {}, function(info) {
			t.socketInfo_ = info;
			socket.listen(t.socketInfo_.socketId, '0.0.0.0', port, 50, function(result) {
				t.readyState_ = 1;
				t.accept_(t.socketInfo_.socketId);
			});
		});
	},

	accept_: function(socketId) {
		var t = this;
		socket.accept(this.socketInfo_.socketId, function(info) {
			t.read_(info.socketId);
			t.accept_(socketId);
		});
	},

	read_: function(socketId) {
		var t = this;
		var data = '';
		var end = 0;
		var onData = function(info) {
			if (info.resultCode <= 0) {
				socket.disconnect(socketId);
				socket.destroy(socketId);
				return;
			}
			data += arrayBufferToString(info.data).replace(/\r\n/g, '\n');

			end = data.indexOf('\n\n', end);
			if (end == -1) {
				end = data.length - 1;
				socket.read(socketId, onData);
				return;
			}

			var headers = data.substring(0, end).split('\n');
			var headerMap = {};
			var line = headers[0].split(' ');
			var method = line[0];
			var url = line[1];

			for (var i = 1; i < headers.length; i++) {
				var occur = headers[i].indexOf(':');
				if (occur > 0) {
					var key = headers[i].substring(0, occur);
					var value = headers[i].substring(occur + 1).trim();
					headerMap[key] = value;
				}
			}

			var request = new HttpRequest(method, url, headerMap, socketId);
			t.onRequest_(request);
		};
		socket.read(socketId, onData);
	},

	onRequest_: function(request) {
		var type = request.headers['Upgrade'] ? 'upgrade' : 'request';
		var keepAlive = request.headers['Connection'] = 'keep-alive';
		if (!this.dispatchEvent(type, request))
			request.close();
		else if (keepAlive)
			this.read_(request.socketId_);
	}
}

function HttpRequest(method, url, headers, socketId) {
	this.method = method;
	this.url = url;
	this.version = 'HTTP/1.1';
	this.headers = headers;
	this.reponseHeaders_ = {};
	this.headerSent = false;
	this.socketId_ = socketId;
	this.writes_ = 0;
	this.bytesRemaining = 0;
	this.finished_ = false;
	this.readyState = 1;
}

HttpRequest.prototype = {
	__proto__: EventSource.prototype,

	serve: function(url) {
		var t = this;
		var xhr = new XMLHttpRequest();
		xhr.onloadend = function() {
			var type = 'text/plain';
			if (this.getResponseHeader('Content-Type')) {
				type = this.getResponseHeader('Content-Type');
			} else if (url.indexOf('.') != -1) {
				var ext = url.substr(url.indexOf('.') + 1);
				type = extensionTypes[ext] || type;
			}
			console.log('Served: ' + url);
			var contentLength = this.getResponseHeader('Content-Length');
			if (xhr.status == 200)
				contentLength = (this.response && this.response.byteLength) || 0;
			t.writeHead(this.status, {
				'Content-Type': type,
				'Content-Length': contentLength
			}).end(this.response);
		};
		xhr.open('GET', url, true);
		xhr.responseType = 'arraybuffer';
		xhr.send();
	},

	serveRange: function(url) {
		var t = this;
		var xhr = new XMLHttpRequest();
		xhr.onloadend = function() {
			var type = 'text/plain';
			if (this.getResponseHeader('Content-Type')) {
				type = this.getResponseHeader('Content-Type');
			} else if (url.indexOf('.') != -1) {
				var ext = url.substr(url.indexOf('.') + 1);
				type = extensionTypes[ext] || type;
			}

			var range = t.headers['Range'].split('=')[1].split('-');
			var rangeBegin = range[0];
			var rangeEnd = range[1];

			if (rangeEnd == '')
				rangeEnd = this.response.byteLength - 1;

			t.writeHead(206, {
				'Content-Type': type,
				'Content-Length': rangeEnd - rangeBegin + 1,
				'Content-Range': 'bytes ' + rangeBegin + '-' + rangeEnd + '/' + this.response.byteLength
			});
			t.end(this.response.slice(rangeBegin, rangeEnd + 1));
		};

		console.log('Range served: ', url);

		xhr.open('GET', url, true);
		xhr.responseType = 'arraybuffer';
		xhr.send();
	},

	writeHead: function(responseCode, responseHeaders) {
		var headerString = this.version + ' ' + responseCode + ' ' + (responseMap[responseCode] || 'Unknown');
		this.responseHeaders_ = responseHeaders;
		if (this.headers['Connection'] == 'keep-alive')
			responseHeaders['Connection'] = 'keep-alive';
		if (!responseHeaders['Content-Length'] && responseHeaders['Connection'] == 'keep-alive')
			responseHeaders['Transfer-Encoding'] = 'chunked';
		for (var i in responseHeaders) {
			headerString += '\r\n' + i + ': ' + responseHeaders[i];
		}
		headerString += '\r\n\r\n';
		this.write_(stringToArrayBuffer(headerString));
	},

	end: function(opt_data) {
		if (opt_data)
			this.write(opt_data);
		if (this.responseHeaders_['Transfer-Encoding'] == 'chunked')
			this.write('');
		this.finished_ = true;
		this.checkFinished_();
	},

	write: function(data) {
		if (this.responseHeaders_['Transfer-Encoding'] == 'chunked') {
			var newline = '\r\n';
			var byteLength = (data instanceof ArrayBuffer) ? data.byteLength : data.length;
			var chunkLength = byteLength.toString(16).toUpperCase() + newline;
			var buffer = new ArrayBuffer(chunkLength.length + byteLength + newline.length);
			var bufferView = new Uint8Array(buffer);
			for (var i = 0; i < chunkLength.length; i++)
				bufferView[i] = chunkLength.charCodeAt(i);
			if (data instanceof ArrayBuffer) {
				bufferView.set(new Uint8Array(data), chunkLength.length);
			} else {
				for (var i = 0; i < data.length; i++)
					bufferView[chunkLength.length + i] = data.charCodeAt(i);
			}
			for (var i = 0; i < newline.length; i++)
				bufferView[chunkLength.length + byteLength + i] = newline.charCodeAt(i);
			data = buffer;
		} else if (!(data instanceof ArrayBuffer)) {
			data = stringToArrayBuffer(data);
		}
		this.write_(data);
	},

	write_: function(array) {
		var t = this;
		this.byteRemaining += array.byteLength;
		socket.write(this.socketId_, array, function(info) {
			if (info.bytesWritten < 0) {
				console.error('Error writing to socket ' + info.socketId + ', code ' + info.bytesWritten);
				return;
			}
			t.bytesRemaining -= info.bytesWritten;
			t.checkFinished_();
		});
	},

	close: function() {
		if (this.headers['Connection'] != 'keep-alive') {
			socket.disconnect(this.socketId_);
			socket.destroy(this.socketId_);
		}
		this.socketId_ = 0;
		this.readyState = 3;
	},

	checkFinished_: function() {
		if (!this.finished_ || this.bytesRemaining > 0)
			return;
		this.close();
	}
};

return {
	'Server': HttpServer
};

}();
