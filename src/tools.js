const Stremio = require('stremio-addons');
const {
	IMDb,
	Movie
} = require('imdb');
const torrentStream = require('torrent-stream');
const parseVideo = require('video-name-parser');
const _ = require('lodash');
const PirateBay = require('thepiratebayfixed');
const {
	isEmpty,
	not,
	pipe,
	pathOr,
	equals,
	flatten,
	cond,
	prop,
	filter,
	sort,
	ifElse
} = require('ramda');
const nameToImdb = require('name-to-imdb');
const ONE_DAY = 86400;
let cache;

const initMongo = async (db) => {
	await db.collection('cache').createIndex({
		createdAt: 1
	}, {
		expireAfterSeconds: ONE_DAY
	});

	await db.collection('cache').createIndex({
		id: 1
	});

	cache = db.collection('cache');
};

const titleToImdb = name => new Promise((resolve, rejected) =>
	nameToImdb({
		name
	}, (err, res) => {
		if (err) {
			rejected(new Error(err.message));
		}
		resolve(res);
	}));

const cinemeta = id => {
	const client = new Stremio.Client();
	client.add('http://cinemeta.strem.io/stremioget/stremio/v1');

	return new Promise((resolve, rejected) => {
		client.meta.get({
			query: {
				id
			}
		}, function (err, meta) {
			if (err) {
				rejected(new Error(err.message));
			}
			resolve(meta);
		});
	});
};

const padNumber = pipe(
	n => n.toString() || '',
	s => s.padStart(2, '0'));

const imdbIdToName = async ({
	id,
	season = 0,
	episode = 0
}) => {
	try {
		const i = new IMDb();
		const movie = await i.getMovie(id);
		return {
			name: `${movie.getTitle()} S${padNumber(season)}E${padNumber(episode)}`,
			nameComplete: `${movie.getTitle()} S${padNumber(season)} complete`
		};
	} catch (error) {
		throw new Error(error.message);
	}
};

const checkType = type => pipe(
	prop('type'),
	equals(type));

const getTitle = cond([
	[checkType('movie'), query => ({
		name: query.id
	})],
	[checkType('series'), imdbIdToName],
]);

const torrentStreamEngine = magnetLink => {
	return new Promise(function (resolve, reject) {
		const engine = new torrentStream(magnetLink, {
			connections: 30
		});
		engine.ready(() => {
			resolve(engine);
		});
	});
};

const getMetaDataByName = async name => {
	const meta = {
		name: '',
		poster: '',
		banner: '',
		genre: '',
		imdbRating: 0,
		description: '',
		year: 2018,
		overview: '',
		thumbnail: 'https://lh3.googleusercontent.com/-wTZicECGczgV7jZnLHtnCqVbCn1a3dVll7fp4uAaJOBuF47Lh97yTR_96odCvpzYCn9VsFUKA=w128-h128-e365'
	};

	try {
		const video = await parseVideo(name);
		const id = await titleToImdb(video.name);
		const metaData = await cinemeta(id);

		meta.banner = _.get(metaData, 'background') || _.get(metaData, 'fanart.showbackground[0].url');
		meta.poster = _.get(metaData, 'background') || _.get(metaData, 'fanart.showbackground[0].url');
		meta.genre = _.get(metaData, 'genre') || '';
		meta.imdbRating = _.get(metaData, 'imdbRating') || '';
		meta.description = _.get(metaData, 'description') || '';
		meta.overview = _.get(metaData, 'description') || '';
		meta.thumbnail = _.get(metaData, 'logo') || meta.thumbnail;
		meta.year = _.get(metaData, 'year');
		meta.name = video.name || '';
		return meta;
	} catch (e) {
		return meta;
	}
};

const isFull = pipe(
	pathOr([], ['results']),
	isEmpty,
	not);

const ptbSearch = async (query, isCompleteSeason = false) => {
	const cachedResults = await cache.findOne({
		id: query
	}, {
		'fields': {
			'_id': 0,
			'results': 1
		}
	});
	
	if (isFull(cachedResults))
		return pathOr([], ['results'], cachedResults);
	const ptbResults = await PirateBay.search(query, {
		orderBy: 'seeds',
		sortBy: 'desc',
		category: 'video'
	});
	//@TODO
	if (isCompleteSeason) {
		await ptbResults.results.map(async (file) => {
			const {
				torrent
			} = await torrentStreamEngine(file.magnetLink);
			// console.log(torrent.files);
		})
	}
	const updatedResults = await cache.findOneAndUpdate(
		{ id: query },
		{
		  $set: {
			results: ptbResults.slice(0, 4)
		  },
		  $setOnInsert: {
			id: query,
			createdAt: new Date()
		  }
		},
		{
		  returnDocument: "after",
		  upsert: true
		}
	  );
	const results = updatedResults['value'];
	return pathOr([], ['results'], results);
};

const serializeResults = ifElse(
	isEmpty,
	() => [],
	pipe(
		flatten,
		filter(file => file.seeders > 0),
		sort((a, b) => b.seeders > a.seeders)))


const search = cond([
	[checkType('series'), async (title) => {
		const res = await Promise.all([ptbSearch(title.name)]); // @TODO: , ptbSearch(title.nameComplete, true)
		return serializeResults(res);
	}
	],
	[checkType('movie'), async (title) => {
		const res = await ptbSearch(title.name);
		return serializeResults(res);
	}
	]
]);

module.exports = {
	initMongo,
	getTitle,
	search
};
