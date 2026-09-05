const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const Deck = require('../../models/Deck');
const {
    MAX_DECK_SIZE,
    getCardName,
    findOwnedCard,
    getUserCollection,
    getDeck
} = require('../../utils/deckUtils');

const data = [
    new SlashCommandSubcommandBuilder()
        .setName('create')
        .setDescription('Create a new deck')
        .addStringOption(option => option.setName('name').setDescription('Deck name').setRequired(true)),
    new SlashCommandSubcommandBuilder()
        .setName('delete')
        .setDescription('Delete a deck')
        .addStringOption(option => option.setName('name').setDescription('Deck name').setRequired(true)),
    new SlashCommandSubcommandBuilder()
        .setName('add')
        .setDescription('Add an owned card to a deck')
        .addStringOption(option => option.setName('name').setDescription('Deck name').setRequired(true))
        .addStringOption(option => option.setName('card').setDescription('Card name').setRequired(true)),
    new SlashCommandSubcommandBuilder()
        .setName('remove')
        .setDescription('Remove a card from a deck')
        .addStringOption(option => option.setName('name').setDescription('Deck name').setRequired(true))
        .addStringOption(option => option.setName('card').setDescription('Card name').setRequired(true)),
    new SlashCommandSubcommandBuilder()
        .setName('view')
        .setDescription('View a deck')
        .addStringOption(option => option.setName('name').setDescription('Deck name').setRequired(false)),
    new SlashCommandSubcommandBuilder()
        .setName('list')
        .setDescription('List your decks'),
    new SlashCommandSubcommandBuilder()
        .setName('activate')
        .setDescription('Set a deck as your active deck')
        .addStringOption(option => option.setName('name').setDescription('Deck name').setRequired(true))
];

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const action = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    try {
        if (action === 'list') return listDecks(interaction, userId);
        if (action === 'create') return createDeck(interaction, userId);
        if (action === 'delete') return deleteDeck(interaction, userId);
        if (action === 'add') return addCard(interaction, userId);
        if (action === 'remove') return removeCard(interaction, userId);
        if (action === 'view') return viewDeck(interaction, userId);
        if (action === 'activate') return activateDeck(interaction, userId);
        throw new Error(`Unknown deck action: ${action}`);
    } catch (error) {
        if (error.code === 11000) {
            await interaction.editReply('You already have a deck with that name.');
            return;
        }
        console.error('Error in /tcg deck command:', error);
        await interaction.editReply('There was an error managing your deck. Please try again later.');
    }
}

async function listDecks(interaction, userId) {
    const decks = await Deck.find({ userId }).sort({ createdAt: 1 });
    if (decks.length === 0) return interaction.editReply('You have no decks yet. Create one with `/tcg deck create`.');

    const lines = decks.map(deck =>
        `${deck.active ? '✅' : '▫️'} **${deck.name}** — ${deck.cards.length}/${MAX_DECK_SIZE} cards`
    );
    return interaction.editReply(`**Your Decks**\n${lines.join('\n')}`);
}

async function createDeck(interaction, userId) {
    const name = interaction.options.getString('name').trim();
    if (!name || name.length > 32) return interaction.editReply('Deck names must be between 1 and 32 characters.');

    const hasDeck = await Deck.exists({ userId });
    const deck = await Deck.create({ userId, name, active: !hasDeck });
    return interaction.editReply(`Created **${deck.name}**${deck.active ? ' and set it as your active deck' : ''}.`);
}

async function deleteDeck(interaction, userId) {
    const name = interaction.options.getString('name').trim();
    const deck = await Deck.findOneAndDelete({ userId, name });
    if (!deck) return interaction.editReply(`No deck named **${name}** was found.`);

    if (deck.active) {
        const replacement = await Deck.findOne({ userId }).sort({ createdAt: 1 });
        if (replacement) {
            replacement.active = true;
            await replacement.save();
        }
    }
    return interaction.editReply(`Deleted deck **${deck.name}**.`);
}

async function addCard(interaction, userId) {
    const deckName = interaction.options.getString('name').trim();
    const cardName = interaction.options.getString('card');
    const [deck, collection] = await Promise.all([
        Deck.findOne({ userId, name: deckName }),
        getUserCollection(userId)
    ]);
    if (!deck) return interaction.editReply(`No deck named **${deckName}** was found.`);
    if (deck.cards.length >= MAX_DECK_SIZE) return interaction.editReply(`Decks may contain up to ${MAX_DECK_SIZE} cards.`);
    if (!collection) return interaction.editReply('You do not own any cards yet.');

    const ownedCard = findOwnedCard(collection, cardName);
    if (!ownedCard) return interaction.editReply(`You do not own **${cardName}**.`);
    if (deck.cards.some(card => card.cardId.toString() === ownedCard.cardId._id.toString() && card.special === ownedCard.special)) {
        return interaction.editReply('That card is already in this deck.');
    }

    deck.cards.push({
        cardId: ownedCard.cardId._id,
        cardType: ownedCard.cardType,
        special: ownedCard.special
    });
    await deck.save();
    return interaction.editReply(`Added **${getCardName(ownedCard)}** to **${deck.name}** (${deck.cards.length}/${MAX_DECK_SIZE}).`);
}

async function removeCard(interaction, userId) {
    const deckName = interaction.options.getString('name').trim();
    const cardName = interaction.options.getString('card');
    const deck = await getDeck(userId, deckName);
    if (!deck) return interaction.editReply(`No deck named **${deckName}** was found.`);

    const index = deck.cards.findIndex(card => card.cardId && getCardName(card).toLowerCase() === cardName.toLowerCase());
    if (index === -1) return interaction.editReply(`**${cardName}** is not in **${deck.name}**.`);
    deck.cards.splice(index, 1);
    await deck.save();
    return interaction.editReply(`Removed **${cardName}** from **${deck.name}**.`);
}

async function viewDeck(interaction, userId) {
    const name = interaction.options.getString('name');
    const deck = await getDeck(userId, name);
    if (!deck) return interaction.editReply(name ? `No deck named **${name}** was found.` : 'You have no active deck.');

    const cards = deck.cards.length
        ? deck.cards.map((card, index) => `${index + 1}. **${getCardName(card)}** (${card.cardId.rarity}, ${card.cardId.power} power)`)
        : 'No cards yet.';
    return interaction.editReply(`**${deck.name}** ${deck.active ? '✅' : ''}\n${cards.join ? cards.join('\n') : cards}\n\n${deck.cards.length}/${MAX_DECK_SIZE} cards`);
}

async function activateDeck(interaction, userId) {
    const name = interaction.options.getString('name').trim();
    const deck = await Deck.findOne({ userId, name });
    if (!deck) return interaction.editReply(`No deck named **${name}** was found.`);

    await Deck.updateMany({ userId }, { $set: { active: false } });
    deck.active = true;
    await deck.save();
    return interaction.editReply(`**${deck.name}** is now your active deck.`);
}

module.exports = { data, execute };
