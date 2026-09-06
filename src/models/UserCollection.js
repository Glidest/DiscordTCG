const { SQLiteModel } = require('../database/model');
const Card = require('./Card');
const FusedCard = require('./FusedCard');

class UserCollection extends SQLiteModel {
    static get table() { return 'user_collections'; }
    static get primaryKeyColumn() { return 'user_id'; }
    static get columns() {
        return [{ name: 'user_id', property: '_id' }, { name: 'cards' }];
    }
    static populate(doc) {
        doc.cards = (doc.cards || []).map(entry => {
            const Model = entry.cardType === 'FusedCard' ? FusedCard : Card;
            const row = Model._allRows().find(item => item.id === String(entry.cardId && entry.cardId._id || entry.cardId));
            return { ...entry, cardId: row ? Model._fromRow(row) : null };
        });
    }
    constructor(values = {}) {
        super({ cards: [], ...values });
        this.userId = values.userId || values._id;
        this._id = this.userId;
    }
    static _fromRow(row, populate = false) {
        const doc = super._fromRow(row, populate);
        if (doc) { doc.userId = row.user_id; doc._id = row.user_id; }
        return doc;
    }
    static _save(doc) {
        doc._id = doc.userId || doc._id;
        super._save(doc);
    }
}
module.exports = UserCollection;
