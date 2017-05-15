var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Location = require('./location_model');

var LeadSchema   = new Schema({
	name: { type: String, index: true },
	organisation: String,
	location_id: { type: ObjectId, index: true, ref: "Location" },
	email: { type: String, index: true },
	mobile: String,
	date_created: { type: Date, default: Date.now },
	source: String,
	url: String,
	type: String,
});

LeadSchema.set("_perms", {
	admin: "crud",
	user: "cr",
	all: "c",
});

module.exports = mongoose.model('Lead', LeadSchema);