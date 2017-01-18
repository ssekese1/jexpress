process.env.NODE_ENV = 'test';

var User = require("../models/user_model");
var Location = require("../models/location_model");
var Organisation = require("../models/organisation_model");
var Apikey = require('../models/apikey_model');
var Room = require('../models/room_model');
var bcrypt = require('bcrypt');

var chai = require('chai');
var chaiHttp = require('chai-http');
var should = chai.should();

var server = require("../bin/server");

chai.use(chaiHttp);


var empty = (model) => {
	return new Promise((resolve, reject) => {
		model.remove({}, err => {
			if (err)
				return reject(err);
			return resolve();
		});
	});
};

var post = (model, data) => {
	return new Promise((resolve, reject) => {
		var item = new model(data);
		item.save((err, result) => {
			if (err)
				return reject(err);
			// console.log(result);
			return resolve(result);
		});
	});
};

var encPassword = (password) => {
	hash = bcrypt.hashSync(password, 4);
	return hash;
};

var email = "test@freespeechpub.co.za";
var password = "test";

var init = () => {
	var location = null;
	var organisation = null;
	return empty(User)
	.then(() => {
		return empty(Location);
	})
	.then(() => {
		return empty(Organisation);
	})
	.then(() => {
		return empty(Apikey);
	})
	.then(() => {
		return post(Location, { name: "Test Location" });
	})
	.then((result) => {
		location = result;
		return post(Organisation, { name: "Test Organisation", location_id: location._id });
	})
	.then((result) => {
		organisation = result;
		return post(User, { name: "Test User", email, password: encPassword(password), location_id: location._id, organisation_id: organisation._id });
	})
	.then((result) => {
		return post(Room, { name: "Test Room", location_id: location._id, cost: 1, off_peak_cost: 0.5 });
	})
	;
};

describe('Init', () => {
	beforeEach(() => {
		return init();
	});

	describe("/GET user", () => {
		it("it should GET all the users", (done) => {
			chai.request(server)
			.get("/api/user")
			.auth(email, password)
			.end((err, res) => {
				console.log(res.error);
				res.should.have.status(200);
				res.body.data.should.be.a('array');
				res.body.data.length.should.be.eql(1);
				done();
			});
		});
	});
});

module.exports = {
	init,
	email,
	password
};