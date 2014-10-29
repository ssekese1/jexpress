var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var UserSchema   = new Schema({
	name: String,
	email: { type: String, unique: true, index: true },
	password: String,
	admin: Boolean,
});

UserSchema.set("_perms", {
	admin: "crud",
	owner: "crud",
	user: "r",
});

module.exports = mongoose.model('User', UserSchema);