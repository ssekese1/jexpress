process.env.NODE_ENV = 'test';

var Ledger = require("../models/ledger_model");
var User = require("../models/user_model");

var chai = require('chai');
var chaiHttp = require('chai-http');
var should = chai.should();

var server = require("../bin/server");

var init = require("./init");

chai.use(chaiHttp);

describe('Ledger', () => {
	before(init.init);

	before(done => {
		Ledger.remove({}, err => {
			done();
		});
	});

	describe("/GET ledger", () => {
		it("it should GET all the ledgers", (done) => {
			chai.request(server)
			.get("/api/ledger")
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.a('array');
				res.body.data.length.should.be.eql(0);
				done();
			});
		});
	});

	describe("/POST ledger", () => {
		it("it should POST a new ledger", (done) => {
			var ledger = {
				user_id: init.user_account._id, 
				amount: 10, 
				description: "Post Test", 
				cred_type: "stuff"
			};
			chai.request(server)
			.post("/api/ledger")
			.send(ledger)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("date");
				res.body.data.should.have.property("amount");
				res.body.data.amount.should.equal(10);
				done();
			});
		});
	});

	describe("/POST ledger - Credit and Debit", () => {
		it("it should add 10 credits", (done) => {
			var ledger = {
				user_id: init.user_account._id, 
				amount: 10, 
				description: "Post Test", 
				cred_type: "stuff"
			};
			chai.request(server)
			.post("/api/ledger")
			.send(ledger)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("date");
				res.body.data.should.have.property("amount");
				res.body.data.amount.should.equal(10);
				done();
			});
		});
		it("it should subtract 10 credits", (done) => {
			var ledger = {
				user_id: init.user_account._id, 
				amount: -10, 
				description: "Post Test", 
				cred_type: "stuff"
			};
			chai.request(server)
			.post("/api/ledger")
			.send(ledger)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("date");
				res.body.data.should.have.property("amount");
				res.body.data.amount.should.equal(-10);
				done();
			});
		});
		it("it should NOT subtract 100 credits", (done) => {
			var ledger = {
				user_id: init.user_account._id, 
				amount: -100, 
				description: "Post Test", 
				cred_type: "stuff"
			};
			chai.request(server)
			.post("/api/ledger")
			.send(ledger)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(500);
				done();
			});
		});
	});

	describe("/POST ledger - Reserve", () => {
		var reserve_id = null;
		it("it should add 10 credits", (done) => {
			var ledger = {
				user_id: init.user_account._id, 
				amount: 10, 
				description: "Post Test", 
				cred_type: "stuff"
			};
			chai.request(server)
			.post("/api/ledger")
			.send(ledger)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("date");
				res.body.data.should.have.property("amount");
				res.body.data.amount.should.equal(10);
				done();
			});
		});
		it("it should subtract 10 RESERVE credits", (done) => {
			var ledger = {
				user_id: init.user_account._id, 
				amount: -10, 
				description: "Post Test", 
				cred_type: "stuff",
				reserve: true
			};
			chai.request(server)
			.post("/api/ledger")
			.send(ledger)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("date");
				res.body.data.should.have.property("amount");
				res.body.data.amount.should.equal(-10);
				res.body.data.transaction_type.should.equal("reserve");
				reserve_id = res.body.data._id;
				done();
			});
		});
		it("it should convert reserve to debit", (done) => {
			var reserve = {
				_id: reserve_id, 
			};
			chai.request(server)
			.post("/call/ledger/confirm_reserve")
			.send(reserve)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.be.an('object');
				res.body.reserve.should.equal(false);
				res.body.transaction_type.should.equal("debit");
				done();
			});
		});
		it("it should NOT convert to reserve if already a reserve", (done) => {
			var reserve = {
				_id: reserve_id, 
			};
			chai.request(server)
			.post("/call/ledger/confirm_reserve")
			.send(reserve)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(500);
				done();
			});
		});
	});

	describe("/POST ledger - Normal user", () => {
		it("should NOT add 10 credits", (done) => {
			var ledger = {
				user_id: init.user_account._id, 
				amount: 10, 
				description: "Post Test", 
				cred_type: "stuff"
			};
			chai.request(server)
			.post("/api/ledger")
			.send(ledger)
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(500);
				done();
			});
		});
		it("should subtract 10 credits", (done) => {
			var ledger = {
				user_id: init.user_account._id, 
				amount: -10,
				description: "Post Test",
				cred_type: "stuff"
			};
			chai.request(server)
			.post("/api/ledger")
			.send(ledger)
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("date");
				res.body.data.should.have.property("amount");
				res.body.data.amount.should.equal(-10);
				done();
			});
		});
		it("admin should add 10 credits", (done) => {
			var ledger = {
				user_id: init.admin_account._id, 
				amount: 10, 
				description: "Post Test", 
				cred_type: "stuff"
			};
			chai.request(server)
			.post("/api/ledger")
			.send(ledger)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("date");
				res.body.data.should.have.property("amount");
				res.body.data.amount.should.equal(10);
				done();
			});
		});
		it("should NOT subtract 10 credits off of someone else's account", (done) => {
			var ledger = {
				user_id: init.admin_account._id, 
				amount: -10, 
				description: "Post Test", 
				cred_type: "stuff"
			};
			chai.request(server)
			.post("/api/ledger")
			.send(ledger)
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(500);
				done();
			});
		});
	});

	describe("/POST ledger - Transfer", () => {
		it("should add 10 credits to user", (done) => {
			var ledger = {
				user_id: init.user_account._id, 
				amount: 15, 
				description: "Transfer Test", 
				cred_type: "stuff"
			};
			chai.request(server)
			.post("/api/ledger")
			.send(ledger)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("date");
				res.body.data.should.have.property("amount");
				res.body.data.amount.should.equal(15);
				done();
			});
		});
		it("should transfer 5 credits to admin", done => {
			var transfer = {
				sender: init.user_account._id,
				recipient: init.admin_account._id,
				amount: 5, 
				description: "Transfer Test", 
				cred_type: "stuff"
			};
			chai.request(server)
			.post("/call/ledger/transfer")
			.send(transfer)
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.debit.should.be.an('object');
				res.body.credit.should.be.an('object');
				res.body.debit.amount.should.equal(-5);
				res.body.credit.amount.should.equal(5);
				done();
			});
		});
		it("should transfer 5 credits to admin by admin", done => {
			var transfer = {
				sender: init.user_account._id,
				recipient: init.admin_account._id,
				amount: 5, 
				description: "Transfer Test", 
				cred_type: "stuff"
			};
			chai.request(server)
			.post("/call/ledger/transfer")
			.send(transfer)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.debit.should.be.an('object');
				res.body.credit.should.be.an('object');
				res.body.debit.amount.should.equal(-5);
				res.body.credit.amount.should.equal(5);
				done();
			});
		});
		it("should NOT transfer 5 credits from admin by user", done => {
			var transfer = {
				sender: init.admin_account._id,
				recipient: init.user_account._id,
				amount: 5, 
				description: "Transfer Test", 
				cred_type: "stuff"
			};
			chai.request(server)
			.post("/call/ledger/transfer")
			.send(transfer)
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(500);
				done();
			});
		});
	});

});