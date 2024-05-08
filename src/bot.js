import {
    usersDataCash,
    TABLE_NAMES,
    USER_CONVERSATION_STATES,
    USER_STATUSES,
    USERS_TABLE_COLUMNS,
    DEFAULT_ERROR_MESSAGE_TO_USER,
    JOBS_TABLE_COLUMNS,
    OPTION_BUTTON_ACTION,
    JOBS_EXECUTIONS_TABLE_COLUMNS,
    JOBS_STATUSES, JOBS_EXECUTION_STATUSES
} from "./main.js";
import * as Base from "./base.js";

import TelegramBot from 'node-telegram-bot-api';
import {convertRichTextToHtml} from "./util.js";
import {createRecordInTable, findRecordInTableById, selectRecordsInTable, updateFieldsInTable} from "./base.js";

const bot = new TelegramBot('7115871048:AAEf2jTqg13L0xxBeDPbaq5VnArvOeNYUjo', {polling: true});

export async function initBot() {
    bot.on('polling_error', (error) => {
        console.error('Tg bot polling error:', error);
        bot.stopPolling();
    });

    const menuCommands = ['/start', '/profile', '/help', '/task'];
    bot.setMyCommands([
        {command: "help", description: "Позвать техническую поддержку или тимлидов Pinkman"},
        {command: "profile", description: "Просмотр профиля"},
        {command: "task", description: "Просмотр твоих задач"},
    ]);


    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 'Привет! \nЭто бот студии pinkman'); // todo описание

        const userData = usersDataCash[chatId];
        if (!userData) {
            startWorkWithNewUser(msg);
        } else {
            userData.conversationState = null;
        }
    })

    bot.onText(/\/help/, async (msg) => {
        const chatId = msg.chat.id;
        await bot.sendMessage(chatId, 'По техническим вопросам напиши в телеграм @antonshakirov');
    })

    bot.onText(/\/profile/, async (msg) => {
        await showUserProfileInfo(msg);
    })

    bot.onText(/\/task/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 'Здесь будет отображаться информация по твоим задачам');
    })


    bot.on('message', (msg) => {
        if (menuCommands.includes(msg.text)) {
            // ignore menu commands
            return;
        }

        onMessageEnteredText(msg)
    });
}


