var restify = require('restify');
var should = require('should');

var testData = {
	foo: "Bar",
	bar: "Foo"
}
var test = {};

test.test = function() {
		var client = restify.createJsonClient({
			url: 'http://localhost:3001?apikey=admin',
			version: '~1.0'
		});
		client.post('/api/test?apikey=admin', testData, function(err, req, res, obj) {
			obj.should.have.property('data');
			obj.data.should.have.property('foo');
			obj.data.should.have.property('bar');
			obj.data.foo.should.equal("Bar");
			obj.data.bar.should.equal("Foo");
			// if (err) { 
			// 	test.results["Post a new test item"].err = err;
			// 	console.log("Error: ", err);
			// } else {
			// 	test.results["Post a new test item"].obj = obj;
			// 	var id = obj.data._id;
			// 	client.get('/api/test?apikey=admin', function (err, req, res, obj) {
			// 		if (err) { 
			// 			test.results["Get all test items"].err = err;
			// 			console.log("Error: ", err);
			// 		} else {
			// 			test.results["Get all test items"].obj = obj;
			// 			console.log(obj);
			// 		}
			// 		console.log(test.results);
			// 	});
			// }
		});

		
	}


module.exports = test;