const crypto = require('crypto');
const { getDB } = require('../config/database');

const jsonFields = new Set([
    'cards', 'initiatorCards', 'targetCards', 'rounds', 'parentCards'
]);

function id() {
    return crypto.randomUUID();
}

function now() {
    return new Date().toISOString();
}

function parse(value, fallback) {
    if (value === null || value === undefined) return fallback;
    try { return JSON.parse(value); } catch (_) { return fallback; }
}

function scalar(value) {
    if (value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
}

function valuesForStorage(value) {
    if (Array.isArray(value)) return value.map(valuesForStorage);
    if (!value || typeof value !== 'object') return value;
    if (value._id && Object.keys(value).length > 1) return value._id;
    const result = {};
    for (const [key, item] of Object.entries(value)) result[key] = valuesForStorage(item);
    return result;
}

function normalizeForStorage(value, key) {
    if (jsonFields.has(key)) return JSON.stringify(valuesForStorage(value || []));
    return scalar(value);
}

function rawField(row, field) {
    if (field === 'id' || field === '_id') return row._id ?? row.id;
    if (field === 'set') return row.set ?? row.set_name;
    if (field === 'imageUrl') return row.imageUrl ?? row.image_url;
    if (field === 'fusedBy') return row.fusedBy ?? row.fused_by;
    if (field === 'createdAt') return row.createdAt ?? row.created_at;
    if (field === 'updatedAt') return row.updatedAt ?? row.updated_at;
    if (field === 'userId') return row.userId ?? row.user_id;
    if (field === 'tradeId') return row.tradeId ?? row.trade_id;
    if (field === 'initiatorId') return row.initiatorId ?? row.initiator_id;
    if (field === 'targetId') return row.targetId ?? row.target_id;
    if (field === 'lastDaily') return row.lastDaily ?? row.last_daily;
    if (field === 'lastXpGain') return row.lastXpGain ?? row.last_xp_gain;
    if (field === 'lastEarnTime') return row.lastEarnTime ?? row.last_earn_time;
    if (field === 'challengerId') return row.challengerId ?? row.challenger_id;
    if (field === 'defenderId') return row.defenderId ?? row.defender_id;
    if (field === 'challengerCardId') return row.challengerCardId ?? row.challenger_card_id;
    if (field === 'defenderCardId') return row.defenderCardId ?? row.defender_card_id;
    return row[field];
}

function matches(doc, filter = {}) {
    for (const [key, condition] of Object.entries(filter)) {
        if (key === '$or') {
            if (!condition.some(item => matches(doc, item))) return false;
            continue;
        }
        if (key === '$and') {
            if (!condition.every(item => matches(doc, item))) return false;
            continue;
        }
        if ((key === 'parentCards' || key === 'parentCards.cardId') && condition.$all) {
            const parents = doc.parentCards || [];
            const ids = parents.map(parent => String(parent.cardId && parent.cardId._id || parent.cardId));
            if (!condition.$all.every(item => ids.includes(String(item && item._id || item)))) return false;
            continue;
        }
        if (key === 'cards.cardId' && condition) {
            const cards = doc.cards || [];
            const ids = cards.map(card => String(card.cardId && card.cardId._id || card.cardId));
            if (condition.$all && !condition.$all.every(item => ids.includes(String(item)))) return false;
            if (!condition.$in && !condition.$all && !ids.includes(String(condition))) return false;
            continue;
        }
        const value = rawField(doc, key);
        if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
            if (condition.$regex !== undefined) {
                const flags = condition.$options || '';
                if (!new RegExp(condition.$regex, flags).test(String(value || ''))) return false;
            } else if (condition.$in && !condition.$in.map(String).includes(String(value))) return false;
            else if (condition.$ne !== undefined && String(value) === String(condition.$ne)) return false;
            else if (condition.$gte !== undefined && value < condition.$gte) return false;
            else if (condition.$lte !== undefined && value > condition.$lte) return false;
        } else if (String(value) !== String(condition)) {
            return false;
        }
    }
    return true;
}

class Query {
    constructor(executor) {
        this.executor = executor;
        this.populatePaths = [];
        this.sortSpec = null;
        this.max = null;
        this.fields = null;
    }
    populate(path) { this.populatePaths.push(typeof path === 'string' ? path : path.path); return this; }
    sort(spec) { this.sortSpec = spec; return this; }
    limit(value) { this.max = value; return this; }
    select(fields) { this.fields = fields; return this; }
    lean() { return this; }
    session() { return this; }
    then(resolve, reject) {
        return Promise.resolve().then(() => this.executor(this)).then(resolve, reject);
    }
    catch(reject) { return this.then(undefined, reject); }
    finally(callback) { return this.then(value => Promise.resolve(callback()).then(() => value)); }
}

class SQLiteDocument {
    constructor(model, values = {}) {
        this._model = model;
        Object.assign(this, values);
    }
    async save() {
        this._model._save(this);
        return this;
    }
}

