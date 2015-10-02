var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var ConfigSchema   = new Schema({
	_id: String,
	value: String,
});

ConfigSchema.set("_perms", {
	admin: "crud",
	all: "r",
});

module.exports = mongoose.model('Config', ConfigSchema);