const https = require('https');

const host = 'd698094770d0611467bece20531bd287.r2.cloudflarestorage.com';

console.log(`Connecting to ${host}...`);

const options = {
    hostname: host,
    port: 443,
    method: 'GET',
    rejectUnauthorized: false // Just to see if we get ANY response
};

const req = https.request(options, (res) => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (e) => {
    console.error('Handshake/Connection Error:', e);
});

req.end();
