var rest = require("restler-q");
var async = require("async");

var count = 5000;
var queue = [];

var testFunc = function(cb) {
	rest.get("http://localhost:3001/api/location")
	.then(function(result) {
		cb(null);
	}, function(err) {
		console.error(err);
		cb(err);
	});
};

for (var x = 0; x < count; x++) {
	queue.push(testFunc);
}
var startTime = +new Date();
console.time("StressTest");
async.series(queue, function(result) {
	console.timeEnd("StressTest");
	var endTime = +new Date();
	var diff = endTime - startTime;
	console.log("Time: " + diff + "ms, Per Second: " + (count / (diff / 1000)));
});