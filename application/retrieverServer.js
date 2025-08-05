// Variables needed to run the server, which I shouldn't share
require('dotenv').config();

// Libraries needed
const http = require('http');
const express = require('express');
const fs = require('fs');

// Set the API url as a variable
const URL = 'https://api.intra.42.fr/v2';

// Set the URI as a variable
const URI = `https://${process.env.domain}:8443`;
//const URI = `https://${process.env.domain}`;

// Fetch access token needed for further data requests
function getToken(code)
{
	// Send request with ID and KEY
	return (fetch
	(
		'https://api.intra.42.fr/oauth/token',
		{
			method:
				'POST',

			headers:
			{
				'Content-Type': 'application/json',
			},

			body: JSON.stringify
			({
				grant_type: 'authorization_code',
				client_id: process.env.id,
				client_secret: process.env.secret,
				code: code,
				redirect_uri: `${URI}/`
			}),
		}
	)

	// Check response
	.then (response =>
	{
		if (!response.ok)
		{
			// Retry upon being rate limited
			if (response.status === 429)
				return (getToken(code));

			// Return an error if anything else is wrong
			throw (Object.assign(new Error(`HTTP: Status: ${response.status}`), {status: response.status}));
		}

		// Return data
		return (response.json());
	})

	// Extract access token
	.then (data =>
		data.access_token)

	// Handle errors
	.catch (error =>
	{
		console.error('Access token post request:', error.message);
		throw (error);
	}));
}

// Fetch data from a given user
function getData(token, url)
{
	// Send request using token
	return (fetch
	(
		url,
		{
			headers:
			{
				Authorization: `Bearer ${token}`,
			},
		}
	)

	// Check response
	.then (response =>
	{
		if (!response.ok)
		{
			// Retry upon being rate limited
			if (response.status === 429)
				return (getData(token, url));

			// Return an error if anything else is wrong
			throw (Object.assign(new Error(`HTTP: Status: ${response.status}`), {status: response.status}));
		}

		// Return data
		return (response.json());
	})

	// Handle errors
	.catch (error =>
	{
		console.error('Fetching user data:', error.message);
		throw (error);
	}));
}

// Fetch the campus ID
function getCampus(data)
{
	const campus = data.campus[0]?.id;
	if (!campus)
		throw (new Error('Could not resolve your campus'));

	return (campus);
}

// Fetch Campus data by page
function getOnCampus(token, campus, page)
{
	// Promise for delay
	return (new Promise(resolve =>
	{
		// Send request using token with campus ID and page number
		fetch
		(
			`${URL}/campus/${campus}/users?page[size]=100&page[number]=${page}`,
			{
				headers:
				{
					Authorization: `Bearer ${token}`,
				},
			}
		)

		// Check response
		.then (response =>
		{
			if (!response.ok)
			{
				// Retry upon being rate limited
				if (response.status === 429)
					return (getOnCampus(token, campus, page)
						.then (resolve));

				// Return an error if anything else is wrong
				else
					throw (Object.assign(new Error(`HTTP: Status: ${response.status}`), {status: response.status}));
			}
	
			// Return data
			return (response.json());
		})

		// Resolve the promise
		.then (data =>
			resolve(data))

		// Handle errors
		.catch (error =>
		{
			console.error(`Failed to retrieve page ${page}: ${error.message}`);
			resolve(error);
		});
	}));
}

// Fetch all campus data
function getAllOnCampus(token, campus, userCount)
{
	// Seriously, their API is really slow...
	console.log('Working...');

	// Calculate how many pages we will need to fetch
	const pageLast = Math.ceil(userCount / 100);
	const promises = [];

	// Fetch data page by page concurrently
	for (let page = 1; page <= pageLast; page++)
		promises.push(getOnCampus(token, campus, page));

	// Return all pages of user data
	return (Promise.all(promises)

	// Revert back into workable type
	.then (pages =>
		pages.flat()
	)

	// Handle errors
	.catch (error =>
	{
		console.error('Fetching user pages:', error.message);
		throw (error);
	}));
}

