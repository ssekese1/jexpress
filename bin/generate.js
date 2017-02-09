process.env.NODE_ENV = 'test';
var config = require('config');
var mongoose = require("mongoose");
var Chance = require("chance");
var async = require("async");
var Xero = require("xero");

var params = {
	locations: 2,
	organisations: 50,
	users: 200,
	memberships: 3,
	xero: {
		private_key: `-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQDiGbVuHcYELNHUw5iZ0ug40VZ4sM0gOM0/DyWdg4sCXAJ3lJHp
MApXCm/cqSVctKkKT/kutRMA6fo4IJ/RFhoAZGt7y1G4lX2U1lciF5/ZQ+f2UfO7
3BxpYRQuRYptq3M/1S75R/m6KCSYUgw8mRyMawZyB5qdiCcp9xXYRuuTeQIDAQAB
AoGBANF29dF1PdziVObi6j4f2UnCDnUzfmXKmcNA2h1KH39pFFQKTP8WpY2ruqRY
A6gWKsDGBFkUIe3n1gsnlkfTTPOvjJsbe3xzIlkomGcel+PemF3dWpAbxUWrM7Vt
gb0C5vwrBTOsjWV1s/oi9dYjVvZM3X85m98oVZJUHuvrjTD9AkEA/wHKTIxvwooy
aoAK+Lz+e70P887rMJg57kz3URuI48a7m7K60d2Qm/P3RmupNwL4oLdarwGF4kdk
y6YjV5nhRwJBAOL7Gi8xDnUslUv8qxMrLl/nJgL3U5AqwvqauGgOH+d2JTyr37x9
fn3AR2z3uGTqgstrMXmMh0bd23v5INGDRT8CQQDcnjTiEyHhgeRqRUq4tfHJJeF2
Qk8xpJGB/G5/aj39KgNHidKdHH4unlwRPbWRFW36xYacH8ov4SpwEdVDxaqjAkBy
O7u+2mqTUB/HQV974zSQsY1w2rakjNDaPPnn7Ivj+pLdCQcuHt6FPTr1PWsA5wFy
jP02ViJS6R8oMoZwyycTAkBw/IaKpV7t4fGhet//Y6KlDpfzgqdcxXUF8+UhLYeP
OBx+tYwl9aDd+3uSEK7oJMBYrTaEDdTJOBGIvnKrOqvW
-----END RSA PRIVATE KEY-----`,
		consumer_key : "J6RVYLAZKQQZULHDVBQYAEWQCNVMG7", 
		consumer_secret : "NCPMGZHJ4ZMKV3C1JRLSBG5VCNPYWJ"
	}
};


String.prototype.ucfirst = function() {
	return this.charAt(0).toUpperCase() + this.slice(1);
};

//DB connection
mongoose.connect('mongodb://' + config.mongo.server + '/' + config.mongo.db, function(err) {
	if (err) {
		console.log("Connection error", err);
	}
}, { db: { safe:true } }); // connect to our database

var xero = new Xero(params.xero.consumer_key, params.xero.consumer_secret, params.xero.private_key);

var User = require("../models/user_model");
var Location = require("../models/location_model");
var Organisation = require("../models/organisation_model");
var Apikey = require('../models/apikey_model');
var Room = require('../models/room_model');
var License = require('../models/license_model');
var Membership = require('../models/membership_model');
var XeroAccount = require('../models/xeroaccount_model');
var Mailtemplate = require('../models/mailtemplate_model');
var bcrypt = require('bcrypt');

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

var put = (model, id, data) => {
	return new Promise((resolve, reject) => {
		model.findOne(id, (err, item) => {
			for (var i in data) {
				item[i] = data[i];
			}
			item.save((err, result) => {
				if (err)
					return reject(err);
				// console.log(result);
				return resolve(result);
			});
		});
	});
};

var getAll = model => {
	return new Promise((resolve, reject) => {
		model.find((err, data) => {
			if (err)
				return reject(err);
			resolve(data);
		});
	});
};

