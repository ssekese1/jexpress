var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Mixed = mongoose.Schema.Types.Mixed;
var User = require("./user_model.js");

var LogSchema   = new Schema({
	date_created: { type: Date, default: Date.now },
	id: ObjectId,
	model: String,
	level: Number,
	user_id: { type: ObjectId, ref: "User" },
	title: String,
	message: String,
	data: Mixed,
});

LogSchema.set("_perms", {
	admin: "cru",
});

module.exports = mongoose.model('Log', LogSchema);