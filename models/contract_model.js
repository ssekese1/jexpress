// This model is a meta-model for everywhere we might store a potential contact

const mongoose     = require('mongoose');
const Schema       = mongoose.Schema;

const ObjectId    = mongoose.Schema.Types.ObjectId;
const User        = require("./user_model");
const Organisation = require("./organisation_model");

const ContractSchema   = new Schema({
    type: { type: String, validate: /contract|proposal/ },
    signed: Boolean,
    sent: Boolean,
    date_signed: Date,
    date_sent: Date,
    user_id: { type: ObjectId, ref: "User" },
    organisation_id: { type: ObjectId, ref: "Organisation", index: true },
    filename: String,
    reference: String,
}, {
	timestamps: true
});

ContractSchema.set("_perms", {
	admin: "cru",
});

module.exports = mongoose.model('Contract', ContractSchema);
