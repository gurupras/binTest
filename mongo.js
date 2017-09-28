module.exports = function(url) {
	if(!url) {
		throw new Error('Must specify MongoDB URL');
	}

	// Use connect method to connect to the server
	var ret = function() {};

	function sanitizeDoc(doc) {
		var keys = Object.keys(doc);
		console.log(`${JSON.stringify(keys)}`);
		for(var idx = 0; idx < keys.length; idx++) {
			var key = keys[idx];
			var value = doc[key];
			if(typeof value === 'object') {
				value = sanitizeDoc(value);
			}
			var _key = key.replace(/[\.\$]/g, '>');
			if(_key !== key) {
				console.log(`Replacing key ${key} with ${_key}`);
				delete doc[key];
				doc[_key] = value;
			}
		}
		return doc;
	}

	ret.insertDocument = async function(doc, callback) {
		console.log('Sanitizing document ...');
		var doc = sanitizeDoc(doc);
		await ret.connect();
		console.log(`Inserting document: ${JSON.stringify(doc)}`);
		var collection = ret.db.collection('results');
		return new Promise((resolve, reject) => {
			collection.insert(doc).then((result) => {
				console.log(`Insert result: ${JSON.stringify(result)}`);
				resolve(result);
			}).catch((err) => {
				console.log(err && err.stack);
				reject(err);
			});
		});
	};

	ret.close = function() {
		ret.db.close();
	};

	var mongoClient = require('mongodb').MongoClient;

	ret.connect = function() {
		if(!ret.__connectPromise) {
			ret.__connectPromise = new Promise((resolve, reject) => {
				mongoClient.connect(url).then((db) =>  {
					ret.db = db;
					console.log("Connected successfully to server");
					resolve(db);
				}).catch((err) => {
					console.log(err && err.stack);
					reject(err);
				});
			});
		}
		return ret.__connectPromise;
	}
	ret.connect();
	return ret;
}
