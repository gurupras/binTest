var express = require('express')
var fs = require('fs');
var path = require('path');
var app = express()

app.use('/static', express.static(path.join(__dirname, 'static')))
app.get('/', function (req, res) {
	res.send(fs.readFileSync(__dirname + '/static/html/webworker.html', 'utf-8'));
});

app.listen(3000, function () {
	console.log('Example app listening on port 3000!')
});

