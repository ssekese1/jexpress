var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Location = require('./location_model');
var Layout = require('./layout_model');

var RoomSchema   = new Schema({
	location: { type: Objectid, ref: "Location" },
	name: String,
	img: String,
	cost: Number,
	off_peak_cost: Number,
	description: String,
	capacity: Number,
	layout: [{ type: Objectid, ref: "Layout" }],
	_deleted: { type: Boolean, default: false, index: true },
});

RoomSchema.set("_perms", {
	admin: "crud",
	user: "r",
});

module.exports = mongoose.model('Room', RoomSchema);