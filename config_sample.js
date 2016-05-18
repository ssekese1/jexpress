module.exports = {
	mongo: {
		server: "localhost",
		db: "openmembers",
	},
	port: "3001",
	smtp_server: "mail.example.co.za",
	smtp_username: "myopen@example.co.za",
	smtp_password: "PASSWORD",
	password_recovery_url: 'http://openmembers.dev:3000/login/reset',
	secret: "VerySecret",
	shared_secret: "verysecret",
	url: "http://openmembers.dev:3001",
	apikey: "APIKEY",
	oauth: {
		success_uri: "http://localhost:3000/login/oauth",
		fail_uri: "http://localhost:3000/login/oauth/fail",
		facebook: {
			app_id: "12345",
			app_secret: "abc123",
			scope: "email,user_about_me,user_friends",
			auth_uri: "https://www.facebook.com/dialog/oauth",
			token_uri: "https://graph.facebook.com/v2.3/oauth/access_token",
			api_uri: "https://graph.facebook.com/me?fields=id,name,about,age_range,bio,email,picture",
		},
		twitter: {
			app_id: "12345",
			app_secret: "abc123",
			auth_uri: "https://api.twitter.com/oauth/authenticate",
			api_uri: "https://api.twitter.com/1.1/",
			token_uri: "https://api.twitter.com/oauth2/token"
		},
		google: {
			app_id: "12345",
			app_secret: "abc123",
			auth_uri: "https://accounts.google.com/o/oauth2/auth",
			scope: "email+profile",
			api_uri: "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
			token_uri: "https://www.googleapis.com/oauth2/v3/token"
		},
		linkedin: {
			app_id: "12345",
			app_secret: "abc123",
			auth_uri: "https://www.linkedin.com/uas/oauth2/authorization",
			scope: "r_basicprofile%20r_emailaddress",
			api_uri: "https://api.linkedin.com/v1/people/~:(id,num-connections,picture-url,email-address)?format=json",
			token_uri: "https://www.linkedin.com/uas/oauth2/accessToken",
			email_field: "emailAddress"
		}
	},
	websocket: {
		port: 3004
	},
	rabbitmq: {
		server: "amqp://localhost",
		queue: "openworker",
	}
};