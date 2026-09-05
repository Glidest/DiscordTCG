const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const Trade = require('../../models/Trade');
const Card = require('../../models/Card');
const UserCollection = require('../../models/UserCollection');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../../config/database');

const TRADE_LIMITS = {
    MAX_CARDS_PER_TRADE: 10,
    RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
    MAX_TRADES_PER_WINDOW: 3
};

const userTradeAttempts = new Map();

function checkRateLimit(userId) {
    const now = Date.now();
    const userAttempts = userTradeAttempts.get(userId) || [];
    const recentAttempts = userAttempts.filter(time => now - time < TRADE_LIMITS.RATE_LIMIT_WINDOW);
    
    if (recentAttempts.length >= TRADE_LIMITS.MAX_TRADES_PER_WINDOW) {
        const oldestAttempt = recentAttempts[0];
        const timeLeft = TRADE_LIMITS.RATE_LIMIT_WINDOW - (now - oldestAttempt);
        return { 
            allowed: false, 
            timeLeft: Math.ceil(timeLeft / 1000)
        };
    }
    
    recentAttempts.push(now);
    userTradeAttempts.set(userId, recentAttempts);
    return { allowed: true };
}

async function validateTradePermissions(interaction, targetUser) {
    try {
        const dmChannel = await targetUser.createDM();
        await dmChannel.send('Testing trade permissions...');
        await dmChannel.delete();
    } catch (error) {
        return { 
            valid: false, 
            message: 'Cannot send trade offers to this user. They may have DMs disabled or blocked the bot.' 
        };
    }

    if (!interaction.guild.members.cache.has(targetUser.id)) {
        return { 
            valid: false, 
            message: 'Cannot trade with users outside this server.' 
        };
    }

    return { valid: true };
}

