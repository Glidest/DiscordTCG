const { SQLiteModel, now, id } = require('../database/model');

class Battle extends SQLiteModel {
    static get table() { return 'battles'; }
    static get primaryKeyColumn() { return 'id'; }
    static get columns() {
        return [
            { name: 'id', property: '_id' }, { name: 'challenger_id', property: 'challengerId' },
            { name: 'defender_id', property: 'defenderId' }, { name: 'challenger_card_id', property: 'challengerCardId' },
            { name: 'defender_card_id', property: 'defenderCardId' }, { name: 'status' }, { name: 'rounds' },
            { name: 'current_round', property: 'currentRound' }, { name: 'challenger_wins', property: 'challengerWins' },
            { name: 'defender_wins', property: 'defenderWins' }, { name: 'winner_id', property: 'winnerId' },
            { name: 'created_at', property: 'createdAt', date: true }
        ];
    }
    constructor(values = {}) {
        super({
            status: 'pending', rounds: [], currentRound: 1, challengerWins: 0,
            defenderWins: 0, winnerId: null, createdAt: now(), ...values
        });
        this._id = values._id || id();
    }
}
module.exports = Battle;
