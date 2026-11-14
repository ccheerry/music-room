// Reads the token of the latest mail sent to EMAIL from Mailpit.
var found = json(
	http.get(MAILPIT_URL + '/api/v1/search?query=' + encodeURIComponent('to:' + EMAIL)).body,
);
var mail = json(http.get(MAILPIT_URL + '/api/v1/message/' + found.messages[0].ID).body);
output.token = mail.Text.match(/token=([\w-]+)/)[1];