var get = (model, filter) => {
	return new Promise((resolve, reject) => {
		model.find(filter).exec((err, data) => {
			if (err)
				return reject(err);
			resolve(data);
		});
	});
};

var encPassword = (password) => {
	hash = bcrypt.hashSync(password, 4);
	return hash;
};

var user_account = {
	name: "Test User",
	email: "user@10layer.com",
	password: "test",
};

var admin_account = {
	name: "Test Admin",
	email: "admin@10layer.com",
	password: "test",
	admin: true
};

var adjectives = ["adamant", "adroit", "amatory", "animistic", "antic", "arcadian", "baleful", "bellicose", "bilious", "boorish", "calamitous", "caustic", "cerulean", "comely", "concomitant", "contumacious", "corpulent", "crapulous", "defamatory", "didactic", "dilatory", "dowdy", "efficacious", "effulgent", "egregious", "endemic", "equanimous", "execrable", "fastidious", "feckless", "fecund", "friable", "fulsome", "garrulous", "guileless", "gustatory", "heuristic", "histrionic", "hubristic", "incendiary", "insidious", "insolent", "intransigent", "inveterate", "invidious", "irksome", "jejune", "jocular", "judicious", "lachrymose", "limpid", "loquacious", "luminous", "mannered", "mendacious", "meretricious", "minatory", "mordant", "munificent", "nefarious", "noxious", "obtuse", "parsimonious", "pendulous", "pernicious", "pervasive", "petulant", "platitudinous", "precipitate", "propitious", "puckish", "querulous", "quiescent", "rebarbative", "recalcitant", "redolent", "rhadamanthine", "risible", "ruminative", "sagacious", "salubrious", "sartorial", "sclerotic", "serpentine", "spasmodic", "strident", "taciturn", "tenacious", "tremulous", "trenchant", "turbulent", "turgid", "ubiquitous", "uxorious", "verdant", "voluble", "voracious", "wheedling", "withering", "zealous"];
var nouns = ["ninja", "chair", "pancake", "statue", "unicorn", "rainbows", "laser", "senor", "bunny", "captain", "nibblets", "cupcake", "carrot", "gnomes", "glitter", "potato", "salad", "toejam", "curtains", "beets", "toilet", "exorcism", "stick figures", "mermaid eggs", "sea barnacles", "dragons", "jellybeans", "snakes", "dolls", "bushes", "cookies", "apples", "ice cream", "ukulele", "kazoo", "banjo", "opera singer", "circus", "trampoline", "carousel", "carnival", "locomotive", "hot air balloon", "praying mantis", "animator", "artisan", "artist", "colorist", "inker", "coppersmith", "director", "designer", "flatter", "stylist", "leadman", "limner", "make-up artist", "model", "musician", "penciller", "producer", "scenographer", "set decorator", "silversmith", "teacher", "auto mechanic", "beader", "bobbin boy", "clerk of the chapel", "filling station attendant", "foreman", "maintenance engineering", "mechanic", "miller", "moldmaker", "panel beater", "patternmaker", "plant operator", "plumber", "sawfiler", "shop foreman", "soaper", "stationary engineer", "wheelwright", "woodworkers"];

