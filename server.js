var express = require('express');
var http = require('http');
var path = require('path');
var sqlite3 = require('sqlite3').verbose();
var crypto = require('crypto');

var db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log('Connected to database.');
});

db.run('CREATE TABLE urls(long TEXT, short TEXT)');

const port = 3000;
const host = 'localhost';

var template = `<!DOCTYPE html>
<html lang="en">
    <head>
        <title>URL Shortener</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="style.css">
    </head>
    <body>
        <h1>URL Shortener</h1>
        <label>Shortened URL: </label>
        <input type="text" id='shortened' value="http://` + host + `:${port}/{{short}}/">
        <button onclick="copy()">Copy URL</button>  <!-- TODO -->
        <p>Long URL: <a href={{long}} target="_blank" rel="noopener noreferrer">{{long}}</a></p>
        <p><a href="/">Shorten another URL</a></p>
        <script>
            function copy() {
                let text = document.getElementById('shortened');
                text.select();
                navigator.clipboard.writeText(text.value);
            }
        </script>
    </body>
</html>`;

var app = express();
var server = http.Server(app);
var bodyParser = require('body-parser');
const e = require('express');

app.set('port', port);
app.use(express.static('static'));

app.use(bodyParser.urlencoded({ extended: false }))

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/shorten', function(req, res) {
    let long = req.body.url;
    let short = hash(long);
    db.get(`SELECT long long FROM urls WHERE short  = ?`, [short], (err, row) => {
        if (err) {
            return console.error(err.message);
        }
        if (!row) {
            db.run('INSERT INTO urls(long, short) VALUES("' + long + '", "' + short + '")', function(err) {
                if (err) {
                return console.log(err.message);
                }
                console.log(`Row inserted with short ${short} and long ${long}`);
            });
        } else if (row.long != long) {   // collision
            res.writeHead(409, { 'Content-Type':'text/html'});
            res.end(`<!DOCTYPE html>
            <html lang="en">
                <head>
                    <title>URL Shortener</title>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <link rel="stylesheet" href="style.css">
                </head>
                <body>
                    <h1>URL Shortener</h1>
                    <p>Sorry unable to shorten this URL.</p>
                    <p><a href="/">Shorten a URL</a></p>
                </body>
            </html>`);
            return;
        }
    });
    res.writeHead(201, {'Content-Type':'text/html'});
    let body = template.replace(/{{short}}/g, short).replace(/{{long}}/g, long);
    res.end(body);
});

app.get('/:short([a-zA-Z0-9_-]{6})', function(req, res) {
    db.get(`SELECT long long FROM urls WHERE short  = ?`, [req.params.short], (err, row) => {
        if (err) {
            return console.error(err.message);
        }
        if (row) {
            res.writeHead(301, { 'Location': row.long }).end();
        } else {
            res.sendFile(path.join(__dirname, 'invalid.html'));
        }
    });
});

app.get('*', function(req, res) {
    res.sendFile(path.join(__dirname, 'invalid.html'));
});

server.listen(port, host, function() {
    console.log(`Server running at http://` + host + `:${port}`);
});

function hash(url) {
    return crypto.createHash('sha1').update(url).digest('base64url').slice(0, 6); // use first 6 digits of SHA1 hash of URL in base64url
}