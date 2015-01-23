var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Location = require('./location_model');

var RoomSchema   = new Schema({
	location: { type: Objectid, ref: "Location" },
	name: String,
	img: String,
	cost: Number,
	description: String,
	capacity: Number,
});

RoomSchema.set("_perms", {
	admin: "crud",
	user: "r",
});

module.exports = mongoose.model('Room', RoomSchema);