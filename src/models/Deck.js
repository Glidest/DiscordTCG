const { SQLiteModel, now, id } = require('../database/model');
const Card = require('./Card');
const FusedCard = require('./FusedCard');

class Deck extends SQLiteModel {
    static get table() { return 'decks'; }
    static get primaryKeyColumn() { return 'id'; }
    static get columns() {
        return [
            { name: 'id', property: '_id' }, { name: 'user_id', property: 'userId' },
            { name: 'name' }, { name: 'cards' }, { name: 'active', boolean: true },
            { name: 'created_at', property: 'createdAt', date: true }, { name: 'updated_at', property: 'updatedAt', date: true }
        ];
    }
    static populate(doc) {
        doc.cards = (doc.cards || []).map(entry => {
            const Model = entry.cardType === 'FusedCard' ? FusedCard : Card;
            const row = Model._allRows().find(item => item.id === String(entry.cardId && entry.cardId._id || entry.cardId));
            return { ...entry, cardId: row ? Model._fromRow(row) : null };
        });
    }
    constructor(values = {}) {
        super({ cards: [], active: false, createdAt: now(), updatedAt: now(), ...values });
        this._id = values._id || id();
    }
    async save() { this.updatedAt = now(); return super.save(); }
}
module.exports = Deck;
