var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Organisation = require("./organisation_model");
var SageItem = require("./sageitem_model");
var SageAnalysisCategory = require("./sageanalysiscategory_model");

var LineItemSchema   = new Schema({
	description: String,
	organisation_id: { type: Objectid, ref: 'Organisation' },
	item: { type: Objectid, ref: 'SageItem' },
	amount: { type: Number, validate: function(v) { return (v > 0); }, required: true },
	price: { type: Number, validate: function(v) { return (v >= 0); }, required: true },
	tax_type: String,
	comment: String,
	discount: { type: Number, default: 0 },
	date_created: { type: Date, default: Date.now },
	sage_id: Number,
	is_quote: Boolean,
	analysiscategory: { type: Objectid, ref: 'SageAnalysisCategory' },
	_owner_id: Objectid,
	_deleted: { type: Boolean, default: false, index: true },
});

LineItemSchema.set("_perms", {
	admin: "crud",
	owner: "cr",
	user: "",
	all: ""
});


module.exports = mongoose.model('LineItem', LineItemSchema);