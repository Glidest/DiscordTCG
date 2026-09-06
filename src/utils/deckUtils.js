const Deck = require('../models/Deck');
const UserCollection = require('../models/UserCollection');
const config = require('../config/config');

const MAX_DECK_SIZE = 5;

function normalizeName(name) {
    return name.trim().toLowerCase();
}

function getCardName(cardEntry) {
    if (!cardEntry || !cardEntry.cardId) return null;
    const prefix = cardEntry.special && config.specialPrefix ? `${config.specialPrefix} ` : '';
    return `${prefix}${cardEntry.cardId.name}`;
}

function findOwnedCard(collection, requestedName) {
    const normalized = normalizeName(requestedName);
    return collection.cards.find(entry =>
        entry.cardId &&
        entry.quantity > 0 &&
        normalizeName(getCardName(entry)) === normalized
    );
}

function findDeckCard(deck, requestedName) {
    const normalized = normalizeName(requestedName);
    return deck.cards.find(entry =>
        entry.cardId &&
        normalizeName(getCardName(entry)) === normalized
    );
}

async function getUserCollection(userId) {
    return UserCollection.findOne({ userId }).populate({
        path: 'cards.cardId',
        refPath: 'cards.cardType'
    });
}

async function getDeck(userId, name) {
    const query = { userId };
    if (name) query.name = name.trim();
    else query.active = true;

    return Deck.findOne(query).populate({
        path: 'cards.cardId',
        refPath: 'cards.cardType'
    });
}

module.exports = {
    MAX_DECK_SIZE,
    getCardName,
    findOwnedCard,
    findDeckCard,
    getUserCollection,
    getDeck
};
