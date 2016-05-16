var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Location = require('./location_model');

var SageAnalysisCategorySchema   = new Schema({
	id: { type: Number, index: true },
	location: { type: Objectid, index: true, ref: "Location" },
	analysis_type_id: Number,
	description: String
});

SageAnalysisCategorySchema.set("_perms", {
	admin: "crud",
	owner: "cr",
	user: ""
});

module.exports = mongoose.model('Sageanalysiscategory', SageAnalysisCategorySchema);