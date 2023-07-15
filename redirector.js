#!/usr/bin/env node
'use strict';

/* == BEGIN CONFIGURATION SECTION */

const DEBUG = false;

// Only handles one port at a time (currently).
// Only ports 80 and 443 are valid.
//
// If PORT = 443, a suitable trusted certificate its private key must be
// supplied (which can be done below).
//
// Note that this will include requiring the 'subject alternative names'
// extension in the certificate to be valid for the domains being redirected.
const HOSTNAME = '127.0.0.1';
const PORT = 443;

// Ensures POSTs are also redirected.
const STATUS_CODE = 307;

const mappings = [
	[
		// E.g. for domains of the form
		// https://github12321.com/project/repo.git[/tail]
		'^(https?)://(github12321.com)/([^/]+)/([^/]+.git/?)(.+)?$',
		(protocol, domain, project, repo, tail) => {
			return `${protocol}://github.com/${project}/${repo}${tail || ''}`;
		}
	],
	[
		// Simple redirection for all non-repo URLs
		'^(https?)://(github12321.com)/(.+)$',
		(protocol, domain, path) => {
			return `${protocol}://github.com/${path}`;
			// return `${protocol}://${domain}/${project}/${repo}`;
		},
	],
];

// These should be in PEM format.
// Only needed when using HTTPS.
// The certificate must be trusted and sign for the intended domain(s).
const KEY_PATH = null;
const CERT_PATH = null;


/* == END CONFIGURATION SECTION */

const fs = require('fs');
const http = require('http');
const https = require('https');

const protocol = {
	80: 'http',
	443: 'https',
}[PORT];

const create_server = {
	http: http.createServer,
	https: callback_fn => https.createServer({
		key: fs.readFileSync(KEY_PATH),
		cert: fs.readFileSync(CERT_PATH)
	}, callback_fn)
}[protocol];

function debug_log(msg) {
	if (DEBUG)
	{
		console.log(msg);
	}
}

function get_redirection_url(target) {
	for ( let [regex, map_fn] of mappings )
	{
		const match = target.match(regex);
		if ( !match )
		{
			debug_log(`Did not match regex of form ${regex}.`);
			continue;
		}

		match.shift();

		debug_log(`Matched regex of form ${regex}.`);
		debug_log(`Matches: ${match}`);
		return map_fn(...match);
	}

	debug_log('Did not match any regexes');
	return null;
}

function get_full_url(req)
{
	const host = req.headers.host;
	const initial_url = req.url;
	const full_url = `${protocol}://${host}${initial_url}`;
	return full_url;
}

const server = create_server(function (req, res)
{
	const full_url = get_full_url(req);
	console.log(`Intercepted request to URL ${full_url}.`);

	const new_url = get_redirection_url(full_url);

	if ( new_url !== null )
	{
		console.log(`Redirecting URL with ${STATUS_CODE} status code.`);
		console.log(`Old URL: ${full_url}`);
		console.log(`New URL: ${new_url}`);

		res.writeHead(STATUS_CODE, {
			location: new_url,
		});
	}
	else
	{
		console.log('Failed to redirect as URL not handled.');
		console.log('Returning response with 404 status code.');

		res.writeHead(404);
	}

	res.end();
});

console.log(`Listening for specific HTTP requests on ${HOSTNAME}:${PORT}.`);
console.log('(Don\'t forget to redirect such domains via /etc/hosts if needed.)');
console.log('');
console.log('Hostname regular expressions being redirected:');
for (let [index, [regex, _]] of mappings.entries())
{
	console.log(`\t${index + 1}. '${regex}'`);
}
console.log('');
console.log('Listening...');

server.listen(PORT, HOSTNAME);