var mailtemplates = [{ "urlid" : "initial-quote", "name" : "Initial Quote", "subject" : "Quote for lease at [location.name]", "body" : "<p>Hi there,</p>\r\n<p>Please find a quote&nbsp;for [organisation.name] to join [location.name] attached.&nbsp;</p>\r\n<p>To accept or reject&nbsp;this quotation, please visit&nbsp;<a href=\"[base_url]/quote/view/[invoice._id]\">[base_url]/quote/view/[invoice._id]</a>.</p>\r\n<p>If you have any queries, please do not hesitate to contact me.</p>\r\n<p>Sincerely,<br />[location.community_manager_name]</p>\r\n<p>&nbsp;</p>" },
{ "urlid" : "generic", "name" : "Generic", "subject" : "My.OPEN", "body" : "<p>[body]</p>\r\n<p>Kind regards,<br /><a href=\"[base_url]\">My.OPEN</a></p>" },
{ "urlid" : "invoice", "name" : "Invoice", "subject" : "Invoice from [location.name]", "body" : "<p>Hi there,</p>\r\n<p>Please find your invoice&nbsp;for&nbsp;[location.name] attached.&nbsp;</p>\r\n<p>To view this invoice online, please visit&nbsp;<a href=\"[base_url]/invoice/view/[invoice._id]\">[base_url]/invoice/view/[invoice._id]</a>.</p>\r\n<p>To access your My Account section on MY OPEN visit <a href=\"[base_url]/member/account\" target=\"_blank\">[base_url]/member/account</a>.</p>\r\n<h3>Remittance Advice</h3>\r\n<p>{{#inArray organisation.allowed_payments \"monthly-eft\"}}</p>\r\n<h4>Monthly EFT</h4>\r\n<p>Please ensure that your account is paid by EFT by the end of the month, and email proof of payment to {{location.community_manager_email}}.</p>\r\n<p>Please use {{organisation.urlid}} as the reference.</p>\r\n<div class=\"page\" title=\"Page 1\">\r\n<div class=\"layoutArea\">\r\n<div class=\"column\">\r\n<p>First National Bank (253305)<br />Cheque Account<br /> Account Number {{location.bank_account}}<br />{{/inArray}}</p>\r\n<p>{{#inArray organisation.allowed_payments \"credit-card\"}}</p>\r\n<h4>Credit Card</h4>\r\n<p><a href=\"[base_url]/payment/creditcard/invoice/[invoice._id]\">Please pay this invoice by credit card</a>.<br />{{/inArray}}</p>\r\n<p>{{#inArray organisation.allowed_payments \"paypal\"}}</p>\r\n<h4>Paypal</h4>\r\n<p><a href=\"[base_url]/payment/paypal/invoice/[invoice._id]\">Please pay this invoice by Paypal</a>.<br />{{/inArray}}</p>\r\n<p>{{#inArray organisation.allowed_payments \"upfront-eft\"}}</p>\r\n<h4>Upfront EFT</h4>\r\n<p>Please pay this account upfront by EFT. Please send proof of payment to&nbsp;{{location.community_manager_email}}.</p>\r\n<div class=\"page\" title=\"Page 1\">\r\n<div class=\"layoutArea\">\r\n<div class=\"column\">\r\n<p>Please use {{invoice.invoice_number}} as the reference.</p>\r\n<p>First National Bank (253305)<br />Cheque Account<br />Account Number {{location.bank_account}}</p>\r\n</div>\r\n</div>\r\n</div>\r\n<p>{{/inArray}}</p>\r\n<p>{{#inArray organisation.allowed_payments \"debit-order\"}}</p>\r\n<h4>Debit Order</h4>\r\n<p>We will debit your account on the 25th for the full amount owing on that date. Please ensure there are funds in the account to cover the debit order, and if you believe there might be a problem, please inform me&nbsp;by the 24th to make a payment arrangement.</p>\r\n<p>{{/inArray}}</p>\r\n</div>\r\n</div>\r\n</div>\r\n<p>If you have any queries, please do not hesitate to contact me.</p>\r\n<p>Sincerely,<br />[location.community_manager_name]</p>\r\n<p>&nbsp;</p>" },
{ "urlid" : "quote-accepted", "name" : "Quote Accepted", "subject" : "Quote accepted from [organisation.name]", "body" : "<p>Hi Admin</p>\r\n<p>The organisation <a href=\"[base_url]/admin/edit/organisation/[organisation._id]\">[organisation.name]</a>&nbsp;has just accepted a quote.&nbsp;</p>\r\n<p>We have sent the invoice to [organisation.accounts_email].</p>\r\n<p>Their allowed payment options are:</p>\r\n<p>{{#organisation.allowed_payments}}</p>\r\n<p>{{this}}</p>\r\n<p>{{/organisation.allowed_payments}}</p>" },
{ "urlid" : "receipt", "name" : "Receipt", "subject" : "Tax receipt from [location.name]", "body" : "<p>Hi there,</p>\r\n<p>Thank you for paying your invoice for [location.name].&nbsp;</p>\r\n<p>Please find a tax receipt attached.</p>\r\n<p>If you have any queries, please do not hesitate to contact me.</p>\r\n<p>Sincerely,<br />[location.community_manager_name]</p>\r\n<p>&nbsp;</p>" },
{ "urlid" : "quote-1", "name" : "Quote", "subject" : "Quote from OPEN", "body" : "<p>Hi there,</p>\r\n<p>Please find a quote&nbsp;for [organisation.name] to join [location.name] attached.&nbsp;</p>\r\n<p>To accept or reject&nbsp;this quotation, please visit&nbsp;<a href=\"[base_url]/quote/view/[invoice._id]\">[base_url]/quote/view/[invoice._id]</a>.</p>\r\n<p>If you have any queries, please do not hesitate to contact me.</p>\r\n<p>Sincerely,<br />[location.community_manager_name]</p>" },
{ "urlid" : "member-details", "name" : "Member Details", "subject" : "Your My.OPEN details", "body" : "<h3>Hi {{#if user.name}}{{user.name}}{{else}}there{{/if}}</h3>\r\n<p>Please find your membership details for {{user.location_id.name}} below.</p>\r\n<p>{{#if data.password}}</p>\r\n<p><strong>Your login details:</strong><br /> Username: {{user.email}}<br /> Password: {{data.password}}</p>\r\n<p>{{/if}} {{#if data.token}}</p>\r\n<p><a style=\"background-color: #428bca; border-color: #357ebd; color: white; padding: 10px 16px; margin: 10px 0px; display: inline-block; text-decoration: none; font-size: 1em;\" href=\"{{base_url}}/login/jwt/direct/{{data.token}}\">Log in now</a><br /> <em>This link will expire in two days</em></p>\r\n<p>{{/if}} {{#if data.radius}}</p>\r\n<p><strong>Your Wifi details</strong><br /> Username: {{data.radius.radius_username}}<br /> Password: {{data.radius.radius_password}}</p>\r\n<p>{{/if}} {{#if data.pin}}</p>\r\n<p><strong>Your Printing details</strong><br /> Printing PIN: {{decrypt data.pin}}</p>\r\n<p>{{/if}}</p>\r\n<p>My.OPEN is YOUR space. It's where the members can hang out, meet and network.</p>\r\n<p>It's also where you can keep track of your spending of the OPEN currencies.</p>\r\n<p>We have two types of currency - STUFF and SPACE.</p>\r\n<p>Use STUFF credits to buy coffees and food at our bar and to print.</p>\r\n<p>Use SPACE credits to book meeting rooms and event spaces.</p>\r\n<p>You can also keep your profile up-to-date here, and we suggest you do, because other OPEN members will be checking you out and wanting to do business with you.</p>\r\n<p>Welcome to the family,<br /> <a href=\"{{base_url}}\">My.OPEN</a></p>" },
{ "urlid" : "welcome", "name" : "Welcome", "subject" : "Welcome to My.OPEN", "body" : "<h3>Hi {{#if user.name}}{{user.name}}{{else}}there{{/if}}</h3>\r\n<p>Great news - you've been approved and can immediately start using <a href=\"{{base_url}}{{#if data.token}}/login/jwt/{{data.token}}{{/if}}\">My.OPEN</a>.</p>\r\n<p>{{#if data.password}}</p>\r\n<p><strong>Your login details:</strong><br /> Username: {{user.email}}<br /> Password: {{data.password}}</p>\r\n<p>{{/if}} {{#if data.token}}</p>\r\n<p><a style=\"background-color: #428bca; border-color: #357ebd; color: white; padding: 10px 16px; margin: 10px 0px; display: inline-block; text-decoration: none; font-size: 1em;\" href=\"{{base_url}}/login/jwt/{{data.token}}\">Log in now</a><br /> <em>This link will expire in two days</em></p>\r\n<p>{{/if}} {{#if data.radius}}</p>\r\n<p><strong>Your Wifi details</strong><br /> Username: {{data.radius.radius_username}}<br /> Password: {{data.radius.radius_password}}</p>\r\n<p>{{/if}} {{#if data.pin}}</p>\r\n<p><strong>Your Printing details</strong><br /> Printing PIN: {{decrypt data.pin}}</p>\r\n<p>{{/if}}</p>\r\n<p>My.OPEN is YOUR space. It's where the members can hang out, meet and network.</p>\r\n<p>It's also where you can keep track of your spending of the OPEN currencies.</p>\r\n<p>We have two types of currency - STUFF and SPACE.</p>\r\n<p>Use STUFF credits to buy coffees and food at our bar and to print.</p>\r\n<p>Use SPACE credits to book meeting rooms and event spaces.</p>\r\n<p>You can also keep your profile up-to-date here, and we suggest you do, because other OPEN members will be checking you out and wanting to do business with you.</p>\r\n<p>After you've set up your account using the link above, you can go to My.OPEN whenever you want by visiting {{base_url}}.</p>\r\n<p>Welcome to the family,<br /> <a href=\"{{base_url}}\">My.OPEN</a></p>" },
{ "urlid" : "booking-invite", "name" : "Booking Invite", "subject" : "OPEN Appointment at [location.name]", "body" : "<p>Hi there</p>\r\n<p>{{{body}}}</p>\r\n<p>Regards,<br />My OPEN</p>" },
{ "urlid" : "recover-password", "name" : "Recover Password", "subject" : "My.OPEN Password Reset", "body" : "<p>Hi there</p>\r\n<p>Somebody (hopefully you) has requested a password reset for My.OPEN.co.za. If you did not request this, it is safe to ignore this email.</p>\r\n<p><a style=\"background-color: #428bca; border-color: #357ebd; color: white; padding: 10px 16px; margin: 10px 0px; display: inline-block; text-decoration: none; font-size: 1em;\" href=\"{{base_url}}/login/jwt/{{data.token}}\">Log in now</a><br /> <em>This link will expire in two days</em></p>\r\n<p>If you have any questions, please contact us by replying to this email.</p>" }];

