var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var TestSchema   = new Schema({
	foo: String,
	bar: String,
	_owner_id: Objectid
});

TestSchema.set("_perms", {
	admin: "crud",
	owner: "crud",
	user: "cr",
	all: "r"
});

TestSchema.statics.test = function() {
	return "Testing OKAY!";
}

module.exports = mongoose.model('Test', TestSchema);