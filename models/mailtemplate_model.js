var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var MailtemplateSchema   = new Schema({
	name: String,
	subject: String,
	body: String,
	_version: { type: Number, default: 0 },
	_deleted: { type: Boolean, default: false, index: true },
});

MailtemplateSchema.set("_perms", {
	admin: "crud",
	user: "r",
	all: "r"
});

module.exports = mongoose.model('Mailtemplate', MailtemplateSchema);