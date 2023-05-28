const localUrl = 'http://localhost:7000/stremioget/stremio/v1';
const productionUrl = 'https://piratebay-stremio-addon.herokuapp.com/stremio/v1';
process.env.ENV = 'dev';
const url = process.env.ENV === 'dev' ? localUrl : productionUrl;
const version = process.env.ENV === 'dev' ? '1.3.0-local' : '1.3.0';
const id = process.env.ENV === 'dev' ? 'org.stremio.piratebay.local' : 'org.stremio.piratebay';

module.exports = {
	"id": id,
	"version": version,
	"name": "PirateBay Addon",
	"description": "Fetch PirateBay entries on a single episode or series.",
	"catalogs": [],
	'endpoint': url,
	"resources": [
		{
			"name": "stream",
			"types": [
				"movie",
				"series"
			],
			"idPrefixes": [
				"tt",
				"kitsu"
			]
		}
	],
	"types": [
		"movie",
		"series",
		"anime",
		"other"
	],
	"background": "https://web.archive.org/web/20190702062730if_/http://wallpapercraze.com/images/wallpapers/thepiratebay-77708.jpeg",
	"logo": "https://d2.alternativeto.net/dist/icons/thepiratebay_60782.png?width=128&height=128&mode=crop&upscale=false",
	"behaviorHints": {
		"configurable": false,
		"configurationRequired": false
	}
};