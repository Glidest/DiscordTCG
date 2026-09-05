const { SQLiteModel, now } = require('../database/model');
const Card = require('./Card');

class FusedCard extends SQLiteModel {
    static get table() { return 'fused_cards'; }
    static get primaryKeyColumn() { return 'id'; }
    static get columns() {
        return [
            { name: 'id', property: '_id' }, { name: 'name' }, { name: 'rarity' },
            { name: 'image_url', property: 'imageUrl' }, { name: 'description' },
            { name: 'set_name', property: 'set' }, { name: 'power' }, { name: 'fused_by', property: 'fusedBy' },
            { name: 'parent_cards', property: 'parentCards' }, { name: 'special', boolean: true },
            { name: 'created_at', property: 'createdAt', date: true }
        ];
    }
    static populate(doc) {
        doc.parentCards = (doc.parentCards || []).map(parent => ({
            ...parent,
            cardId: Card._fromRow(Card._allRows().find(row => row.id === String(parent.cardId && parent.cardId._id || parent.cardId)))
        }));
    }
    constructor(values = {}) {
        super({
            rarity: 'fused', imageUrl: '', description: '', set: 'Fusion',
            power: 0, parentCards: [], special: false, createdAt: now(), ...values
        });
    }
    async save() {
        if (!this._id) this._id = require('../database/model').id();
        if (!this.createdAt) this.createdAt = now();
        if (!this.parentCards || this.parentCards.length !== 2) {
            throw new Error('Fused cards must have exactly 2 parent cards');
        }
        return super.save();
    }
}
module.exports = FusedCard;
