var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;
var config		= require("config");

var ObjectId = mongoose.Schema.Types.ObjectId;

var ScheduleSchema   = new Schema({
	created: { type: Date, default: Date.now },
});

ScheduleSchema.set("_perms", {
	//We can never change or view this directly
});

module.exports = mongoose.model('Schedule', ScheduleSchema);