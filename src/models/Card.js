const { SQLiteModel, now } = require('../database/model');

const CARD_TYPES = {
    BLOOD: 'Blood', MIND: 'Mind', TIME: 'Time', TECH: 'Tech',
    ARCANE: 'Arcane', NECROTIC: 'Necrotic', DEITY: 'Deity'
};
const TYPE_STRENGTHS = {
    Blood: { strong: ['Mind'], weak: ['Necrotic'] },
    Mind: { strong: ['Time'], weak: ['Blood'] },
    Time: { strong: ['Tech'], weak: ['Mind'] },
    Tech: { strong: ['Arcane'], weak: ['Time'] },
    Arcane: { strong: ['Necrotic'], weak: ['Tech'] },
    Necrotic: { strong: ['Blood'], weak: ['Arcane'] },
    Deity: { strong: ['Blood', 'Mind', 'Time', 'Tech', 'Arcane', 'Necrotic'], weak: ['Deity'] }
};

class Card extends SQLiteModel {
    static get table() { return 'cards'; }
    static get primaryKeyColumn() { return 'id'; }
    static get columns() {
        return [
            { name: 'id', property: '_id' }, { name: 'name' }, { name: 'description' },
            { name: 'rarity' }, { name: 'type' }, { name: 'set_name', property: 'set' },
            { name: 'image_url', property: 'imageUrl' }, { name: 'special', boolean: true },
            { name: 'power' }
        ];
    }
    static getTypeEffectiveness(attackerType, defenderType) {
        if (!TYPE_STRENGTHS[attackerType] || !TYPE_STRENGTHS[defenderType]) throw new Error('Invalid card type');
        if (attackerType === CARD_TYPES.DEITY) return defenderType === CARD_TYPES.DEITY ? 'weak' : 'strong';
        if (TYPE_STRENGTHS[attackerType].strong.includes(defenderType)) return 'strong';
        if (TYPE_STRENGTHS[attackerType].weak.includes(defenderType)) return 'weak';
        return 'neutral';
    }
    constructor(values = {}) {
        super({
            description: '', rarity: 'common', type: null, set: 'Base Set',
            imageUrl: '', special: false, power: 0, ...values
        });
    }
    static _save(doc) {
        const validRarities = ['common', 'uncommon', 'rare', 'legendary', 'deity', 'fused'];
        if (!validRarities.includes(doc.rarity)) {
            throw new Error(`Invalid card rarity: ${doc.rarity}`);
        }
        if (!Object.values(CARD_TYPES).includes(doc.type)) {
            throw new Error(`Invalid card type: ${doc.type}`);
        }
        if ((doc.rarity === 'deity') !== (doc.type === CARD_TYPES.DEITY)) {
            throw new Error('Deity cards must use deity rarity and type together');
        }
        if (!Number.isFinite(doc.power) || doc.power < 0) {
            throw new Error('Card power must be a non-negative number');
        }
        super._save(doc);
    }
}
Card.CARD_TYPES = CARD_TYPES;
Card.TYPE_STRENGTHS = TYPE_STRENGTHS;
module.exports = Card;
module.exports.Card = Card;
module.exports.CARD_TYPES = CARD_TYPES;
module.exports.TYPE_STRENGTHS = TYPE_STRENGTHS;
