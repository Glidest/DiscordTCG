const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

let db;

function databasePath() {
    const configured = process.env.DB_PATH || './data/discord-tcg.sqlite';
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

function migrate(connection) {
    connection.pragma('foreign_keys = ON');
    connection.pragma('journal_mode = WAL');
    connection.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS cards (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT NOT NULL DEFAULT '',
            rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'legendary', 'deity', 'fused')),
            type TEXT NOT NULL CHECK (type IN ('Blood', 'Mind', 'Time', 'Tech', 'Arcane', 'Necrotic', 'Deity')),
            set_name TEXT NOT NULL DEFAULT 'Base Set',
            image_url TEXT,
            special INTEGER NOT NULL DEFAULT 0,
            power INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS fused_cards (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            rarity TEXT NOT NULL DEFAULT 'fused',
            image_url TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            set_name TEXT NOT NULL DEFAULT 'Fusion',
            power INTEGER NOT NULL DEFAULT 0,
            fused_by TEXT NOT NULL,
            parent_cards TEXT NOT NULL DEFAULT '[]',
            special INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            last_daily TEXT,
            xp INTEGER NOT NULL DEFAULT 0,
            level INTEGER NOT NULL DEFAULT 1,
            last_xp_gain TEXT
        );
        CREATE TABLE IF NOT EXISTS user_collections (
            user_id TEXT PRIMARY KEY,
            cards TEXT NOT NULL DEFAULT '[]'
        );
        CREATE TABLE IF NOT EXISTS user_credits (
            user_id TEXT PRIMARY KEY,
            credits INTEGER NOT NULL DEFAULT 0,
            last_earn_time TEXT
        );
        CREATE TABLE IF NOT EXISTS trades (
            trade_id TEXT PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'pending',
            initiator_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            initiator_cards TEXT NOT NULL DEFAULT '[]',
            target_cards TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            completed_at TEXT,
            cancelled_at TEXT,
            cancelled_by TEXT
        );
        CREATE TABLE IF NOT EXISTS battles (
            id TEXT PRIMARY KEY,
            challenger_id TEXT NOT NULL,
            defender_id TEXT NOT NULL,
            challenger_card_id TEXT NOT NULL,
            defender_card_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            rounds TEXT NOT NULL DEFAULT '[]',
            current_round INTEGER NOT NULL DEFAULT 1,
            challenger_wins INTEGER NOT NULL DEFAULT 0,
            defender_wins INTEGER NOT NULL DEFAULT 0,
            winner_id TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS decks (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            cards TEXT NOT NULL DEFAULT '[]',
            active INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, name)
        );
        CREATE INDEX IF NOT EXISTS idx_decks_user_active ON decks(user_id, active);
        CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
        CREATE INDEX IF NOT EXISTS idx_battles_players ON battles(challenger_id, status, defender_id);
    `);
    connection.prepare(
        'INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (1, ?)'
    ).run(new Date().toISOString());
}

function getDB() {
    if (!db) {
        const file = databasePath();
        fs.mkdirSync(path.dirname(file), { recursive: true });
        db = new Database(file);
        migrate(db);
    }
    return db;
}

async function connectDB() {
    getDB();
    console.log(`Connected to SQLite database at ${databasePath()}`);
    return db;
}

async function disconnectDB() {
    if (db) {
        db.close();
        db = undefined;
        console.log('Disconnected from SQLite');
    }
}

module.exports = { connectDB, disconnectDB, getDB, databasePath, migrate };
