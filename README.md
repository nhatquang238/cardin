# Overview
A fun project to help myself search, view reviews and find source to buy cheaper boardgames. Also, chance to learn new technologies/architectures.

# Tinkering thoughts
- Boardgamegeek has a search api but it's too slow. Probably have to scrape and create my own index to control the search experience.
- Autocomplete?
- App should be very interactive, but also load fast on startup.
- 2 views for now, similar to Popcorn Time. However, the detail view is reserved for videos, reviews and retail sources.
- Convert the nodejs app to be native on Mac?
- How to do daily scrape on the diff?

# Implementation

## Scrape strategy
1. Hit boardgamegeek.com at /browse/boardgame (paginated) and parse the html to get thing_id (yeah, boardgamegeek names its object "thing", not semantically helpful here...). This way, you get all the data AT THE TIME OF YOUR SCRAPE.
2. For daily update, look at /recentadditions (also paginated) for new boardgame type "thing". Compare the id to your db and then decide to insert or not.
3. Potentially have to make your 1st scrape less suspicious. Do a sleep in between?
4. Alright let's do this! Gotta catch'em by suprise. Need to get a sample board game object to design the db schema (postgres or rethink?). After your db setup, try a scrape with less than 10 pages and measure the time takes to complete. After that benchmarking, if everything is fine then just HIT it!
5. On db choice, rethink seems to be a good start since i'm not so sure of the relationship between objects now. 