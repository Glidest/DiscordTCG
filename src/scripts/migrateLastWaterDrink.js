const { connectDB, disconnectDB } = require('../config/database');

async function migrateLastWaterDrink() {
    try {
        const UserCollection = require('../models/UserCollection');
        const Card = require('../models/Card');

        await connectDB();
        const waterDrinkCard = await Card.findOne({ name: 'Water Drink' });
        if (!waterDrinkCard) {
            console.log('Water Drink card not found in database');
            return;
        }

        const collections = await UserCollection.find({});
        let updated = 0;
        for (const collection of collections) {
            let changed = false;
            collection.cards = collection.cards.map(card => {
                if (String(card.cardId) !== String(waterDrinkCard._id)) return card;
                changed = true;
                return { ...card, lastUsed: new Date(0).toISOString() };
            });
            if (changed) { await collection.save(); updated++; }
        }
        console.log(`Updated ${updated} collections`);
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await disconnectDB();
    }
}

migrateLastWaterDrink(); 