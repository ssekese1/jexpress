var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var RunningtotalSchema   = new Schema({
	user_id: { type: Objectid, index: true },
	last_transaction_date: { type: Date, default: Date.now },
	space_total: Number, //Debit + Credit
	space_reserved: Number,
	space_debit: Number,
	space_credit: Number,
	stuff_total: Number, //Debit + Credit
	stuff_reserved: Number,
	stuff_debit: Number,
	stuff_credit: Number,
	_owner_id: Objectid
});

RunningtotalSchema.set("_perms", {
	admin: "cr",
	owner: "r",
});

module.exports = mongoose.model('Runningtotal', RunningtotalSchema);