function randomEl(list) {
	var i = Math.floor(Math.random() * list.length);
	return list[i];
}

function ToSeoUrl(url) {
	// make the url lowercase         
	var encodedUrl = url.toString().toLowerCase();
	// replace & with and           
	encodedUrl = encodedUrl.split(/\&+/).join("-and-");
	// remove invalid characters 
	encodedUrl = encodedUrl.split(/[^a-z0-9]/).join("-");
	// remove duplicates 
	encodedUrl = encodedUrl.split(/-+/).join("-");
	// trim leading & trailing characters 
	encodedUrl = encodedUrl.trim('-');
	return encodedUrl; 
}

var chance = new Chance();

var membershipId = 1;
var createMembership = () => {
	var cost = chance.integer({ min: 100, max: 10000});
	var membership = {
		name: "Membership " + membershipId++,
		cost, 
		cost_extra_member: Math.round(cost / 2)
	};
	var queue = [];
	var createSingleMembership = (location) => {
		return cb => {
			membership.location_id = location._id;
			post(Membership, membership)
			.then(result => {
				cb(null, result);
			}, err => {
				cb(err);
			});
		};
	};
	
	var createXeroItem = (membership) => {
		var item = {
			Code: ToSeoUrl(membership.name),
			Name: membership.name,
			IsSold: true,
			IsPurchased: false,
			Description: "Membership for OPEN",
			SalesDetails: {
				UnitPrice: membership.cost,
				AccountCode: 200,
			}
		};
		return xeroCall("POST", "/Items", item);
	};
	var xero_itemid = null;
	return createXeroItem(membership)
	.then(result => {
		membership.xero_account = "200";
		membership.xero_itemid = result.Response.Items.Item.Code;
		return getAll(Location);
	})
	.then(result => {
		result.forEach(location => {
			queue.push(createSingleMembership(location));
		});
		return new Promise((resolve, reject) => {
			async.series(queue, (err, result) => {
				if (err)
					return reject(err);
				return resolve(result);
			});
		});
	});
};

