/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var spawn = require('child_process').spawn;
var readline = require('readline');

var contextFiles = {};

function buildContext(context) {
	var existing = Object.keys(contextFiles);

	// @HACK
	if (typeof context !== 'string') {
		if (!existing.length) return reject(context);
		return resolve(Object.keys(contextFiles)[0]);
	}

	var parent = existing.find(function(path) {
		return context.indexOf(path) === 0;
	});

	if (parent) {
		return contextFiles[parent];
	}

	return new Promise(function(resolve, reject) {
		var items = [];
		readline.createInterface({ input: spawn('/usr/bin/find', [context, '-type', 'f']).stdout })
			.on('line', items.push.bind(items))
			.on('close', resolve.bind(null, items))
			.on('error', reject);
	}).then(function(list) {
		return list;
	});
};

function FileExistsPlugin(source, target) {
	this.source = source;
	this.target = target;
}
module.exports = FileExistsPlugin;

FileExistsPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	resolver.plugin(this.source, function(request, callback) {
		var fs = this.fileSystem;
		var file = request.path;
		var key = request.descriptionFileRoot;
		var context = (contextFiles[key] = contextFiles[key] || buildContext(key));

		context.then(function(list) {
			if(list.indexOf(file) === -1) {
				if(callback.missing) callback.missing.push(file);
				if(callback.log) callback.log(file + " doesn't exist");
				return callback();
			}
			this.doResolve(target, request, "existing file: " + file, callback, true);
		}.bind(this)).catch(function(e) {
			fs.stat(file, function(err, stat) {
				if(err || !stat || (stat && !stat.isFile())) {
					if(callback.missing) callback.missing.push(file);
					if(callback.log) callback.log(file + (stat && " is not a file" || " doesn't exist"));
					return callback();
				}
				this.doResolve(target, request, "existing file: " + file, callback, true);
			}.bind(this));
		}.bind(this));
	});
};
