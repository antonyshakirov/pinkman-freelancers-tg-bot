import {
    usersDataCash,
    DEFAULT_ERROR_MESSAGE_TO_USER, DEFAULT_MESSAGE_ABOUT_QUESTION_ABOVE,
} from "./main.js";

import TelegramBot from 'node-telegram-bot-api';
import {
    callbackHandler,
    onMessageEnteredText,
    showUserProfileInfo,
    showUserTaskInfo,
    startWorkWithNewUser
} from "./bot-actions.js";
import {log} from "./util.js";

export let isTestMode = process.env.IS_TEST === 'true';
const botToken = isTestMode ? '7115871048:AAEf2jTqg13L0xxBeDPbaq5VnArvOeNYUjo' : '7137325520:AAEWszXsc1a4pmcaX-UKyN5IQGLVT-uT5to';
const bot = new TelegramBot(botToken, {polling: true});
export let botIsWorking = true;

export async function initBot() {
    bot.on('polling_error', (error) => {
        log.error("Bot polling_error: " + error);
        botIsWorking = false;
        bot.stopPolling();
    });
    bot.on('webhook_error', (error) => {
        log.error("Bot webhook_error: " + error);
        botIsWorking = false;
        bot.stopPolling();
    });
    bot.on('error', (error) => {
        log.error("Bot error: " + error);
        botIsWorking = false;
        bot.stopPolling();
    });

    const menuCommands = ['/start', '/profile', '/my_task', '/help'];
    await bot.setMyCommands([
        {command: 'profile', description: "Просмотр профиля"},
        {command: 'my_task', description: "Просмотр твоих задач"},
        {command: 'help', description: "Позвать техническую поддержку или тимлидов Pinkman"},
    ]);


    await bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            await sendPlainTextToChatInHTMLFormat(chatId, 'Привет! \nЭто бот студии pinkman')

            const userData = usersDataCash[chatId];
            if (!userData) {
                await startWorkWithNewUser(msg);
            }
            if (userData.conversationState) {
                await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_MESSAGE_ABOUT_QUESTION_ABOVE);
            }

        } catch (e) {
            log.error('bot.onText /start error: ', e);
            await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    })

    await bot.onText(/\/profile/, async (msg) => {
        try {
            const chatId = msg.chat.id;
            const userData = usersDataCash[chatId];
            if (userData && userData.airtableId) {
                await showUserProfileInfo(msg);
            } else {
                await startWorkWithNewUser(msg);
            }

        } catch (e) {
            log.error('bot.onText /profile error: ', e);
            await sendPlainTextToChatInHTMLFormat(msg.chat.id, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    })

    await bot.onText(/\/my_task/, async (msg) => {
        try {
            const chatId = msg.chat.id;
            const userData = usersDataCash[chatId];
            if (userData && userData.airtableId) {
                await showUserTaskInfo(msg);
            } else {
                await startWorkWithNewUser(msg);
            }

        } catch (e) {
            log.error('bot.onText /my_task error: ', e);
            await sendPlainTextToChatInHTMLFormat(msg.chat.id, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    })

    await bot.onText(/\/help/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            const chatId = msg.chat.id;
            const userData = usersDataCash[chatId];
            if (userData && userData.airtableId) {
                await sendPlainTextToChatInHTMLFormat(chatId, 'По техническим вопросам напиши в телеграм @antonshakirov');
                if (userData.conversationState) {
                    await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_MESSAGE_ABOUT_QUESTION_ABOVE);
                }

            } else {
                await startWorkWithNewUser(msg);
            }

        } catch (e) {
            log.error('bot.onText /help error: ', e);
            await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    })


    await bot.on('message', async (msg) => {
        try {
            if (menuCommands.includes(msg.text)) {
                // ignore menu commands
                return;
            }

            const chatId = msg.chat.id;
            const userData = usersDataCash[chatId];
            if (userData && userData.airtableId) {
                await onMessageEnteredText(msg);
            } else {
                await startWorkWithNewUser(msg);
            }

        } catch (e) {
            log.error('bot.on message error: ', e);
            await sendPlainTextToChatInHTMLFormat(msg.chat.id, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    });

    // Click to option
    bot.on('callback_query', async (callbackQuery) => {
        try {
            await callbackHandler(callbackQuery);

        } catch (e) {
            log.error('bot.on callback_query error: ', e);
            await sendPlainTextToChatInHTMLFormat(callbackQuery.from.chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    });
}

export async function sendPlainTextToChatInHTMLFormat(chatId, text) {
    if (!chatId) {
        log.warn('sendPlainTextToChatInHTMLFormat error, chatId not found');
        return;
    }

    try {
        await bot.sendMessage(chatId, text, {parse_mode: 'HTML'});

    } catch (e) {
        log.warn('sendPlainTextToChatInHTMLFormat error: ' + e);
        if (chatId) {
            await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    }
}

export async function sendTextWithOptionsToChat(chatId, text, options) {
    if (!chatId) {
        log.warn('sendTextWithOptionsToChat error, chatId not found');
        return;
    }

    try {
        await bot.sendMessage(chatId, text, options);

    } catch (e) {
        log.warn('sendTextWithOptionsToChat error: ' + e);
        if (chatId) {
            await bot.sendMessage(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    }
}

export async function editMessageReplyMarkup(chatId, messageId, newInlineKeyboard) {
    try {
        await bot.editMessageReplyMarkup({
            inline_keyboard: newInlineKeyboard
        }, {
            chat_id: chatId,
            message_id: messageId
        });

    } catch (e) {
        log.warn('editMessageReplyMarkup error: ' + e);
        if (chatId) {
            await bot.sendMessage(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    }
}