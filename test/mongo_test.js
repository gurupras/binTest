var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');

var config;
try {
	config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'));
} catch (e) {
	console.log('Failed to read config.yaml: ' + e);
	process.exit(-1);
}

var mongo = require('./mongo.js')(config.mongodb.url);

var query = JSON.parse(`{"$or":[{}],"type":"expt-data","experimentID":"27cce7f9-747e-4b92-8a48-5a0a5a0d3422"}`);
mongo.query(query).then((result) => {
  result.toArray((err, docs) => {
    console.log(docs.length)
  })
})
