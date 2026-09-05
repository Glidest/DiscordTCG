# Discord TCG Bot

A Discord bot that implements a Trading Card Game (TCG) system with card collecting and trading mechanics. Battles and other features coming soon!

## Features

- Card collection system with different rarities and sets
- Card trading between users
- Card fusion system
- Pack opening mechanics
- User profiles with collection statistics
- Currency system for purchasing packs
- Experience and leveling system

## Commands

All commands use the `/tcg` prefix:

### Collection Management
- `/tcg open` - Open a new pack of cards (Costs credits)
- `/tcg view [rarity] [set]` - View your card collection with optional rarity and set filters
- `/tcg showcollection` - Display your complete card collection
- `/tcg inspect <card_name>` - View detailed information about a specific card
- `/tcg profile [@user]` - View your or another user's collection statistics and card breakdown

### Trading System
- `/tcg trade offer <cards> <for> <user>` - Offer a trade to another user
- `/tcg trade accept <trade_id>` - Accept a trade offer
- `/tcg trade cancel <trade_id>` - Cancel a trade offer
- `/tcg tradeup` - Trade up multiple cards of the same rarity for a higher rarity card

### Card Fusion
- `/tcg fuse <card1> <card2>` - Fuse two cards to create a special fused card

### Deck Management
- `/tcg deck create <name>` - Create a deck (the first deck becomes active)
- `/tcg deck add <name> <card>` - Add an owned card to a deck
- `/tcg deck remove <name> <card>` - Remove a card from a deck
- `/tcg deck view [name]` - View a deck, or your active deck
- `/tcg deck list` - List your decks and their active status
- `/tcg deck activate <name>` - Set a deck as active
- `/tcg deck delete <name>` - Delete a deck

### Economy
- `/tcg earn` - Earn currency (with cooldown)
- `/tcg givecurrency <user> <amount>` - [Admin] Give currency to a user

### Utility
- `/tcg help` - List all available commands and their functions

When an active deck exists, `/tcg battle` requires the selected card to be in that
deck. The optional `deck` argument can select a different deck for the battle.

## Scripts

### Card Management
- `generateCardImages.js` - Generate card images and sync card data to the database
  - Usage: `npm run generate-images`
  - Generates images for cards that need them
  - Updates cards.json with image URLs
  - Syncs all cards to the local SQLite database

### Bot Management
- `deployCommands.js` - Deploy slash commands to Discord
  - Usage: `npm run deploy-commands`
  - Registers all commands with Discord's API

### Database Management
- `resetBot.js` - Reset the bot's database state
  - Usage: `npm run reset-bot`
  - Clears all user data, collections, and trades
  - Use with caution!

### Migration Scripts
- `migrateLastWaterDrink.js` - Migration script for legacy data
  - Usage: `npm run migrate-water-drink`
  - Migrates data from the old water drink system

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   DISCORD_TOKEN=your_bot_token
   DB_PATH=./data/discord-tcg.sqlite
   ```
4. Deploy commands:
   ```bash
   npm run deploy-commands
   ```
5. Start the bot:
   ```bash
   npm start
   ```

## Configuration

The bot's configuration can be modified in `src/config/config.js`:
- Currency name and costs
- Experience and leveling settings
- Card rarity probabilities
- Cooldown timers
- Other game mechanics

The bot uses a local SQLite database powered by `better-sqlite3`. The database
file is created automatically (including its schema migrations) at `DB_PATH`.
No MongoDB server or connection string is required.

This change replaces the MongoDB storage layer; it does not import an existing
MongoDB database automatically. Back up any existing data before switching, and
copy or export the database file with the bot when deploying to another host.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
