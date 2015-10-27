"use strict";
require('babel-core').transform('code');

const bgg = require('bgg');
const util = require('util');
const rp = require('request-promise');
const cheerio = require('cheerio');
const fullScrapeURI = 'https://boardgamegeek.com/browse/boardgame';
const basePageURI = 'https://boardgamegeek.com/browse/boardgame/page/';

var boardgameIds = [];

function log(input, depth) {
		if (typeof depth === 'undefined') {
				depth = null;
		}
		console.log(util.inspect(input, {showHidden: true, depth: depth}));
}

function fetchBoardGameByPageNumber(pageNumber) {
		var options = {
				uri: pageNumber,
				baseUrl: basePageURI
		};

		return rp(options);
}

function getAllBoardGameIdsOnPage($) {
		var re = /\/boardgame\/(\d+)\//;
		
		$('.collection_objectname a').each((index, elem) => {
				let bgLink = $(elem).attr('href');
				let id = re.exec(bgLink)[1];
				
				boardgameIds.push(id);
		});

		return boardgameIds;		
}

function scrapeAllBoardGameIds() {
		console.log('getting the directory...');

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
						for (let i=0; i < 3; i++) {
								futures.push(fetchBoardGameByPageNumber(i.toString()));
						}
						return futures;
				})
				.each(function(res) {
						let $ = cheerio.load(res);
						
						getAllBoardGameIdsOnPage($);
				})
				.then(function(){
						log(boardgameIds);
				})
				.catch(function(err) {
						log(err);
				});		
}

// bgg('thing', {id: '157969', type: 'boardgame', videos: '1'})
// 		.then(function(res){
// 				log(res);
// 		});

scrapeAllBoardGameIds();