async function validateCards(userId, cardNames, quantities = {}) {
    const userCollection = await UserCollection.findOne({ userId })
        .populate({
            path: 'cards.cardId',
            refPath: 'cards.cardType'
        });
    
    if (!userCollection) return { valid: false, message: 'You don\'t have any cards.' };

    const cards = cardNames.split(',').map(name => name.trim());
    
    if (cards.length > TRADE_LIMITS.MAX_CARDS_PER_TRADE) {
        return { 
            valid: false, 
            message: `You can only trade up to ${TRADE_LIMITS.MAX_CARDS_PER_TRADE} cards at once.` 
        };
    }

    const validatedCards = [];
    const pendingTrades = await Trade.find({
        $or: [{ initiatorId: userId }, { targetId: userId }],
        status: 'pending'
    }).populate('initiatorCards.cardId targetCards.cardId');

    for (const cardName of cards) {
        const card = userCollection.cards.find(c => 
            c.cardId && c.cardId.name.toLowerCase() === cardName.toLowerCase()
        );

        if (!card) {
            return { valid: false, message: `You don't have "${cardName}" in your collection.` };
        }

        if (card.special) {
            return { valid: false, message: `"${cardName}" is a special card and cannot be traded.` };
        }

        const quantity = quantities[cardName] || 1;
        if (card.quantity < quantity) {
            return { valid: false, message: `You only have ${card.quantity} copies of "${cardName}".` };
        }

        // Check if card is already in a pending trade
        const isInPendingTrade = pendingTrades.some(trade => {
            const allCards = [...trade.initiatorCards, ...trade.targetCards];
            return allCards.some(t => 
                t.cardId._id.toString() === card.cardId._id.toString() && 
                t.cardType === card.cardType &&
                t.quantity >= quantity
            );
        });

        if (isInPendingTrade) {
            return { valid: false, message: `"${cardName}" is already part of a pending trade.` };
        }

        validatedCards.push({
            cardId: card.cardId._id,
            cardType: card.cardType,
            quantity: quantity
        });
    }

    return { valid: true, cards: validatedCards };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trade')
        .setDescription('Trade cards with other users')
        .addSubcommand(subcommand =>
            subcommand
                .setName('offer')
                .setDescription('Offer a trade to another user')
                .addStringOption(option =>
                    option.setName('cards')
                        .setDescription('Cards you want to trade (comma-separated)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('for')
                        .setDescription('Cards you want in return (comma-separated)')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to trade with')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('accept')
                .setDescription('Accept a trade offer')
                .addStringOption(option =>
                    option.setName('trade_id')
                        .setDescription('ID of the trade to accept')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Cancel a trade offer')
                .addStringOption(option =>
                    option.setName('trade_id')
                        .setDescription('ID of the trade to cancel')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'offer': {
                const rateLimit = checkRateLimit(interaction.user.id);
                if (!rateLimit.allowed) {
                    return interaction.reply(
                        `You're trading too quickly. Please wait ${rateLimit.timeLeft} seconds before trying again.`
                    );
                }

                const targetUser = interaction.options.getUser('user');
                if (targetUser.id === interaction.user.id) {
                    return interaction.reply('You cannot trade with yourself.');
                }

                const permissionsCheck = await validateTradePermissions(interaction, targetUser);
                if (!permissionsCheck.valid) {
                    return interaction.reply(permissionsCheck.message);
                }

                const cardsToTrade = interaction.options.getString('cards');
                const cardsToReceive = interaction.options.getString('for');

                const [initiatorValidation, targetValidation] = await Promise.all([
                    validateCards(interaction.user.id, cardsToTrade),
                    validateCards(targetUser.id, cardsToReceive)
                ]);

                if (!initiatorValidation.valid) {
                    return interaction.reply(initiatorValidation.message);
                }
                if (!targetValidation.valid) {
                    return interaction.reply(`Target user ${targetValidation.message}`);
                }

                const trade = new Trade({
                    tradeId: uuidv4(),
                    initiatorId: interaction.user.id,
                    targetId: targetUser.id,
                    initiatorCards: initiatorValidation.cards,
                    targetCards: targetValidation.cards
                });

                await trade.save();

                const embed = new MessageEmbed()
                    .setColor('#FFD700')
                    .setTitle('🔄 Trade Offer')
                    .setDescription(`Trade offer from ${interaction.user.username} to ${targetUser.username}`)
                    .addFields(
                        { name: 'Offering', value: cardsToTrade, inline: true },
                        { name: 'Requesting', value: cardsToReceive, inline: true },
                        { name: 'Trade ID', value: trade.tradeId }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                await targetUser.send({ embeds: [embed] });
                break;
            }

            case 'accept': {
                const tradeId = interaction.options.getString('trade_id');
                try {
                    let trade = await Trade.findOne({ tradeId, status: 'pending' });
                    if (!trade) throw new Error('Trade offer not found or already processed.');
                    if (trade.targetId !== interaction.user.id) throw new Error('This trade offer is not for you.');

                    const moveCards = (from, to, entries) => {
                        for (const entry of entries) {
                            const cardId = String(entry.cardId && entry.cardId._id || entry.cardId);
                            const fromCard = from.cards.find(card =>
                                String(card.cardId && card.cardId._id || card.cardId) === cardId &&
                                card.cardType === entry.cardType && card.quantity >= entry.quantity);
                            if (!fromCard) throw new Error('Trade cancelled: Cards are no longer available.');
                            fromCard.quantity -= entry.quantity;
                            if (fromCard.quantity <= 0) from.cards = from.cards.filter(card => card !== fromCard);
                            const toCard = to.cards.find(card =>
                                String(card.cardId && card.cardId._id || card.cardId) === cardId &&
                                card.cardType === entry.cardType);
                            if (toCard) toCard.quantity += entry.quantity;
                            else to.cards.push({ cardId, cardType: entry.cardType, quantity: entry.quantity, special: false });
                        }
                    };
                    getDB().transaction(() => {
                        const currentTradeRow = getDB().prepare(
                            'SELECT * FROM trades WHERE trade_id = ? AND status = ?'
                        ).get(tradeId, 'pending');
                        if (!currentTradeRow) {
                            throw new Error('Trade offer was already processed.');
                        }

                        const currentTrade = Trade._fromRow(currentTradeRow, true);
                        const initiatorRow = getDB().prepare(
                            'SELECT * FROM user_collections WHERE user_id = ?'
                        ).get(currentTrade.initiatorId);
                        const targetRow = getDB().prepare(
                            'SELECT * FROM user_collections WHERE user_id = ?'
                        ).get(currentTrade.targetId);
                        const initiatorCollection = initiatorRow
                            ? UserCollection._fromRow(initiatorRow, true)
                            : null;
                        const targetCollection = targetRow
                            ? UserCollection._fromRow(targetRow, true)
                            : null;
                        if (!initiatorCollection || !targetCollection) {
                            throw new Error('One or both users\' collections not found.');
                        }

                        moveCards(initiatorCollection, targetCollection, currentTrade.initiatorCards);
                        moveCards(targetCollection, initiatorCollection, currentTrade.targetCards);

                        const claim = getDB().prepare(
                            'UPDATE trades SET status = ? WHERE trade_id = ? AND status = ?'
                        ).run('completed', tradeId, 'pending');
                        if (claim.changes !== 1) {
                            throw new Error('Trade offer was already processed.');
                        }

                        UserCollection._save(initiatorCollection);
                        UserCollection._save(targetCollection);
                        currentTrade.status = 'completed';
                        Trade._save(currentTrade);
                        trade = currentTrade;
                    })();

                    // If we get here, transaction was successful
                    const completedTrade = await Trade.findOne({ tradeId });
                    const embed = new MessageEmbed()
                        .setColor('#00FF00')
                        .setTitle('✅ Trade Completed')
                        .setDescription('The trade has been successfully completed!')
                        .addFields(
                            { name: 'Trade ID', value: completedTrade.tradeId },
                            { name: 'Traded Cards', value: `${completedTrade.initiatorCards.length} cards exchanged` }
                        )
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                    await interaction.client.users.cache.get(completedTrade.initiatorId)?.send({ embeds: [embed] });

                } catch (error) {
                    throw error;
                }
                break;
            }

            case 'cancel': {
                const tradeId = interaction.options.getString('trade_id');
                const trade = await Trade.findOne({ tradeId, status: 'pending' });

                if (!trade) {
                    return interaction.reply('Trade offer not found or already processed.');
                }

                if (trade.initiatorId !== interaction.user.id && trade.targetId !== interaction.user.id) {
                    return interaction.reply('You cannot cancel this trade offer.');
                }

                const cancellation = getDB().prepare(
                    'UPDATE trades SET status = ?, cancelled_at = ?, cancelled_by = ? WHERE trade_id = ? AND status = ?'
                ).run('cancelled', new Date().toISOString(), interaction.user.id, tradeId, 'pending');
                if (cancellation.changes !== 1) {
                    return interaction.reply('Trade offer was already processed.');
                }
                trade.status = 'cancelled';
                trade.cancelledBy = interaction.user.id;
                trade.cancelledAt = new Date();

                const embed = new MessageEmbed()
                    .setColor('#FF0000')
                    .setTitle('❌ Trade Cancelled')
                    .setDescription('The trade has been cancelled.')
                    .addFields(
                        { name: 'Trade ID', value: trade.tradeId },
                        { name: 'Cancelled by', value: interaction.user.username }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                const otherUserId = trade.initiatorId === interaction.user.id ? trade.targetId : trade.initiatorId;
                await interaction.client.users.cache.get(otherUserId)?.send({ embeds: [embed] });
                break;
            }
            default: {
                await interaction.reply({
                    content: 'Invalid trade subcommand. Use `/tcg help` to see available options.',
                    ephemeral: true
                });
            }
        }
    }
}; 