var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Location = require('./location_model');
var Organisation = require("./organisation_model");

var InvoiceSchema   = new Schema({
	invoice_id: { type: String, index: true },
	invoice_number: String,
	organisation_id: { type: ObjectId, index: true, ref: "Organisation" },
	location: { type: ObjectId, index: true, ref: "Location" },
	date: Date,
	due_date: Date,
	sent: Boolean,
	status: String,
	sub_total: Number,
	total: Number,
	discount: Number,
	tax: Number,
	date_created: { type: Date, default: Date.now },
	line_items: [ mongoose.Schema.Types.Mixed ],
	paypal_id: { type: String, index: true },
	_owner_id: ObjectId
});

InvoiceSchema.set("_perms", {
	admin: "crud",
	owner: "cr",
	user: ""
});

module.exports = mongoose.model('Invoice', InvoiceSchema);