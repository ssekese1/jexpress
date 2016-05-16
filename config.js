module.exports = {
	mongo: {
		server: "localhost",
		db: "openmembers",
	},
	// model_dir: "../../../app/models/",
	port: "3001",
	smtp_server: "freespeechpub.co.za",
	smtp_username: "jason@freespeechpub.co.za",
	smtp_password: "Crazy8ts",
	password_recovery_url: 'http://openmembers.dev:3000/login/reset',
	secret: "JLsa90HASDon *&(sfd klasdjf9df0n**YT&^&$#nLIISDA...>",
	shared_secret: "verysecret",
	url: "http://openmembers.dev:3001",
	apikey: "aQMvbKoroJWVsoOT",
	oauth: {
		success_uri: "http://localhost:3000/login/oauth",
		fail_uri: "http://localhost:3000/login/oauth/fail",
		facebook: {
			app_id: "403384669863169",
			app_secret: "6d72d573251c91462918bbca107217eb",
			scope: "email,user_about_me,user_friends",
			auth_uri: "https://www.facebook.com/dialog/oauth",
			token_uri: "https://graph.facebook.com/v2.3/oauth/access_token",
			api_uri: "https://graph.facebook.com/me?fields=id,name,about,age_range,bio,email,picture",
		},
		twitter: {
			// app_id: "NjxWiALl9udu7NnLuzjfZQcwC",
			// app_secret: "r6vjD3Nmow8UQRsrDFqWHoS8hRvFk04fOL7N7H2tCvQg9ZM8YM",
			app_id: "KY5igUiihWzx97mx3fPVPWLOL",
			app_secret: "gF5XYyRtuQT7UXT1E3Bep5bTbR9jBKgNeLJBO2vxkCT545o9Oe",
			auth_uri: "https://api.twitter.com/oauth/authenticate",
			api_uri: "https://api.twitter.com/1.1/",
			token_uri: "https://api.twitter.com/oauth2/token"
		},
		google: {
			app_id: "275359815719-odm6hjjvd6aadl7h6ldb66pvsvnu3fi5.apps.googleusercontent.com",
			app_secret: "6Nkr13dyNBk8gua2FbR8WXVK",
			auth_uri: "https://accounts.google.com/o/oauth2/auth",
			scope: "email+profile",
			api_uri: "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
			token_uri: "https://www.googleapis.com/oauth2/v3/token"
		},
		linkedin: {
			app_id: "772olnrq574mvz",
			app_secret: "EZ0jgknadeBKoKTb",
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
