# Overview
A fun project to help myself search, view reviews and find source to buy cheaper boardgames. Also, chance to learn new technologies/architectures.

# Tinkering thoughts
- Boardgamegeek has a search api but it's too slow. Probably have to scrape and create my own index to control the search experience.
- Autocomplete?
- App should be very interactive, but also load fast on startup.
- 2 views for now, similar to Popcorn Time. However, the detail view is reserved for videos, reviews and retail sources.
- Convert the nodejs app to be native on Mac?
- How to do daily scrape on the diff?
- Seems to have a lot of data inside just a single boardgame object, need to split them into reasonable tables.

# Implementation

## Scrape strategy
1. Hit boardgamegeek.com at /browse/boardgame (paginated) and parse the html to get thing_id (yeah, boardgamegeek names its object "thing", not semantically helpful here...). This way, you get all the data AT THE TIME OF YOUR SCRAPE.
2. For daily update, look at /recentadditions (also paginated) for new boardgame type "thing". Compare the id to your db and then decide to insert or not.
3. Potentially have to make your 1st scrape less suspicious. Do a sleep in between?
4. Alright let's do this! Gotta catch'em by suprise. Need to get a sample board game object to design the db schema (postgres or rethink?). After your db setup, try a scrape with less than 10 pages and measure the time takes to complete. After that benchmarking, if everything is fine then just HIT it!
5. On db choice, rethink seems to be a good start since i'm not so sure of the relationship between objects now.
6. Soooo, changing ip for every new request with Tor to get around that annoying ip limit on boardgamegeek.com. However, it turns out that 14/100 requests are still 503... Are they dying everytime i crawl or are they actually analyze traffic pattern??? And estimate time to crawl 80k boardgames with 1 tor instance is 225hrs LOL. This has already taken into account ip change rate limit by Tor...

## DB Design
1. Splitting up boardgame object from boardgamegeek.com
	 + Link attr contains at least these types (how do I make use of these types in design the app?):
	 	 - boardgamecategory
		 - boardgamemechanic
		 - boardgamefamily
		 - boardgameexpansion
		 - boardgameimplementation
		 - boardgamedesigner
		 - boardgameartist
		 - boardgamepublisher
		 
## Challenges
1. Seems like boardgamegeek.com is smarter than I think. 503 on 30% of request. Tried throttling but didn't work. Assumed they have some sort of IP rate limit. Resort to using Tor for making anonimous requests. However, tor requests also seem to exit from the same IP everytime so didn't solve the problem. What if I can change Tor Exit IP for every request? Or creating multiple tor instances and some how load balance requests to them?