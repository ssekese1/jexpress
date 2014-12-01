module.exports = {
	mongo_server: "localhost",
	mongo_db: "jexpress",
	port: "3001",
	apikey_lifespan: 60 * 60 * 24,
	secret: "totally#ecret",
	smtp_server: "your.mail.server",
	smtp_username: "you@your.mail.server",
	smtp_password: "password",
	smtp_from: "Administrator <you@your.mail.server>",
	password_recovery_url: "http://localhost:3000/login/reset",
}