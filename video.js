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

Video.prototype.createDirectory = function(success) {
	var t = this;

	this.io.mkdir(this.dir, function(dir, io) {
		io.chdir(dir);
		success(t, dir);
	});
};

Video.prototype.segment = function() {
	if (!this.segment_)
		this.segment_ = new Segment(this);
	return this.segment_;
};

function Segment() {
}

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

Index.prototype.save = function(success) {
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
			t.video_.createDirectory(function() {
				t.save(function() {
					t.load(success, failure);
				});
			});
		}
		else failure(error);
	});
};

Index.prototype.insert = function(tuple) {
	this.local_.push(tuple);
};

return function(name) {
	return new Video(name);
}

}();

video('another').index.load(function(i) {
	console.log(i);
});

video('hello').createDirectory(function(v, dir) {
	console.log(dir);
	v.index.local_ = [[100,200], [0,500], [100,2000], [99,100]];
	v.index.save(function(i, file) {
		i.load(function(i) {
			console.log(i);
		});
	});
});
