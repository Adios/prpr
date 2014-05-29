function EventEmitter() {
	this.events_ = {};
}

EventEmitter.prototype.emit = function(type, var_args) {
	var listener = listeners = this.events_[type];

	if (!listener)
		return false;
	else if (typeof listener == 'function') {
		switch (arguments.length) {
		case 1:
			listener.call();
			break;
		case 2:
			listener.call(null, arguments[1]);
			break;
		case 3:
			listener.call(null, arguments[1], arguments[2]);
			break;
		default:
			listener.apply(null, Array.prototype.slice.call(arguments, 1));
		}
	} else {
		var len = listeners.length;
		for (var i = 0; i < len; i++)
			listeners[i].apply(null, Array.prototype.slice.call(arguments, 1));
	}

	return true;
};

EventEmitter.prototype.addListener = EventEmitter.prototype.on = function(type, listener) {
	if (typeof listener != 'function')
		throw TypeError('listener must be a function.');

	// prevent creating an array if there is only one listener.
	if (!this.events_[type])
		this.events_[type] = listener;
	else if (typeof this.events_[type] == 'object')
		this.events_[type].push(listener);
	else
		this.events_[type] = [this.events_[type], listener];

	return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
	if (typeof listener != 'function')
		throw TypeError('listener must be a function.');

	if (!this.events_[type])
		return this;

	var list = this.events_[type],
		len = list.length,
		pos = -1;

	if (list === listener)
		delete this.events_[type];
	else {
		for (var i = len; i-- > 0;) {
			if (list[i] === listener) {
				pos = i;
				break;
			}
		}

		if (pos < 0)
			return this;

		if (list.len === 1) {
			list.len = 0;
			delete this.events_[type];
		} else {
			list.splice(pos, 1);
		}
	}

	return this;
};
