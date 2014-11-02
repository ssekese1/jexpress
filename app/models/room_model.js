var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var RoomSchema   = new Schema({
	location: Objectid,
	name: String,
	img: String,
});

RoomSchema.set("_perms", {
	admin: "crud",
	user: "r",
});

module.exports = mongoose.model('Room', RoomSchema);