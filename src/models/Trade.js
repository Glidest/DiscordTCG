const { SQLiteModel, now, id } = require('../database/model');
const Card = require('./Card');
const FusedCard = require('./FusedCard');

class Trade extends SQLiteModel {
    static get table() { return 'trades'; }
    static get primaryKeyColumn() { return 'trade_id'; }
    static get columns() {
        return [
            { name: 'trade_id', property: '_id' }, { name: 'status' },
            { name: 'initiator_id', property: 'initiatorId' }, { name: 'target_id', property: 'targetId' },
            { name: 'initiator_cards', property: 'initiatorCards' }, { name: 'target_cards', property: 'targetCards' },
            { name: 'created_at', property: 'createdAt', date: true }, { name: 'completed_at', property: 'completedAt', date: true },
            { name: 'cancelled_at', property: 'cancelledAt', date: true }, { name: 'cancelled_by', property: 'cancelledBy' }
        ];
    }
    static populate(doc) {
        for (const key of ['initiatorCards', 'targetCards']) {
            doc[key] = (doc[key] || []).map(entry => {
                const Model = entry.cardType === 'FusedCard' ? FusedCard : Card;
                const row = Model._allRows().find(item => item.id === String(entry.cardId && entry.cardId._id || entry.cardId));
                return { ...entry, cardId: row ? Model._fromRow(row) : entry.cardId };
            });
        }
    }
    constructor(values = {}) {
        super({
            status: 'pending', initiatorCards: [], targetCards: [],
            createdAt: now(), completedAt: null, cancelledAt: null, cancelledBy: null, ...values
        });
        this.tradeId = values.tradeId || values._id || id();
        this._id = this.tradeId;
    }
    async save() {
        if (this.status === 'completed' && !this.completedAt) this.completedAt = now();
        if (this.status === 'cancelled' && !this.cancelledAt) this.cancelledAt = now();
        this._id = this.tradeId;
        return super.save();
    }
    static _fromRow(row, populate = false) {
        const doc = super._fromRow(row, populate);
        if (doc) { doc.tradeId = row.trade_id; doc._id = row.trade_id; }
        return doc;
    }
    static _save(doc) { doc._id = doc.tradeId || doc._id; super._save(doc); }
}
module.exports = Trade;
