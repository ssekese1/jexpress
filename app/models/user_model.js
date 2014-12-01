var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var UserSchema   = new Schema({
	name: String,
	company: String,
	email: { type: String, unique: true, index: true },
	password: String,
	admin: Boolean,
	temp_hash: String,
	_owner_id: Objectid,
});

UserSchema.set("_perms", {
	admin: "crud",
	owner: "cru",
	user: "r",
});

UserSchema.post("save", function(user) { 
	// This is a good place to put post-save logic
});

module.exports = mongoose.model('User', UserSchema);