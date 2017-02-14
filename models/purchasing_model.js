var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Invoice = require("./invoice_model");

var PurchasingSchema   = new Schema({
	invoices: [{ type: ObjectId, ref: "Invoice" }],
	date_created: { type: Date, default: Date.now },
	date_completed: Date,
	_owner_id: ObjectId,
});

PurchasingSchema.set("_perms", {
	admin: "cru",
	owner: "cr",
	user: "c",
});

module.exports = mongoose.model('Purchasing', PurchasingSchema);