// Sort by cluster
function formatter(campusUserData)
{
	let A1 = [];
	let A2 = [];
	
	let Shi = [];
	let Fu = [];
	let Mi = [];

	// Filter on cluster
	campusUserData.forEach(user =>
	{
		// The '?' here checks if user exists before checking their location, which I find pretty neat :)
		if (!user?.location);

		// Sort locations
		else
		{
			// Check if user has a profile picture and replace it with a default one if they do not
			if (!user.image.versions.micro)
				user.image.versions.micro = `${URI}/default_profile_picture.jpg`

			// Sort Antwerp
			if (user.location[1] === '1')
				A1.push(user);
			else if (user.location[1] === '2')
				A2.push(user);
	
			// Sort Brussels
			else if (user.location[0] === 's')
				Shi.push(user);
			else if (user.location[0] === 'f')
				Fu.push(user);
			else if (user.location[0] === 'm')
				Mi.push(user);
		}
	});

	// Return array of data seperated into clusters
	return ({A1, A2, Shi, Fu, Mi});
}

// Handle user requests through browser
function handleRequest(request, response)
{
	let token;
	let campus;

	// Fetch access token
	getToken(request.query.code)

	// Fetch own user data
	.then (gotToken =>
	{
		token = gotToken;

		return (getData(token, `${URL}/me`));
	})

	// Extract campus ID
	.then (data =>
	{
		return (getCampus(data));
	})

	// Fetch campus data
	.then (campusID =>
	{
		campus = campusID;

		return (getData(token, `${URL}/campus/${campus}`));
	})

	// Fetch user count of campus
	.then (campusData =>
	{
		return (campusData.users_count);
	})

	// Fetch all campus data
	.then (userCount =>
	{
		return (getAllOnCampus(token, campus, userCount));
	})

	// Cluster sort
	.then (campusUserData =>
	{
		return (formatter(campusUserData));
	})

	// Send data to website and to the log
	.then (({A1, A2, Shi, Fu, Mi}) =>
	{
		// Add a little bit of markup to make it look nicer
		const FORMATTER = user => `<div style="display: flex; align-items: center;"><a href="https://profile.intra.42.fr/users/${user.login}" style="text-decoration: none; color: inherit;"><img src="${user.image.versions.micro}" alt="Profile picture" style="margin-right: 5px;" /></a><p style="font-family: 'Roboto', sans-serif; font-size: 12px;">${user.displayname} (${user.login}@${user.location})</p></div>`;

		// Run the formatter on all the users in a cluster
		const A1Formatted = A1.map(FORMATTER).join('');
		const A2Formatted = A2.map(FORMATTER).join('');
		const ShiFormatted = Shi.map(FORMATTER).join('');
		const FuFormatted = Fu.map(FORMATTER).join('');
		const MiFormatted = Mi.map(FORMATTER).join('');

		// Send the marked-up data to the website
		response.send
		(`
			<html>
				<head>
					<link rel="icon" type="image/x-icon" href="/favicon.ico">
					<title>Retriever</title>
				</head>
				<body>
					<h2>Successfully Retrieved Data</h2>
					<h3>On campus:</h3>
					<h4>A1 (<span>${A1.length}</span>)</h4>
					<pre>${A1Formatted}</pre><br>
					<h4>A2 (<span>${A2.length}</span>)</h4>
					<pre>${A2Formatted}</pre><br>
					<h4>Shi (<span>${Shi.length}</span>)</h4>
					<pre>${ShiFormatted}</pre><br>
					<h4>Fu (<span>${Fu.length}</span>)</h4>
					<pre>${FuFormatted}</pre><br>
					<h4>Mi (<span>${Mi.length}</span>)</h4>
					<pre>${MiFormatted}</pre>
				</body>
			</html>
		`);

		console.log('Success.');
	})

	// Handle errors
	.catch (error =>
	{
		response.status(error.status).send(`Internal Server ${error}`);
	});
}

// Setup the app
const app = express();

// Send images to server
app.use(express.static('images'));

// Create http, listen on high port for incoming requests from Docker container over proxy, establish https using Nginx reverse proxy + Docker's SSL
http.createServer(app).listen(8443, () =>
{
	console.log(`Listening to other Docker container`);
});

// Setup the request handler
app.get('/', handleRequest);