var genName = () => {
	return randomEl(adjectives).ucfirst() + " " + randomEl(nouns).ucfirst();
};

var xeroCall = (method, endpoint, data) => {
	return new Promise((resolve, reject) => {
		xero.call(method, endpoint, data, (err, result) => {
			if (err) {
				return reject(err);
			}
			resolve(result);
		});
	});
};

var _formatAddress = (addressType, address) => {
	var result = {
		AddressType: addressType
	};
	if (!address)
		return result;
	var parts = address.split("\n");
	for (var x = 1; x <= parts.length; x++) {
		result["AddressLine" + x] = parts[x - 1];
	}
	return result;
};

var createOrganisation = (name) => {
	name = name || genName();
	return getAll(Location)
	.then(result => {
		var location = randomEl(result);
		return post(Organisation, { 
			name, 
			short_name: name, 
			email: chance.email(), 
			tel: chance.phone(), 
			address: chance.address(), 
			postal_address: chance.address(),
			location_id: location._id,
			status: "active",
			accounts_email: chance.email(),
			website: chance.url(),
			legal_name: name + " Pty (Ltd)",
			allowed_payments: [ "paypal", "credit-card", "monthly-eft" ],
			urlid: ToSeoUrl(name)
		});
	})
	.then(result => {
		var organisation = result;
		var contact = {
			ContactNumber: organisation.url_id,
			ContactStatus: "ACTIVE",
			IsCustomer: true,
			DefaultCurrency: "ZAR",
			Name: organisation.name,
			EmailAddress: organisation.accounts_email || organisation.email,
			Website: organisation.website,
			TaxNumber: organisation.vat,
			Addresses: [
				_formatAddress("STREET", organisation.address),
				_formatAddress("POBOX", organisation.address),
			],
			Phones: [ 
				{
					PhoneType: "DEFAULT",
					PhoneNumber: organisation.tel,
					PhoneCountryCode: "27"
				},
				{
					PhoneType: "MOBILE",
					PhoneNumber: organisation.mobile,
					PhoneCountryCode: "27"
				}
			]
		};
		return xeroCall("POST", "/Contacts", contact);
	})
	.then(result => {
		return put(Organisation, result._id, { xero_id: result.Response.Contacts.Contact.ContactID });
	});
};

