const { SQLiteModel } = require('../database/model');

class UserCredits extends SQLiteModel {
    static get table() { return 'user_credits'; }
    static get primaryKeyColumn() { return 'user_id'; }
    static get columns() {
        return [
            { name: 'user_id', property: '_id' }, { name: 'credits' },
            { name: 'last_earn_time', property: 'lastEarnTime', date: true }
        ];
    }
    constructor(values = {}) {
        super({ credits: 0, lastEarnTime: null, ...values });
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
module.exports = UserCredits;
