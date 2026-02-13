const { S3Client, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: './.env' });

async function test() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    console.log(`Testing R2 with Account ID: ${accountId}`);
    console.log(`Bucket: ${bucketName}`);

    const client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        forcePathStyle: true,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });

    try {
        console.log('Listing more objects in bucket...');
        const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            MaxKeys: 100,
        });
        const listResponse = await client.send(listCommand);
        const allFiles = listResponse.Contents?.map(c => c.Key) || [];
        console.log('Total files found:', allFiles.length);
        console.log('Webm files:', allFiles.filter(f => f.endsWith('.webm')));
        console.log('Recent 5 files:', allFiles.slice(-5));

        console.log('Checking for non-existent file...');
        const command = new HeadObjectCommand({
            Bucket: bucketName,
            Key: 'non-existent-file-just-to-test-connection',
        });
        await client.send(command).catch(e => {
            if (e.name === 'NotFound') console.log('Bucket connection OK (file properly not found)');
            else throw e;
        });
    } catch (err) {
        console.error('SDK Error:', err);
    }
}

test();
