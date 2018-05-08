var yaml = require('js-yaml')
var fs = require('fs')

config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf-8'))

var fonoapi = require('./fonoapi.js')(config.fonoapi_key)

var phoneName = process.argv[2];
console.log(`Querying via main: ${phoneName}`);
fonoapi.query(process.argv[2]).then((result) => {
	console.log(JSON.stringify(result));
}).catch((err) => {
	console.error(err && err.stack)
})
