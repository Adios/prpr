var IO = function() {

var requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem,
	persistentStorage = navigator.webkitPersistentStorage,
	STORAGE_CAPACITY = 2 * 1024 * 1024 * 1024; // defaults to 2GB.

if (!requestFileSystem || !persistentStorage)
	return {};

function error(e) {
	console.dir(e);
}

function IO() {
	this.root = null;
	this.cwd = null;
}

IO.prototype.init_ = function(callback) {
	var t = this;
	persistentStorage.requestQuota(STORAGE_CAPACITY, function (grantedBytes) {
		requestFileSystem(window.PERSISTENT, grantedBytes, function(fs) {
			t.cwd = t.root = fs.root;
			callback();
		}, error);
	}, error);
};

IO.prototype.write = function(path, opt_begin, data, opt_success, opt_failure) {
	switch (arguments.length) {
	case 3:
		if (typeof opt_begin == 'number') {		// path, begin, data
		} else if (typeof data == 'function') {	// path, data, ok
			opt_success = arguments[2];
			data = arguments[1];
		}
		break;
	case 4:
		if (typeof opt_begin == 'number') {		// path, begin, data, ok
		} else if (typeof data == 'function') {	// path, data, ok, fail
			opt_failure = arguments[3];
			opt_success = arguments[2];
			data = arguments[1];
		}
	default:
		break;
	}

	if (!this.cwd) {
		this.init_(this.write.bind(this, path, opt_begin, data, opt_success, opt_failure));
		return;
	}

	var t = this;
	this.cwd.getFile(path, {create: true}, function(entry) {
		entry.createWriter(function(writer) {
			if (opt_success) {
				writer.onwriteend = function(e) {
					opt_success(entry, t);
				};
			}
			writer.onerror = function(e) {
				console.error('FileWriter error in write(): ' + e.toString());
			};

			writer.write(data instanceof Blob ? data : new Blob([data]));
		}, error);
	}, error);
};

IO.prototype.read = function(path, opt_begin, opt_end, success, opt_failure) {
	switch (arguments.length) {
	case 2:
		success = arguments[1];						// path, ok
		break;
	case 3:
		if (typeof opt_begin == 'function') {		// path, ok, fail
			success = arguments[1];
			opt_failure = arguments[2];
		} else if (typeof opt_begin == 'number') {	// path, begin, ok
			success = arguments[2];
		}
		break;
	case 4:
		if (typeof opt_end == 'function') {			// read(path, begin, ok, fail)
			opt_failure = arguments[3];
			success = arguments[2];
		}
	default:
		break;
	}

	if (typeof success != 'function')
		throw new TypeError('IO.read() must be invoked with a callback.');

	if (!this.cwd) {
		this.init_(this.read.bind(this, path, opt_begin, opt_end, success, opt_failure));
		return;
	}

	var t = this;
	this.cwd.getFile(path, {}, function(entry) {
		entry.file(function(file) {
			var reader = new FileReader;

			reader.onloadend = function(e) {
				success(this.result, t);
			};
			reader.onerror = function(e) {
				console.error('FileReader error in read(): ' + e.toString());
			};
			reader.readAsArrayBuffer(file);
		}, error);
	}, function(error) {
		opt_failure(error, t);
	});
};

IO.prototype.mkdir = function(path, success, opt_failure) {
	if (!this.cwd) {
		this.init_(this.mkdir.bind(this, path, success, opt_failure));
		return;
	}

	var t = this;
	this.cwd.getDirectory(path, {create: true}, function(entry) {
		success(entry, t);
	}, opt_failure);
};

IO.prototype.chdir = function(entry) {
	if (!this.cwd) {
		this.init_(this.chdir.bind(this, path, success, opt_failure));
		return;
	}
	this.cwd = entry;
	return this;
};

IO.prototype.rmdir = function(path, opt_success, opt_failure) {
	if (!this.cwd) {
		this.init_(this.rmdir.bind(this, path, opt_success, opt_failure));
		return;
	}

	this.cwd.getDirectory(path, {}, function(entry) {
		entry.removeRecursively(function() {
			if (opt_success)
				opt_success();
		}, error);
	}, error);
};

return IO;

}();
