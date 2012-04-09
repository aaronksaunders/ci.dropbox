//
// https://github.com/sintaxi/node-dbox
//
var oauth = require("./lib/oauth")

exports.createClient = function(config) {

	var sign = oauth(config.app_key, config.app_secret)
	var root = config.root || "sandbox"
	//
	// Create Global "extend" method
	//
	var extend = function(obj, extObj) {
		if(arguments.length > 2) {
			for(var a = 1; a < arguments.length; a++) {
				extend(obj, arguments[a]);
			}
		} else {
			for(var i in extObj) {
				obj[i] = extObj[i];
			}
		}
		return obj;
	};

	var loadAccessToken = function() {
		var token, that = this;

		var raw = Ti.App.Properties.getString('DROPBOX_TOKENS', '');
		if(!raw) {
			return null;
		}

		try {
			token = JSON.parse(raw);
		} catch (err) {
			Ti.API.error('Failed to parse stored access token for DROPBOX_TOKENS !');
			Ti.API.error(err);
			return null;
		}

		if(token.accessToken) {
			that.accessToken = token.accessToken;
		}
		if(token.accessTokenSecret) {
			that.accessTokenSecret = token.accessTokenSecret;
		}

		return token;
	};
	var saveAccessToken = function() {
		Ti.App.Properties.setString('DROPBOX_TOKENS', JSON.stringify({
			accessToken : this.accessToken,
			accessTokenSecret : this.accessTokenSecret
		}));
	};
	var clearAccessToken = function(pService) {
		Ti.App.Properties.setString('DROPBOX_TOKENS', null);
		this.accessToken = null;
		this.accessTokenSecret = null;
	};

	var request = function(args, callback) {
		var client = Ti.Network.createHTTPClient({
			onsendstream : function(e) {
				Ti.API.info('ONSENDSTREAM - PROGRESS: ' + e.progress);
			},
			onload : function() {
				if(client.status == 200) {
					Ti.API.info(this.responseText);
				} else {
					Ti.API.info(this.responseText);
				}
				callback(null, this, this.responseText);
			},
			onerror : function() {
				Ti.API.error(' FAILED to send a request!');
				Ti.API.info(this.responseText);
			}
		});

		client.open(args.method, args.url);
		if(Ti.Platform.osname === 'iphone') {
			client.setRequestHeader("Content-Type", args.headers);
		}
		if(args.method === 'PUT') {

			client.send(args.body);
		} else {
			client.send(JSON.parse(args.body));
		}
	}

	return {
		// will tell if the consumer is authorized
		isAuthorized : function() {
			var that = this;
			loadAccessToken.call(that);
			return !(this.accessToken == null || this.accessTokenSecret == null);
		},

		login : function(callback) {
			var that = this;

			that.request_token(function(status, reply) {
				Ti.API.info(status);
				Ti.API.info(reply);

				var authorizeUICallback = function(e) {

					if(e.url.indexOf('&oauth_token') != -1) {
						var tokens = e.url.split("&");
						ACCESS_TOKEN_SECRET = tokens[1].split("=")[1];

						destroyAuthorizeUI();
						var options = {
							oauth_token : reply.oauth_token, // required
							oauth_token_secret : reply.oauth_token_secret,  // required
						};

						// get access
						that.access_token(options, function(status, reply) {
							Ti.API.info(status);
							Ti.API.info(reply);

							that.accessToken = reply.oauth_token;
							that.accessTokenSecret = reply.oauth_token_secret;

							// save so we don't login everytime
							saveAccessToken.call(that);

							// callback on success
							callback(reply);
						});
						return;

					} else if('https://www.dropbox.com/' === e.url) {
						destroyAuthorizeUI();
						return;
					} else if(e.url.indexOf('#error=access_denied') != -1) {
						destroyAuthorizeUI();
						return;
					}
				}
				// unloads the UI used to have the user authorize the application
				var destroyAuthorizeUI = function() {
					// if the window doesn't exist, exit
					if(window == null)
						return;

					// remove the UI
					try {
						wv.removeEventListener('load', authorizeUICallback);
						window.close();
						loading = null;
						wv = null;
						window = null;
					} catch (ex) {
						Ti.API.debug('Cannot destroy the authorize UI. Ignoring.');
					}
				};

				var wv = Ti.UI.createWebView({
					url : 'https://www.dropbox.com/1/oauth/authorize?oauth_token=' + reply.oauth_token + '&oauth_callback=http://www.clearlyinnovative.com/oAuth.html'
				});
				wv.addEventListener('load', authorizeUICallback);
				var window = Ti.UI.createWindow({
					backgroundColor : 'transparent'
				});

				window.add(wv);
				window.open();
			});
		},

		request_token : function(cb) {
			var signature = sign({})
			var args = {
				"method" : "POST",
				"headers" : {
					"content-type" : "application/x-www-form-urlencoded"
				},
				"url" : "https://api.dropbox.com/1/oauth/request_token",
				"body" : JSON.stringify(signature)
			}
			request(args, function(e, r, b) {
				var obj = {}
				b.split("&").forEach(function(kv) {
					var kv = kv.split("=")
					obj[kv[0]] = kv[1]
				})
				cb(r.status, obj)
			})
		},
		build_authorize_url : function(oauth_token, oauth_callback) {
			var url = "https://www.dropbox.com/1/oauth/authorize?oauth_token=" + oauth_token;
			if(oauth_callback) {
				url = url + "&oauth_callback=" + oauth_callback;
			}
			return url;
		},
		access_token : function(options, cb) {
			var params = sign(options)
			var args = {
				"method" : "POST",
				"headers" : {
					"content-type" : "application/x-www-form-urlencoded"
				},
				"url" : "https://api.dropbox.com/1/oauth/access_token",
				"body" : JSON.stringify(params)
			}
			request(args, function(e, r, b) {
				var obj = {}
				b.split("&").forEach(function(kv) {
					var kv = kv.split("=")
					obj[kv[0]] = kv[1]
				})
				cb(r.status, obj)
			})
		},

		account : function(options, cb) {

			// ensure we have the tokens
			options = extend(options, {
				oauth_token : this.accessToken,
				oauth_token_secret : this.accessTokenSecret
			});

			var params = sign(options)
			var args = {
				"method" : "POST",
				"headers" : {
					"content-type" : "application/x-www-form-urlencoded"
				},
				"url" : "https://api.dropbox.com/1/account/info",
				"body" : JSON.stringify(params)
			}
			request(args, function(e, r, b) {
				cb(r.status, JSON.parse(b))
			})
		},

		put : function(path, body, options, cb) {

			// ensure we have the tokens
			options = extend(options, {
				oauth_token : this.accessToken,
				oauth_token_secret : this.accessTokenSecret
			});

			var params = sign(options)
			var urlX = "";
			for(var a in params) {
				urlX += Titanium.Network.encodeURIComponent(a) + '=' + Titanium.Network.encodeURIComponent(params[a]) + '&';
			}

			var args = {
				"method" : "PUT",
				"headers" : {
					"content-length" : body.length
				},
				"url" : "https://api-content.dropbox.com/1/files_put/" + (params.root || root) + "/" + escape(path) + "?" + urlX,
				"body" : body
			}
			request(args, function(e, r, b) {
				cb(r.status, JSON.parse(b))
			})
		},

		search : function(path, query, options, cb) {

			// ensure we have the tokens
			options = extend(options, {
				oauth_token : this.accessToken,
				oauth_token_secret : this.accessTokenSecret
			});

			var params = sign(options)
			params["query"] = query

			var body = JSON.stringify(params)
			var args = {
				"method" : "POST",
				"headers" : {
					"content-type" : "application/x-www-form-urlencoded",
					"content-length" : body.length
				},
				"url" : "https://api.dropbox.com/1/search/" + (params.root || root) + "/" + escape(path),
				"body" : body
			}
			request(args, function(e, r, b) {
				cb(r.status, JSON.parse(b))
			})
		},
	}
}