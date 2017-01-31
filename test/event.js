process.env.NODE_ENV = 'test';

var Event = require("../models/event_model");

var chai = require('chai');
var chaiHttp = require('chai-http');
var should = chai.should();

var server = require("../bin/server");

var init = require("./init");

chai.use(chaiHttp);

describe('Event', () => {
	before(init.init);

	beforeEach(done => {
		Event.remove({}, err => {
			done();
		});
	});

	describe("/GET event", () => {
		it("it should GET all the events", (done) => {
			chai.request(server)
			.get("/api/event")
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.a('array');
				res.body.data.length.should.be.eql(0);
				done();
			});
		});
	});

	describe("/POST event", () => {
		it("it should POST a new event", (done) => {
			var event = {
				name: "Test event",
				start_date: new Date(),
				end_date: new Date(),
			};
			chai.request(server)
			.post("/api/event")
			.send(event)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				// console.log(res.body);
				res.should.have.status(200);
				res.body.should.have.property("status").eql("ok");
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("name");
				res.body.data.should.have.property("start_date");
				res.body.data.should.have.property("end_date");
				done();
			});
		});
	});

});