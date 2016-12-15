var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;
var friendly = require("mongoose-friendly");

var PartnerSchema   = new Schema({
	name: String,
	date_created: { type: Date, default: Date.now },
	_version: { type: Number, default: 0 },
	_deleted: { type: Boolean, default: false, index: true },
});

PartnerSchema.set("_perms", {
	admin: "crud",
	user: "r",
	all: "r"
});

PartnerSchema.plugin(friendly, {
	source: 'name',
	friendly: 'urlid'
});

module.exports = mongoose.model('Partner', PartnerSchema);