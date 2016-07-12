var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var User = require("./user_model");

var CrmnoteSchema   = new Schema({
	organisation_id: { type: ObjectId, index: true },
	note: String,
	date_created: { index: true, type: Date, default: Date.now },
	_owner_id: { type: ObjectId, ref: "User" }
});

CrmnoteSchema.set("_perms", {
	admin: "cru",
});

module.exports = mongoose.model('Crmnote', CrmnoteSchema);