var video = function() {

if (!IO)
	return;

function ab2str(buf) {
	return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function Video(name) {
	this.io = new IO;
	this.dir = '/' + name + '/';
	this.name = name;
	this.index = new Index(this);
}

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

	// FIXME: timeout
	for (var i = 0; i < len; i++) {
		var s = new Segment(this, segments[i][0][0], segments[i][0][1]);

		console.log(segments[i]);

		s.load(
			(function(i) {
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

Index.prototype.store = function(success) {
	var t = this;

	// findRange algorithms needs an increasely sorted table.
	this.local_.sort(function(a, b) {
		if (a[0] == b[0])
			return a[1] - b[1];
		return a[0] - b[0];
	});

	this.video_.io.write('index', new Blob([JSON.stringify(this.local_)]), function(file) {
		success(t, file);
	});
};

Index.prototype.load = function(success, failure) {
	var t = this;

	this.video_.io.read(this.video_.dir + 'index', function(data) {
		t.local_ = JSON.parse(ab2str(data));
		success(t);
	}, function(error) {
		if (error.name == 'NotFoundError') {
			console.log('[%s] index not found, creating one.', t.video_.name);
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

function ab2str(buf) {
	return String.fromCharCode.apply(null, new Uint8Array(buf));
}

// 12345678901234567890123456
// AAAAAAA
//     AAABBBBBBB
//           BBBBCCCCCCCCC
//            BBBCCCCCCCCCDDD
//
//   AAAAABBBBBBBCCC

/*
var v = video('maaya');
v.segment(0, 6).store('AAAAAAA', function() {
	v.segment(4, 13).store('AAABBBBBBB', function() {
		v.segment(10, 22).store('BBBBCCCCCCCCC', function() {
			v.segment(11, 25).store('BBBCCCCCCCCCDDD', function() {
				v.index.store(function(i, file) {
					v.index.load(function(i) {
						v.assemble(2, 16, function(data) {
							var b = new Blob(data);
							var reader = new FileReader();
							reader.onloadend = function() {
								console.log(ab2str(this.result));
							};
							reader.readAsArrayBuffer(b);
						});
					});
				});
			});
		});
	});
});
*/
