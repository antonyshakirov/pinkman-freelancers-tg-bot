import {
    usersDataCash,
    DEFAULT_ERROR_MESSAGE_TO_USER,
} from "./main.js";

import TelegramBot from 'node-telegram-bot-api';
import {
    callbackHandler,
    onMessageEnteredText,
    showUserProfileInfo,
    showUserTaskInfo,
    startWorkWithNewUser
} from "./bot-actions.js";

export let isTestMode = false; // todo change it auto for test on local server;
const botToken = isTestMode ? '7115871048:AAEf2jTqg13L0xxBeDPbaq5VnArvOeNYUjo' : '7137325520:AAEWszXsc1a4pmcaX-UKyN5IQGLVT-uT5to';
const bot = new TelegramBot(botToken, {polling: true});

export async function initBot() {
    bot.on('polling_error', (error) => {
        // todo log
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

        } catch (e) {
            // todo log
            await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    })

    await bot.onText(/\/profile/, async (msg) => {
        try {
            await showUserProfileInfo(msg);
        } catch (e) {
            // todo log
            await sendPlainTextToChatInHTMLFormat(msg.chat.id, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    })

    await bot.onText(/\/my_task/, async (msg) => {
        try {
            await showUserTaskInfo(msg);
        } catch (e) {
            // todo log
            await sendPlainTextToChatInHTMLFormat(msg.chat.id, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    })

    await bot.onText(/\/help/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            await sendPlainTextToChatInHTMLFormat(chatId, 'По техническим вопросам напиши в телеграм @antonshakirov')
        } catch (e) {
            // todo log
            await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    })


    await bot.on('message', async (msg) => {
        try {
            if (menuCommands.includes(msg.text)) {
                // ignore menu commands
                return;
            }

            await onMessageEnteredText(msg);

        } catch (e) {
            // todo log
            await sendPlainTextToChatInHTMLFormat(msg.chat.id, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    });

    // Click to option
    bot.on('callback_query', async (callbackQuery) => {
        try {
            await callbackHandler(callbackQuery);

        } catch (e) {
            // todo log
            await sendPlainTextToChatInHTMLFormat(callbackQuery.from.chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    });
}

export async function sendPlainTextToChatInHTMLFormat(chatId, text) {
    if (!chatId) {
        // todo log
        return;
    }

    try {
        await bot.sendMessage(chatId, text, {parse_mode: 'HTML'});

    } catch (e) {
        // todo log
        await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
    }
}

export async function sendTextWithOptionsToChat(chatId, text, options) {
    if (!chatId) {
        // todo log
        return;
    }

    try {
        await bot.sendMessage(chatId, text, options);

    } catch (e) {
        // todo log
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
        // todo log
        if (chatId) {
            await bot.sendMessage(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
        }
    }

}