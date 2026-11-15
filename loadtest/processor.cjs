// Helpers for the Artillery scenarios: ids written by the seed script, picked at random per step.
const ids = require('./data/ids.json');

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const SEARCHES = ['daft punk', 'queen', 'nina simone', 'radiohead', 'stromae'];

function setIds(context, _events, done) {
	context.vars.eventId = ids.eventId;
	context.vars.playlistId = ids.playlistId;
	return done();
}

function pickStep(context, _events, done) {
	context.vars.entryId = pick(ids.entryIds);
	context.vars.trackId = pick(ids.trackIds);
	context.vars.search = pick(SEARCHES);
	context.vars.action = pick(['play', 'pause', 'next', 'prev']);
	return done();
}

module.exports = { setIds, pickStep };
