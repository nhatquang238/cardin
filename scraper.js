// "use strict";
require('babel-core').transform('code');

const util = require('util');
const rp = require('request-promise');
const cheerio = require('cheerio');
const db = require('./lib/db');
const logger = require('debug')('scraper');
const Promise = require('bluebird');
const Agent = require('socks5-https-client/lib/Agent');
const chalk = require('chalk');
const fs = require('fs');
const randomUA = require('random-useragent');
const Nightcrawler = new require('nightcrawler');
const parser = require('xml2json');

const fullScrapeURI = 'https://boardgamegeek.com/browse/boardgame';
const basePageURI = 'https://boardgamegeek.com/browse/boardgame/page/';
const bggAPIRoot = 'https://boardgamegeek.com/xmlapi2/';
const BATCHSIZE = 10;
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

function fetchBoardGameByPageNumber(pageNumber) {
		var options = {
				uri: pageNumber,
				baseUrl: basePageURI,
				agentClass: Agent,
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
		nightcrawler.changeIp().then(function(ip) {
				logger('switching to a new ip: %s', ip);

				_scrapeCb();
		});
		
		function _scrapeCb() {
				var batch = boardgameIds.splice(0, BATCHSIZE);
				var futures = [];
				var hitCount = 0;

				for (var i=0; i < batch.length; i++) {
						futures.push(fetchBoardGameById(batch[i]));
				}

				Promise.all(futures)
						.then(function (reses) {
								reses.forEach(function (res) {
										var boardgame = parseBoardgame(res);
										db.saveBoardgame(boardgame, function(err, key) {
												if (!err) {
														logger('saved as %s', key);
														boardgames.push(key);
														hitCount += 1;
												}
										});
								});

								if (boardgameIds.length === 0) {
										logger('--------------------------------------');
										logger(chalk.green('%s boardgames downloaded'), boardgames.length);
								} else {
										logger('%s boardgames remaining...', boardgameIds.length);
										scrape(boardgameIds);
								}
						})
						.catch(function (err) {
								totalMiss += (BATCHSIZE - hitCount);
								logger(chalk.red('missing boardgame!!! total miss is now: %s'), totalMiss);
								scrape(boardgameIds);
						});				
		}
}

function fetchBoardGameById(id) {
		return rp({
				uri: bggAPIRoot + 'thing/',
				qs: {
						id: id,
						type: 'boardgame',
						videos: 1
				},
				agentClass: Agent,
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

		boardgame.name = boardgame.name[0].value || null;
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
		scrapeAllBoardGameIds();		
}

run();
