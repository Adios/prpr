var video = function() {

if (!IO)
	return;

function ab2str(buf) {
	return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function debug(name, state, opt_message, va_args) {
	var log = '[%s][%s] %c',
		color = 'color: #ff7800;';

	if (opt_message)
		log += opt_message;
	console.log.apply(console, [log, name, state, color].concat(Array.prototype.splice.call(arguments, 3)));
}

function processError(error) {
	console.log(error);
}

function Video(name) {
	this.io = new IO;
	this.dir = '/' + name + '/';
	this.name = name;
	this.index = new Index(this);
}

Video.prototype.serve = function(begin, end, success, failure) {
	var t = this;
	this.index.load(function() {
		var result = t.index.lookup(begin, end);

		if (result.length == 0) {
			failure();
			return;
		}

		if (result.length == 2 && typeof result[0] == 'number') {
			t.segment(begin, end).load(function(data) {
				success(data);
			}, processError);
			return;
		}

		t.assemble(begin, end, function(data) {
			var reader = new FileReader;
			reader.onloadend = function() {
				success(this.result);
			};
			reader.readAsArrayBuffer(new Blob(data));
		}, processError);
	});
};

Video.prototype.retrieve = function(begin, end, success, failure) {
	var t = this;

	this.serve(begin, end, function(data) {
		success(data);
	}, function() {
		var xhr = new XMLHttpRequest;
		xhr.onloadend = function() {
			if (this.status == 404) {
				failure(t);
			} else if (this.status == 200) {
				t.segment(begin, end).store(this.response, function() {
					t.index.store(function() {
						debug(t.name, 'Video.retrieve', '%s-%s saves ok.', begin, end);
					});
				});
				success(this.response);
			}
		};
		xhr.ontimeout = function() {
			debug(t.name, 'Video.retrieve', '%s-%s timeout, fallback to proxy fetch.', begin, end);
			failure(t);
		};
		xhr.responseType = 'arraybuffer';
		xhr.open('GET', 'http://192.168.0.103:1989/' + t.name + '/' + begin + '-' + end);
		xhr.timeout = 1000;
		xhr.send();
	});
};

Video.prototype.getDirectory = function(success) {
	var t = this;

	this.io.mkdir(this.dir, function(dir, io) {
		io.chdir(dir);
		success(t, dir);
	});
};

Video.prototype.assemble = function(begin, end, success, failure) {
	var segments = this.index.lookup(begin, end),
		len = segments.length,
		eachState = [],
		fragment = [];

	if (len == 0) {
		return failure();
	}

	// FIXME: 1. needs a timer?
	//        2. needs to maintain the order of piece loading.
	for (var i = 0; i < len; i++) {
		var s = new Segment(this, segments[i][0][0], segments[i][0][1]);

		s.load(
			(function(i) {
				debug(s.video_.name, 'Video.assemble', 'reading %s-%s from segment %s-%s.',
					segments[i][1], segments[i][2], segments[i][0][0], segments[i][0][1]);

				return function(data) {
					fragment.push(data.slice(segments[i][1], segments[i][2] + 1));
					eachState.push(true);

					if (eachState.length == len)
						success(fragment);
				};
			})(i)
		);
	}
};

Video.prototype.segment = function(begin, end) {
	return new Segment(this, begin, end);
};

function Segment(video, begin, end) {
	this.name_ = begin + '-' + end;
	this.video_ = video;
	this.begin_ = begin;
	this.end_ = end;
}

Segment.prototype.store = function(data, success, opt_failure) {
	var t = this;

	this.video_.getDirectory(function(v) {
		v.io.write(t.name_, data, function() {
			v.index.insert([t.begin_, t.end_]).store(function() {
				success(t);
			});
		}, opt_failure);
	});
};

Segment.prototype.load = function(success, opt_failure) {
	var t = this;
	this.video_.io.read(this.video_.dir + this.name_, function(result) {
		success(result);
	}, function(error) {
		opt_failure(error);
	});
};

function Index(video) {
	this.video_ = video;
	/**
	 * [
	 *   [begin, end], # segment name: begin + '-' + end
	 *   [begin, end],
	 *   ...
	 *   [begin, end]
	 * ]
	 */
	this.local_ = [];
}

Index.prototype.store = function(opt_success) {
	var t = this;

	// the algorithm of lookup() requires a table which is
	// increasingly sorted and with each value being unique.
	this.local_.sort(function(a, b) {
		if (a[0] == b[0])
			return a[1] - b[1];
		return a[0] - b[0];
	});

	this.local_ = this.local_.reduce(function(p, c) {
		if (p.indexOf(c) < 0) p.push(c);
		return p;
	}, []);

	this.video_.io.write('index', new Blob([JSON.stringify(this.local_)]), function(file) {
		if (opt_success) opt_success(t, file);
	});
};

Index.prototype.load = function(success, failure) {
	var t = this;

	this.video_.io.read(this.video_.dir + 'index', function(data) {
		t.local_ = JSON.parse(ab2str(data));
		success(t);
	}, function(error) {
		if (error.name == 'NotFoundError') {
			debug(t.video_.name, 'Index.load', 'Index not found, creates a new one.');
			t.video_.getDirectory(function() {
				t.store(function() {
					t.load(success, failure);
				});
			});
		}
		else failure(error);
	});
};

Index.prototype.insert = function(tuple) {
	this.local_.push(tuple);
	return this;
};

Index.prototype.lookup = function(begin, end) {
	var	i, cur,
		map = this.local_,
		len = map.length,
		hasCovered = false,
		result = [];

	if (begin > end)
		return result;

	for (i = 0; i < len; i++) {
		var rangeBegin = map[i][0],
			rangeEnd = map[i][1];

		if (rangeBegin == begin && rangeEnd == end)
			return [rangeBegin, rangeEnd];
	}

	for (i = 0, cur = begin; i < len; i++) {
		var rangeBegin = map[i][0],
			rangeEnd = map[i][1];

		if (cur >= rangeEnd)
			continue;

		if (cur >= rangeBegin) {
			if (end > rangeEnd) {
				// find one segment.
				result.push([map[i], cur - rangeBegin, rangeEnd - rangeBegin]);
				cur = rangeEnd + 1;
			} else {
				// the current segment covers our end.
				result.push([map[i], cur - rangeBegin, end - rangeBegin]);
				hasCovered = true;
				break;
			}
		}
	}

	if (!hasCovered)
		return [];
	return result;
};

return function(name) {
	return new Video(name);
}

}();