async function showUserProfileInfo(msg) {
    if (!msg) {
        return;
    }

    const chatId = msg.chat.id;

    try {
        const userData = usersDataCash[chatId];
        if (!userData) {
            // todo log
            await sendPlainTextToChat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
            return;
        }

        const userRecord = await findRecordInTableById(TABLE_NAMES.USERS, userData.airtableId);
        if (!userRecord) {
            // todo log
            await sendPlainTextToChat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
            return;
        }

        // preparing message about profile info
        let profileInfoMessage = '<b>Твой статус: </b>';

        const userStatus = userRecord.fields[USERS_TABLE_COLUMNS.STATUS];
        userData.status = userStatus;
        switch (userStatus) {
            case USER_STATUSES.NEW_USER:
                profileInfoMessage += 'новый пользователь';
                break;

            case USER_STATUSES.MAKE_DOCS:
                profileInfoMessage += 'подписываем документы для работы';
                break;

            case USER_STATUSES.APPROVED:
                profileInfoMessage += 'допущен к выполнению работ';
                break;

            case USER_STATUSES.REJECTED:
                profileInfoMessage += 'доступ к задачам закрыт';
                break;
        }

        profileInfoMessage += '\n<b>Задач выполнено: </b>' + userRecord.fields[USERS_TABLE_COLUMNS.COUNT_COMPLETED_TASK];

        const moneyAvailable = parseInt(userRecord.fields[USERS_TABLE_COLUMNS.MONEY_AVAILABLE]).toLocaleString('ru-RU');
        profileInfoMessage += '\n<b>Сколько доступно денег для выплат: </b>' + moneyAvailable + '₽';

        profileInfoMessage+='\n<b>Твоя текущая ставка: </b>'
            + userRecord.fields[USERS_TABLE_COLUMNS.HOUR_RATE].toLocaleString('ru-RU') + '₽ в час';


        // todo add action points
        await sendPlainTextToChat(chatId, profileInfoMessage);

        // refresh user telegram in Airtable
        const userActualTelegram = msg.chat.username.toString()
        userData.telegramUsername = userActualTelegram;
        // todo update in base

    } catch (err) {
        //todo log
        await bot.sendMessage(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
    }
}

async function onMessageEnteredText(msg) {
    const chatId = msg.chat.id;

    let userData = usersDataCash[chatId];
    if (userData) {
        switch (userData.status) {
            case USER_STATUSES.NEW_USER:
                await replyToFillUserFields(msg, userData);
                break;

            case USER_STATUSES.MAKE_DOCS:
                await userMakeDocsReply(msg, userData);
                break;

            case USER_STATUSES.APPROVED:
                await userApprovedReply(msg, userData);
                break;

            case USER_STATUSES.REJECTED:
                await userRejectedReply(msg, userData);
                break;
        }

    } else {
        await startWorkWithNewUser(msg);
    }
}

async function replyToFillUserFields(msg, userData) {
    if (userData.conversationState === USER_CONVERSATION_STATES.SET_NAME) {
        await userEnteredName(msg, userData);
    } else if (!userData.name) {
        await tellUserEnterName(userData);
    } else if (userData.conversationState === USER_CONVERSATION_STATES.SET_PORTFOLIO) {
        await userEnteredPortfolio(msg, userData);
    } else if (!userData.portfolio) {
        await tellUserEnterPortfolio(userData);
    } else if (userData.conversationState === USER_CONVERSATION_STATES.SET_HOUR_RATE) {
        await userEnteredHourRate(msg, userData);
    } else if (!userData.hourRate) {
        await tellUserEnterHourRate(userData);
    }
}

function userMakeDocsReply(msg, userData) {
    bot.sendMessage(userData.chatId, 'Твои документы еще в процессе подготовки и подписания. ' +
        '\nМы свяжемся с тобой по документам, если еще не связались. Либо сообщим о статусе ' +
        'твоего допуска к выполнению работ');
}

async function userApprovedReply(msg, userData) {
    await bot.sendMessage(userData.chatId, 'Открой меню чтобы просмотреть и изменить информацию');
}

async function userRejectedReply(msg, userData) {
    await bot.sendMessage(userData.chatId, 'Сейчас у тебя нет доступа к платформе и заданиям');
}


async function tellUserEnterName(userData) {
    userData.conversationState = USER_CONVERSATION_STATES.SET_NAME;
    await bot.sendMessage(userData.chatId, 'Для начала введи свое имя и фамилию: ');
}

async function userEnteredName(msg, userData) {
    const enteredName = msg.text;
    if (enteredName.length <= 3) {
        await bot.sendMessage(userData.chatId, 'Имя и фамилия должны быть больше 3 символов. Введите еще раз:');

    } else {
        const fields = {
            [USERS_TABLE_COLUMNS.NAME]: enteredName
        };

        Base.updateFieldsInTable(TABLE_NAMES.USERS, userData.airtableId, fields)
            .then(record => {

                userData.name = record.fields[USERS_TABLE_COLUMNS.NAME]
                tellUserEnterPortfolio(userData);
            })
            .catch(err => {
                //todo log
                bot.sendMessage(userData.chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
            })
    }
}


function tellUserEnterPortfolio(userData) {
    bot.sendMessage(userData.chatId, 'Укажи одну ссылку на свое портфолио.' +
        'Это может быть страница Behance, Notion, личный сайт или любая другая ссылка на собранные работы');
    userData.conversationState = USER_CONVERSATION_STATES.SET_PORTFOLIO;
}

function userEnteredPortfolio(msg, userData) {
    const enteredPortfolioLink = msg.text;
    const countOfLink = (enteredPortfolioLink.match(/http/g) || []).length;
    if (countOfLink === 0) {
        bot.sendMessage(userData.chatId, 'Кажется введена не корректная ссылка. Укажи еще раз полную ссылку:');

    } else if (countOfLink > 1) {
        bot.sendMessage(userData.chatId, 'Указано более одной ссылки. Пришли еще раз одну ссылку на все свое портфолио.' +
            ' Если тебе нужно собрать несколько ссылок вместе, сделать страницу в Notion и пришли на нее единую ссылку');

    } else {

        const fields = {
            [USERS_TABLE_COLUMNS.PORTFOLIO]: enteredPortfolioLink
        };

        Base.updateFieldsInTable(TABLE_NAMES.USERS, userData.airtableId, fields)
            .then(record => {
                userData.portfolio = record.fields[USERS_TABLE_COLUMNS.PORTFOLIO]
                tellUserEnterHourRate(userData);

            })
            .catch(err => {
                //todo log
                bot.sendMessage(userData.chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
            })
    }
}


function tellUserEnterHourRate(userData) {
    bot.sendMessage(userData.chatId, 'Укажи свою часовую ставку в рублях. ' +
        'Введи число без каких-либо символов, с точностью до рубля.' +
        '\n\nВ будущем ее можно будет изменять в профиле, но при откликах на задачи мы будем рассматривать ' +
        'твою текущую ставку в час, укаанную в профиле');
    userData.conversationState = USER_CONVERSATION_STATES.SET_HOUR_RATE;
}

function userEnteredHourRate(msg, userData) {
    const enteredRate = msg.text;
    const enteredRateInt = parseInt(enteredRate.replace(' ', ''));

    if (!enteredRateInt || enteredRateInt < 10) {
        bot.sendMessage(userData.chatId, 'Введена некорректная ставка. \nУкажи еще раз свою часовую ставку в рублях (числом):');

    } else {
        const fields = {
            [USERS_TABLE_COLUMNS.HOUR_RATE]: enteredRateInt,
            [USERS_TABLE_COLUMNS.STATUS]: USER_STATUSES.MAKE_DOCS,
            [USERS_TABLE_COLUMNS.TELEGRAM]: msg.chat.username.toString(), // upd if it changes on that step
        };

        Base.updateFieldsInTable(TABLE_NAMES.USERS, userData.airtableId, fields)
            .then(async record => {
                userData.portfolio = record.fields[USERS_TABLE_COLUMNS.HOUR_RATE]
                userData.telegramUsername = record.fields[USERS_TABLE_COLUMNS.TELEGRAM]; // upd if it changes on that step

                if (userData.status === USER_STATUSES.NEW_USER) {
                    userData.status = USER_STATUSES.MAKE_DOCS;
                    userData.conversationState = null;

                    await informUserAboutNewStatus(userData);
                }

            })
            .catch(err => {
                //todo log
                bot.sendMessage(userData.chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
            })
    }
}

async function startWorkWithNewUser(msg) {
    const chatId = msg.chat.id;

    try {
        const fields = {
            [USERS_TABLE_COLUMNS.CHAT_ID]: chatId.toString(),
            [USERS_TABLE_COLUMNS.TELEGRAM]: msg.chat.username.toString(),
        };

        const airtableRecord = await Base.createRecordInTable(TABLE_NAMES.USERS, fields);
        if (!airtableRecord) {
            // todo log
            await sendPlainTextToChat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
            return;
        }

        let userData = {};
        userData.chatId = chatId;
        userData.airtableId = airtableRecord.id;
        userData.telegramUsername = airtableRecord.fields[USERS_TABLE_COLUMNS.TELEGRAM];
        userData.status = USER_STATUSES.NEW_USER;

        usersDataCash[chatId] = userData;
        tellUserEnterName(userData);

    } catch (e) {
        // todo log
        await sendPlainTextToChat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
    }
}

export async function sendNewJobToUsers(jobRecord) {
    if (!jobRecord) {
        return;
    }

    for (const chatId in usersDataCash) {
        const userData = usersDataCash[chatId];
        if (!userData) {
            return;
        }

        if (userData.status === USER_STATUSES.APPROVED) {
            await sendJobToUser(userData, jobRecord);
        }
    }

    // save information that job was send to users
    const fields = {
        [JOBS_TABLE_COLUMNS.JOB_WAS_SEND]: true,
    };
    Base.updateFieldsInTable(TABLE_NAMES.JOBS, jobRecord.id, fields)
        .then(record => {
        })
        .catch(err => {
            //todo log
        })

}

async function sendJobToUser(userData, jobRecord) {

    let descriptionRichText = jobRecord.fields[JOBS_TABLE_COLUMNS.DESCRIPTION];

    const deadlineDate = jobRecord.fields[JOBS_TABLE_COLUMNS.DEADLINE_DATE];
    if (deadlineDate && descriptionRichText) {
        const deadlineFormatDate = new Date(deadlineDate).toLocaleDateString('ru-Ru');
        descriptionRichText += '\n\n**Крайняя дата приема заявок:** ' + deadlineFormatDate;
    }

    const htmlJobDescription = convertRichTextToHtml(descriptionRichText);

    const options = {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [{
                    text: 'Откликнуться',
                    callback_data: JSON.stringify({action: OPTION_BUTTON_ACTION.JOB_RESPONSE, jobId: jobRecord.id})
                }]
            ]
        }),
        parse_mode: 'HTML' // Set parse mode to HTML
    };

    await bot.sendMessage(userData.chatId, htmlJobDescription, options);
}

// Click to option
bot.on('callback_query', (callbackQuery) => {
    if (!callbackQuery) {
        return;
    }

    const chatId = callbackQuery.message.chat.id;
    const jsonData = callbackQuery.data;
    const responseData = JSON.parse(jsonData);

    if (!responseData) {
        return;
    }

    switch (responseData.action) {
        case OPTION_BUTTON_ACTION.JOB_RESPONSE:
            responseToJob(chatId, responseData, callbackQuery);
            break;
    }
});

async function responseToJob(chatId, responseData, callbackQuery) {
    const jobAirtableId = responseData.jobId;

    try {
        const jobRecord = await findRecordInTableById(TABLE_NAMES.JOBS, jobAirtableId);
        if (jobRecord) {
            if (jobRecord.fields[JOBS_TABLE_COLUMNS.STATUS] === JOBS_STATUSES.OPEN) {

                const userData = usersDataCash[chatId];
                if (userData && userData.status === USER_STATUSES.APPROVED) {
                    // todo set estimation hours

                    const jobResponseField = {
                        [JOBS_EXECUTIONS_TABLE_COLUMNS.USER]: [userData.airtableId],
                        [JOBS_EXECUTIONS_TABLE_COLUMNS.JOB]: [jobAirtableId],
                    };
                    const jobResponseRecord = await createRecordInTable(TABLE_NAMES.JOBS_EXECUTIONS, jobResponseField);

                    if (jobResponseRecord) {
                        bot.sendMessage(chatId, "Отклик отправлен. Позже мы сообщим о том, будем ли работать по " +
                            "задаче с тобой или выбрали кого-то другого")
                    }
                } else {
                    await sendPlainTextToChat(chatId, "Кажется у тебя еще нет доступа для отклика на задачи");
                }

            } else {
                //todo console
                await sendPlainTextToChat(chatId, "Срок отклика истек или мы уже закрыли запрос на задачу");
            }
        }

        // remove buttons
        bot.editMessageReplyMarkup({
            inline_keyboard: []
        }, {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id
        });

    } catch (e) {
        //todo log
        await sendPlainTextToChat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
    }
}

export async function informUserAboutNewStatus(userData) {
    switch (userData.status) {

        case USER_STATUSES.MAKE_DOCS:
            await sendPlainTextToChat(userData.chat_id, 'Нужно подписать документы. Мы свяжемся с тобой в ' +
                'личных сообщениях в ближайшие рабочие дни');
            break;

        case USER_STATUSES.APPROVED:
            await sendPlainTextToChat(userData.chat_id, 'Доступ открыт. Теперь ты будешь получать все задачи');
            break;

        case USER_STATUSES.REJECTED:
            await sendPlainTextToChat(userData.chat_id, 'Доступ заблокирован');
            break;
    }
}

export async function informUserAboutJobExecutionNewStatus(jobExecutionRecord) {
    try {
        const chatId = jobExecutionRecord.fields[JOBS_EXECUTIONS_TABLE_COLUMNS.USER_CHAT_ID][0];
        const userData = usersDataCash[chatId];
        const newStatus = jobExecutionRecord.fields[JOBS_EXECUTIONS_TABLE_COLUMNS.STATUS];

        if (!chatId || !userData || !newStatus) {
            return;
        }

        const infoTitleAboutTask = '<b>Изменился статус по задаче \"'
            + jobExecutionRecord.fields[JOBS_EXECUTIONS_TABLE_COLUMNS.TASK_NAME] + '\":</b>\n'


        switch (newStatus) {
            case JOBS_EXECUTION_STATUSES.IN_PROGRESS:
                await sendPlainTextToChat(chatId, infoTitleAboutTask + "Ты выбран испонителем. Скоро сы свяжемся с тобой для начала работ");
                break;

            case JOBS_EXECUTION_STATUSES.STUDIO_REFUSED:
                await sendPlainTextToChat(chatId, infoTitleAboutTask + "Студия прекратила работу с тобой по задаче. Лид напишет тебе по деталям");
                break;

            case JOBS_EXECUTION_STATUSES.USER_REFUSED:
                await sendPlainTextToChat(chatId, infoTitleAboutTask + "Отказ от задачи по твоей инициативе");
                break;

            case JOBS_EXECUTION_STATUSES.COMPLETED:
                await sendPlainTextToChat(chatId, infoTitleAboutTask + "Задача успешно выполнена и закрыта");
                userData.conversationState = USER_CONVERSATION_STATES.SET_JOB_REAL_TIME;
                // todo say input hours
                break;
        }

        // refresh changes mark
        await updateFieldsInTable(TABLE_NAMES.JOBS_EXECUTIONS, jobExecutionRecord.id, {
            [JOBS_EXECUTIONS_TABLE_COLUMNS.STATUS_CHANGED]: false
        })

    } catch (e) {
        //todo log
    }
}

export async function sendPlainTextToChat(chatId, text) {
    if (chatId) {
        await bot.sendMessage(chatId, text, {parse_mode: 'HTML'});
    }
}