class SQLiteModel {
    constructor(values = {}) {
        this._model = this.constructor;
        Object.assign(this, values);
    }
    async save() {
        this.constructor._save(this);
        return this;
    }
    static get table() { throw new Error('table is required'); }
    static get primaryKey() { return 'id'; }
    static get columns() { return []; }
    static get jsonFields() { return jsonFields; }
    static _fromRow(row, populate = false) {
        if (!row) return null;
        const values = {};
        for (const column of this.columns) {
            const property = column.property || column.name;
            let value = row[column.name];
            if (this.jsonFields.has(property)) value = parse(value, []);
            if (column.boolean) value = Boolean(value);
            if (column.date && value) value = new Date(value);
            values[property] = value;
        }
        values._id = row.id;
        const doc = Object.assign(Object.create(this.prototype), values);
        doc._model = this;
        if (populate && this.populate) this.populate(doc);
        return doc;
    }
    static _allRows() { return getDB().prepare(`SELECT * FROM ${this.table}`).all(); }
    static _matches(row, filter) { return matches(this._fromRow(row, false), filter); }
    static _query(rows, query) {
        let docs = rows.map(row => this._fromRow(row, query.populatePaths.length > 0));
        if (query.sortSpec) {
            const entries = Object.entries(query.sortSpec);
            docs.sort((a, b) => {
                for (const [field, direction] of entries) {
                    const av = rawField(a, field); const bv = rawField(b, field);
                    if (av === bv) continue;
                    return (av > bv ? 1 : -1) * Number(direction);
                }
                return 0;
            });
        }
        if (query.max !== null) docs = docs.slice(0, query.max);
        if (query.fields) {
            const names = String(query.fields).split(/\s+/).filter(Boolean);
            docs = docs.map(doc => {
                for (const key of Object.keys(doc)) {
                    if (key !== '_model' && key !== '_id' && !names.includes(key)) delete doc[key];
                }
                return doc;
            });
        }
        return docs;
    }
    static find(filter = {}) {
        return new Query(query => this._query(this._allRows().filter(row => this._matches(row, filter)), query));
    }
    static findOne(filter = {}) {
        return new Query(query => this._query(this._allRows().filter(row => this._matches(row, filter)).slice(0, 1), query)[0] || null);
    }
    static findById(value) { return this.findOne({ _id: value }); }
    static exists(filter = {}) { return this.findOne(filter).then(Boolean); }
    static create(values) { const doc = new this(values); return doc.save(); }
    static insertMany(values) { return Promise.all(values.map(value => this.create(value))); }
    static deleteMany(filter = {}) {
        const rows = this._allRows().filter(row => this._matches(row, filter));
        const statement = getDB().prepare(`DELETE FROM ${this.table} WHERE ${this.primaryKeyColumn} = ?`);
        const primary = this.primaryKeyColumn;
        const result = getDB().transaction(() => {
            for (const row of rows) statement.run(row[primary]);
        })();
        return Promise.resolve({ deletedCount: result && result.changes || rows.length });
    }
    static updateMany(filter, update) {
        const rows = this._allRows().filter(row => this._matches(row, filter));
        for (const row of rows) {
            const doc = this._fromRow(row);
            this._applyUpdate(doc, update);
            this._save(doc);
        }
        return Promise.resolve({ modifiedCount: rows.length });
    }
    static findOneAndDelete(filter = {}) {
        return this.findOne(filter).then(async doc => {
            if (doc) await this.deleteMany({ _id: doc._id });
            return doc;
        });
    }
    static findOneAndUpdate(filter, update, options = {}) {
        return this.findOne(filter).then(async doc => {
            if (!doc) return null;
            this._applyUpdate(doc, update);
            await doc.save();
            return doc;
        });
    }
    static aggregate(pipeline = []) {
        let docs = this._allRows().map(row => this._fromRow(row));
        for (const stage of pipeline) {
            if (stage.$match) docs = docs.filter(doc => matches(doc, stage.$match));
            if (stage.$sample) {
                docs.sort(() => Math.random() - 0.5);
                docs = docs.slice(0, stage.$sample.size);
            }
        }
        return Promise.resolve(docs);
    }
    static _applyUpdate(doc, update = {}) {
        const changes = update.$set || update;
        for (const [key, value] of Object.entries(changes)) {
            if (!key.includes('.')) doc[key] = value;
        }
    }
    static _save(doc) {
        const data = {};
        for (const column of this.columns) {
            const property = column.property || column.name;
            data[column.name] = normalizeForStorage(doc[property], property);
        }
        const idColumn = this.primaryKeyColumn;
        data[idColumn] = doc._id || doc[this.primaryKey] || id();
        doc._id = data[idColumn];
        const names = Object.keys(data);
        const placeholders = names.map(() => '?').join(', ');
        const updates = names.filter(name => name !== idColumn).map(name => `${name}=excluded.${name}`).join(', ');
        try {
            getDB().prepare(
                `INSERT INTO ${this.table} (${names.join(', ')}) VALUES (${placeholders}) ` +
                `ON CONFLICT(${idColumn}) DO UPDATE SET ${updates}`
            ).run(names.map(name => data[name]));
        } catch (error) {
            if (String(error.message).includes('UNIQUE')) error.code = 11000;
            throw error;
        }
    }
}

module.exports = { SQLiteModel, SQLiteDocument, Query, id, now, parse, matches, rawField };
