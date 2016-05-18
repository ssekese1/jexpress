var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Mixed = mongoose.Schema.Types.Mixed;

var SpecialofferSchema   = new Schema({
	name: { type: String, unique: true, index: true, set: toLower },
	img: String,
	description: String, // Short description
	body: String, // Page body
	partner: String,
	partner_product_id: String,
	urlid: { type: String, unique: true, index: true },
	date: { type: Date, default: Date.now, required: true, index: true },
	start_date: { type: Date, default: Date.now, index: true },
	end_date: { type: Date, default: Date.now, index: true },
});

SpecialofferSchema.set("_perms", {
	admin: "crud",
	user: "cr",
	all: "cr"
});

function toLower (v) {
	return v.toLowerCase();
}

module.exports = mongoose.model('Specialoffer', SpecialofferSchema);