var licenseUser = (user) => {
	return get(Membership, { location_id: user.location_id })
	.then(result => {
		var membership = randomEl(result);
		return post(License, {
			organisation_id: user.organisation_id,
			membership_id: membership._id,
			location_id: user.location_id,
			user_id: user._id
		});
	});
};

var createUser = () => {
	var organisation = null;
	return getAll(Organisation)
	.then(result => {
		organisation = randomEl(result);
		var name = chance.name();
		return post(User, {
			name,
			email: chance.email(),
			password: encPassword("password"),
			location_id: organisation.location_id,
			organisation_id: organisation._id,
			status: "active",
			urlid: ToSeoUrl(name)
		});
	})
	.then(result => {
		return licenseUser(result);
	})
	.then(result => {
		if (!organisation.user_id) {
			return put(Organisation, organisation._id, { user_id: result.user_id });
		}
		return result;
	});
};

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
		return empty(Membership);
	})
	.then(() => {
		return empty(XeroAccount);
	})
	.then(() => {
		return empty(Mailtemplate);
	})
	.then(() => {
		return empty(License);
	});
};

var createLocations = () => {
	var newLocation = cb => {
		var city = chance.city();
		post(Location, { 
			name: city, 
			city, 
			address: chance.address(),
			email: chance.email(),
			community_manager_name: chance.name(),
			community_manager_email: chance.email(),
			community_manager_tel: chance.phone()
		})
		.then(result => {
			console.log("Created Location", result.name);
			return post(XeroAccount, { 
				location_id: result._id, 
				consumer_key : params.xero.consumer_key, 
				consumer_secret : params.xero.consumer_secret,
			});
		})
		.then(result => {
			cb(null, result);
		}, err => {
			cb(err);
		});
	};
	var queue = [];
	for(var x = 0; x < params.locations; x++) {
		queue.push(newLocation);
	}
	return new Promise((resolve, reject) => {
		async.series(queue, (err, result) => {
			if (err)
				return reject(err);
			return resolve(result);
		});
	});
};

