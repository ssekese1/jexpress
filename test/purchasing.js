process.env.NODE_ENV = 'test';

var Purchasing = require("../models/purchasing_model");

var chai = require('chai');
var chaiHttp = require('chai-http');
var should = chai.should();

var server = require("../bin/server");

var init = require("./init");

chai.use(chaiHttp);

describe('Purchasing', () => {
	before(init.init);

	beforeEach(done => {
		Purchasing.remove({}, err => {
			done();
		});
	});

	describe("/GET purchasing", () => {
		it("it should GET all the purchasings", (done) => {
			chai.request(server)
			.get("/api/purchasing")
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.a('array');
				res.body.data.length.should.be.eql(0);
				done();
			});
		});
	});

	describe("/POST purchasing", () => {
		it("it should POST a new purchasing", (done) => {
			var purchasing = {
				invoices: [ "587e168a2cb92ab79d2a2ff6", "5874db033eee17723e735f0b" ]
			};
			chai.request(server)
			.post("/api/purchasing")
			.send(purchasing)
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("date_created");
				res.body.data.should.have.property("invoices");
				res.body.data.invoices.should.be.a('array');
				done();
			});
		});
	});


});