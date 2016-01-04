var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Location = require('./location_model');

var SagetaxinvoiceSchema   = new Schema({
	id: { type: Number, index: true },
	location: { type: Objectid, index: true, ref: "Location" },
	customer_id: Number,
	customer_name: String,
	paid: Boolean,
	status: String,
	created: Date,
	modified: Date,
	date: Date,
	inclusive: Boolean,
	discount_percentage: Number,
	tax_reference: String,
	document_number: String,
	reference: String,
	message: String,
	discount: Number,
	exclusive: Number,
	tax: Number,
	rounding: Number,
	total: Number,
	postal_address: String,
	delivery_address: String,
	printed: Boolean,
	currency_id: Number,
	exchange_rate: Number,
	tax_period_id: Number,
	editable: Boolean,
	has_attachments: Boolean,
	has_notes: Boolean,
	has_anticipated_date: Boolean,
	anticipated_date: Date,
	lines: mongoose.Schema.Types.Mixed,
	sales_representative: mongoose.Schema.Types.Mixed,
	_owner_id: Objectid
});

SagetaxinvoiceSchema.set("_perms", {
	admin: "crud",
	owner: "cr",
	user: ""
});

module.exports = mongoose.model('Sagetaxinvoice', SagetaxinvoiceSchema);