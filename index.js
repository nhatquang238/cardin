var bgg = require('bgg');
var util = require('util');

function log(input) {
		console.log(util.inspect(input, {showHidden: true, depth: 5}));
}

// bgg('thing', {id: '157969', type: 'boardgame', videos: '1'})
// 		.then(function(res){
// 				log(res);
// 		});

bgg('search', {query: 'Sheriff', type: 'boardgame'})
		.then(function(res) {
				log(res);
		});
