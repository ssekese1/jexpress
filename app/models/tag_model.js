var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Mixed = mongoose.Schema.Types.Mixed;

var TestSchema   = new Schema({
	name: { type: String, unique: true, index: true, set: toLower },
	type: String,
});

TestSchema.set("_perms", {
	admin: "crud",
	user: "cr",
	all: "r"
});

function toLower (v) {
	return v.toLowerCase();
};

module.exports = mongoose.model('Test', TestSchema);