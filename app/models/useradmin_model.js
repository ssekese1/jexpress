var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var UserAdminSchema   = new Schema({
	user_id: { type: Objectid, unique: true, index: true },
	extra_credits: Number,
	_owner_id: Objectid,
});

UserAdminSchema.set("_perms", {
	admin: "cru",
	owner: "cr",
	user: "",
});

module.exports = mongoose.model('UserAdmin', UserAdminSchema);