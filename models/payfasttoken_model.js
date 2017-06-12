var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var User = require("./user_model");
var Organisation = require("./organisation_model");

var PayfasttokenSchema   = new Schema({
	token: String,
	user_id: { type: ObjectId, ref: 'User' },
	organisation_id: { type: ObjectId, ref: 'Organisation' },
	date_created: { type: Date, default: Date.now },
	_owner_id: ObjectId,
	_deleted: { type: Boolean, default: false, index: true },
});

PayfasttokenSchema.set("_perms", {
	admin: "crud",
	owner: "r",
});


module.exports = mongoose.model('Payfasttoken', PayfasttokenSchema);