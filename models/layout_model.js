var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var LayoutSchema   = new Schema({
	name: String,
	img: String,
	_version: { type: Number, default: 0 },
	_deleted: { type: Boolean, default: false, index: true },
});

LayoutSchema.set("_perms", {
	admin: "crud",
	user: "r",
	all: "r"
});

module.exports = mongoose.model('Layout', LayoutSchema);