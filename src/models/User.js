const { SQLiteModel, now } = require('../database/model');

class User extends SQLiteModel {
    static get table() { return 'users'; }
    static get primaryKeyColumn() { return 'user_id'; }
    static get columns() {
        return [
            { name: 'user_id', property: '_id' }, { name: 'username' },
            { name: 'last_daily', property: 'lastDaily', date: true }, { name: 'xp' },
            { name: 'level' }, { name: 'last_xp_gain', property: 'lastXpGain', date: true }
        ];
    }
    constructor(values = {}) {
        super({ xp: 0, level: 1, lastDaily: null, lastXpGain: now(), ...values });
        this.userId = values.userId || values._id || this.userId;
        this._id = this.userId;
    }
    getXpForNextLevel() { return Math.floor(50 * Math.pow(1.15, this.level - 1)); }
    async addXp(amount) {
        return require('../utils/cardUtils').addExperience(this, amount);
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
module.exports = User;