var createOrganisations = () => {
	var newOrganisation = name => {
		return cb => {
			createOrganisation(name)
			.then(result => {
				console.log("Created Organisation", name);
				cb(null, result);
			}, err => {
				cb(err);
			});
		};
	};
	var queue = [];
	var names = chance.unique(genName, params.organisations);
	for(var x = 0; x < params.organisations; x++) {
		queue.push(newOrganisation(names[x]));
	}
	return new Promise((resolve, reject) => {
		async.series(queue, (err, result) => {
			if (err)
				return reject(err);
			return resolve(result);
		});
	});
};

var createMemberships = () => {
	var newMembership = cb => {
		createMembership()
		.then(result => {
			console.log("Created Membership", result[0].name);
			cb(null, result);
		}, err => {
			cb(err);
		});
	};
	var queue = [];
	for(var x = 0; x < params.memberships; x++) {
		queue.push(newMembership);
	}
	return new Promise((resolve, reject) => {
		async.series(queue, (err, result) => {
			if (err)
				return reject(err);
			return resolve(result);
		});
	});
};

var createUsers = () => {
	var newUser = cb => {
		createUser()
		.then(result => {
			console.log("Created User", result.user_id);
			cb(null, result);
		}, err => {
			cb(err);
		});
	};
	var queue = [];
	for(var x = 0; x < params.users; x++) {
		queue.push(newUser);
	}
	return new Promise((resolve, reject) => {
		async.series(queue, (err, result) => {
			if (err)
				return reject(err);
			return resolve(result);
		});
	});
};

createAdminUser = () => {
	return createOrganisation("OPEN")
	.then(result => {
		console.log("Admin username: admin@open.co.za");
		console.log("Admin password: password");
		return post(User, {
			name: "Admin",
			email: "admin@open.co.za",
			password: encPassword("password"),
			location_id: result.location_id,
			organisation_id: result._id,
			status: "active",
			admin: true,
			urlid: "admin"
		})
		.then(result => {
			return post(Apikey, {
				apikey: config.apikey,
				user_id: result._id
			});
		});
	});
};

createMailtemplates = () => {
	var queue = mailtemplates.map(mailtemplate => {
		return cb => {
			post(Mailtemplate, mailtemplate)
			.then(result => {
				cb(null, result);
			}, err => {
				cb(err);
			});
		};
	});
	return new Promise((resolve, reject) => {
		async.series(queue, (err, result) => {
			if (err)
				return reject(err);
			return resolve(result);
		});
	});
};

init()
.then(result => {
	console.log("Created empty DB");
	return createLocations();
})
.then(result => {
	return createMemberships();
})
.then(result => {
	return createOrganisations();
})
.then(result => {
	return createUsers();
})
.then(result => {
	return createMailtemplates();
})
.then(result => {
	return createAdminUser();
})
.catch(err => {
	console.error(err);
})
.then(() => {
	process.exit();
});