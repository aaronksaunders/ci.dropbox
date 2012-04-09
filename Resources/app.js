var dropbox = require('dropbox');
var client = dropbox.createClient({
	app_key : 'itp95shicb82fb7', // <--- you'll want to replace this
	app_secret : 'd22y6cfu9rz12vb', // <--- and this with your own keys!
	root : "dropbox"            // optional (defaults to sandbox)
});

var findPDFFiles = function() {
	var options = {
		overwrite : true, // optional
	};
	var contents = Ti.Filesystem.getFile("titanium-mobile.pdf").read();
	client.put("titanium-mobile.pdf", contents, options, function(status, reply) {
		Ti.API.info(status)
		Ti.API.info(reply);
	});
}
if(client.isAuthorized()) {
	uploadFile();
} else {
	client.login(function(options) {
		uploadFile();
	});
}
