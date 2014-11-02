var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var UserSchema   = new Schema({
	name: String,
	email: { type: String, unique: true, index: true },
	password: String,
	admin: Boolean,
	space_total: Number, //Debit + Credit
	space_reserve: Number,
	space_debit: Number,
	space_credit: Number,
	stuff_total: Number, //Debit + Credit
	stuff_reserve: Number,
	stuff_debit: Number,
	stuff_credit: Number,
});

UserSchema.set("_perms", {
	admin: "crud",
	owner: "crud",
	user: "r",
});

module.exports = mongoose.model('User', UserSchema);