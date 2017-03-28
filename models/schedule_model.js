var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;
var config		= require("config");

var ObjectId = mongoose.Schema.Types.ObjectId;

var ScheduleSchema   = new Schema({
	name: String,
	description: String,
	action: String,
	due: { type: Date, index: true },
	status: { type: String, validate: /due|running|run|cancelled|failed/, index: true, default: "due" },
	last_run: Date,
	last_output: mongoose.Schema.Types.Mixed,
	repeat:  { type: String, validate: /never|minutely|hourly|daily|monthly/, index: true, default: "never" },
	created: { type: Date, default: Date.now },
});

ScheduleSchema.set("_perms", {
	super_user: "cru",
	admin: "r",
});

module.exports = mongoose.model('Schedule', ScheduleSchema);