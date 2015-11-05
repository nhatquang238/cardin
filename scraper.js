// "use strict";
require('babel-core').transform('code');

const util = require('util');
const rp = require('request-promise');
const cheerio = require('cheerio');
const db = require('./lib/db');
const logger = require('debug')('scraper');
const Promise = require('bluebird');
const HTTPSAgent = require('socks5-https-client/lib/Agent');
const HTTPAgent = require('socks5-http-client/lib/Agent');
const chalk = require('chalk');
const fs = require('fs');
const randomUA = require('random-useragent');
const Nightcrawler = new require('nightcrawler');
const parser = require('xml2json');

const fullScrapeURI = 'https://boardgamegeek.com/browse/boardgame';
const basePageURI = 'https://boardgamegeek.com/browse/boardgame/page/';
const bggAPIRoots = ['https://boardgamegeek.com/xmlapi2/', 'http://www.boardgamegeek.com/xmlapi2/', 'http://wwww.rpggeek.com/xmlapi2/', 'http://www.videogamegeek.com/xmlapi2/'];
const BATCHSIZE = 1;
const nightcrawlerOpts = {
		proxy: 'http://localhost:8123',
		tor: {
				password: 'torStrong123',
				controlPort: 9051
		}
};
const nightcrawler = new Nightcrawler(nightcrawlerOpts);

var boardgames = [];
var totalMiss = 0;

function getRandomInt(min, max) {
		return Math.floor(Math.random() * (max - min)) + min;
}

function fetchBoardGameByPageNumber(pageNumber) {
		var options = {
				uri: pageNumber,
				baseUrl: basePageURI,
				agentClass: HTTPSAgent,
				agentOptions: {
						socksPort: 9050
				},
				headers: {
						'User-Agent': randomUA.getRandom()
				}
		};

		return rp(options);
}

function getAllBoardGameIdsOnPage($, boardgameIds) {
		var re = /\/boardgame\/(\d+)\//;
		
		$('.collection_objectname a').each(function (index, elem) {
				var bgLink = $(elem).attr('href');
				var id = re.exec(bgLink)[1];

				boardgameIds.push(id);
		});

		return boardgameIds;
}

function scrapeAllBoardGameIds() {
		logger('getting the directory...');

		var options = {
				uri: fullScrapeURI,
				transform: function(res) {
						return cheerio.load(res);
				}
		};

		rp(options)
				.then(function($) {
						var pagesCount = $('.infobox a[title="last page"]').html();
						pagesCount = pagesCount.replace('[', '').replace(']', '');

						// testing promise control flow
						var futures = [];
						for (var i=1; i < 2; i++) {
								futures.push(fetchBoardGameByPageNumber(i.toString()));
						}
						return futures;
				})
				.all()
				.then(function(reses) {
						logger('%s directory pages were downloaded', reses.length);
						var boardgameIds = [];
						reses.forEach(function(res) {
								var $ = cheerio.load(res);

								boardgameIds = getAllBoardGameIdsOnPage($, boardgameIds);
						});

						fs.writeFile('boardgameIds.txt', boardgameIds.join('\n'), function(err) {
								if (err) {
										logger(chalk.red('failed to write to file'));
								}

								logger(chalk.green('all boardgame ids are saved to boardgameIds.txt'));
						});

						scrape(boardgameIds);
				})
				.catch(function(err) {
						logger(err);
				});
}

function scrape(boardgameIds) {
		_scrapeCb();
		
		function _scrapeCb() {
				var batch = boardgameIds.splice(0, BATCHSIZE);
				var futures = [];
				var hitCount = 0;

				for (var i=0; i < batch.length; i++) {
						futures.push(fetchBoardGameById(batch[i]));
				}

				Promise
						.each(futures, function(val, index, length) {
								var boardgame = parseBoardgame(val);

								db.saveBoardgame(boardgame, function(err, key){
										if (!err) {
												logger('saved as %s', key);
												boardgames.push(key);
										}
								});
						})
								.then(function(res) {
										if (boardgameIds.length === 0) {
												logger('--------------------------------------');
												logger(chalk.green('%s boardgames downloaded'), boardgames.length);
										} else {
												logger('%s boardgames remaining...', boardgameIds.length);
												scrape(boardgameIds);
										}
								})
						.catch(function(err) {
								if ((typeof err.options === "undefined") || (typeof err.options.qs === "undefined") || (typeof err.options.qs.id === "undefined")) {
										logger(err);
								} else {
										var failedId = err.options.qs.id;
										
										nightcrawler.changeIp().then(function(ip) {
												logger('switching to a new ip: %s', ip);
												logger('retry %s', failedId);
												boardgameIds.unshift(failedId);
												scrape(boardgameIds);
										});
								}
						});
		}
}

function fetchBoardGameById(id) {
		var url = bggAPIRoots[getRandomInt(0, bggAPIRoots.length)];
		logger('root url: %s', url);
		var agent;
		if (url.startsWith('https')) {
				agent = HTTPSAgent;
		} else {
				agent = HTTPAgent;
		}

		return rp({
				uri: url + 'thing/',
				qs: {
						id: id,
						type: 'boardgame',
						videos: 1
				},
				agentClass: agent,
				agentOptions: {
						socksPort: 9050
				},
				headers: {
						'User-Agent': randomUA.getRandom()
				}
		});
}

function parseBoardgame(res) {
		var boardgame = JSON.parse(parser.toJson(res)).items.item;

		if (Object.prototype.toString.call(boardgame.name) === '[object Array]') {
				boardgame.name = boardgame.name[0].value || null;
		} else {
				boardgame.name = boardgame.name.value || null;
		}
		
		boardgame.maxplayers = boardgame.maxplayers.value || null;
		boardgame.maxplaytime = boardgame.maxplaytime.value || null;
		boardgame.minage = boardgame.minage.value || null;
		boardgame.minplayers = boardgame.minplayers.value || null;
		boardgame.maxplaytime = boardgame.maxplaytime.value || null;
		boardgame.playingtime = boardgame.playingtime.value || null;
		boardgame.yearpublished = boardgame.yearpublished.value || null;

		delete boardgame.id;

		return boardgame;
}

function run() {
		db.setup();
		logger("done db setup...");
		scrapeAllBoardGameIds();
}

run();

// fetchBoardGameById('110327')
// 		.then(function(res) {
// 				console.log(JSON.parse(parser.toJson(res)).items.item);
// 		});
