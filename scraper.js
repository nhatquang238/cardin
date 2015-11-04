// "use strict";
require('babel-core').transform('code');

const bgg = require('bgg');
const util = require('util');
const rp = require('request-promise');
const cheerio = require('cheerio');
const db = require('./lib/db');
const logger = require('debug')('scraper');
const Promise = require('bluebird');
const Agent = require('socks5-https-client/lib/Agent');
const chalk = require('chalk');
const fs = require('fs');
const Nightcrawler = new require('nightcrawler');

const fullScrapeURI = 'https://boardgamegeek.com/browse/boardgame';
const basePageURI = 'https://boardgamegeek.com/browse/boardgame/page/';
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

function log(input, depth) {
		if (typeof depth === 'undefined') {
				depth = null;
		}
		console.log(util.inspect(input, {showHidden: true, depth: depth}));
}

function fetchBoardGameByPageNumber(pageNumber) {
		var options = {
				uri: pageNumber,
				baseUrl: basePageURI,
				agentClass: Agent,
				agentOptions: {
						socksPort: 9050
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
						log(err);
				});		
}

// db.setup();

// db.findBoardgameByName("Sheriff of Nottingham", function(err, result) {
// 		log(result.id);
// });

// db.findBoardgameById("3e6a8d79-0524-4c51-8d0a-1ed5a7a0b268", function(err, result) {
// 		log(result);
// });

// bgg('thing', {id: '157969', type: 'boardgame', videos: '1'})
// 		.then(function(res){
// 				var boardgame = res.items.item;
// 				boardgame.name = boardgame.name[0].value;
// 				boardgame.maxplayers = boardgame.maxplayers.value;
// 				boardgame.maxplaytime = boardgame.maxplaytime.value;
// 				boardgame.minage = boardgame.minage.value;
// 				boardgame.minplayers = boardgame.minplayers.value;
// 				boardgame.maxplaytime = boardgame.maxplaytime.value;
// 				boardgame.playingtime = boardgame.playingtime.value;
// 				boardgame.yearpublished = boardgame.yearpublished.value;

// 				delete boardgame.id;

// 				db.saveBoardgame(boardgame, function(err, id) {
// 						if (id) {
// 								console.log(id);
// 						}
// 				});
// 		});

function scrape(boardgameIds) {
		nightcrawler.changeIp().then(function(ip) {
				logger('switching to a new ip: %s', ip);

				_scrapeCb();
		});

		function _scrapeCb() {
				var batch = boardgameIds.splice(0, BATCHSIZE);
				var futures = [];

				for (var i=0; i < batch.length; i++) {
						futures.push(fetchBoardGameById(batch[i]));
				}

				Promise.all(futures)
						.then(function (reses) {
								reses.forEach(function (res) {
										var boardgame = res.items.item;
										boardgame.name = boardgame.name[0].value;
										boardgame.maxplayers = boardgame.maxplayers.value;
										boardgame.maxplaytime = boardgame.maxplaytime.value;
										boardgame.minage = boardgame.minage.value;
										boardgame.minplayers = boardgame.minplayers.value;
										boardgame.maxplaytime = boardgame.maxplaytime.value;
										boardgame.playingtime = boardgame.playingtime.value;
										boardgame.yearpublished = boardgame.yearpublished.value;
										
										delete boardgame.id;
										
										boardgames.push(boardgame);
								});

								if (boardgameIds.length === 0) {
										logger('--------------------------------------');
										logger('%s boardgames downloaded', boardgames.length);
								} else {
										logger('%s boardgames remaining...', boardgameIds.length);
										scrape(boardgameIds);
								}
						})
						.catch(function (err) {
								totalMiss += 1;
								logger(chalk.red('missing a boardgame!!! total miss is now: %s'), totalMiss);
								scrape(boardgameIds);
						});				
		}
}

function fetchBoardGameById(id) {
		return bgg('thing', {id: id, type: 'boardgame', videos: '1'});
}

scrapeAllBoardGameIds();
