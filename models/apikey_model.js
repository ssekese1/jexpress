var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;
<<<<<<< HEAD:models/apikey_model.js
var config		= require("../config");
=======
var config		 = require("../config");
>>>>>>> 23cfebdc7a63ec8746e3ca00f144d1c85949b262:models/apikey_model.js

var Objectid = mongoose.Schema.Types.ObjectId;

var APIKeySchema   = new Schema({
	user_id: Objectid,
	apikey: String,
	created: { type: Date, default: Date.now, expires: config.apikey_lifespan || 86400 },
});

APIKeySchema.set("_perms", {
	//We can never change or view this directly
});

module.exports = mongoose.model('APIKey', APIKeySchema);