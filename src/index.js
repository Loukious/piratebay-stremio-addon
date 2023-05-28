const Stremio = require('stremio-addons');
const magnet = require('magnet-uri');
const MongoClient = require('mongodb').MongoClient;
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const MONGO_URI = process.env.MONGO_URI || '';


const client = new MongoClient(MONGO_URI);
// Connect to MongoDB
client.connect();

// Access DB
const db = client.db(); // replace 'databaseName' with your database name

const manifest = require('./manifest');
const {
    initMongo,
    getTitle,
    search
} = require('./tools');

const builder = new addonBuilder(manifest);


builder.defineStreamHandler(async function (args) {
    try {
        if (args.type === 'movie' || args.type === 'series') {
            const idParts = args.id.split(':');
            if (idParts.length > 1) {
                const season = parseInt(idParts[1], 10);
                const episode = parseInt(idParts[2], 10);
                args["season"] = season;
                args["episode"] = episode;
                args["id"] = idParts[0]
            }
            const title = await getTitle(args);
            const results = await search({ ...title, type: args.type }) || [];
            const streams = results.map(file => {
                const { infoHash } = magnet.decode(file.magnetLink);
                const detail = `${file.name}\n💾 ${file.size} 👤 ${file.seeders}`;
                return {
                    infoHash,
                    name: 'TPB',
                    title: detail,
                    availability: 1
                };
            });
            return Promise.resolve({ streams: streams });
        } else {
            return Promise.resolve({ streams: [] });
        }
    } catch (e) {
        console.log(e);
        return Promise.reject(e);
    }
});

async function startServer() {
    try {
        await initMongo(db); // Await the initialization of the MongoDB connection
        serveHTTP(builder.getInterface(), { port: 7000 }); // Start the server
    } catch (error) {
        console.error('Error initializing MongoDB:', error);
    }
}

startServer();
