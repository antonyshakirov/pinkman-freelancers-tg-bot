// @pinkman_future_platform_bot

const TelegramBot = require('node-telegram-bot-api');
const Airtable = require('airtable');

const base = new Airtable({apiKey: 'patyjyp3D51sr4Xbc.105a1158dc0342d7ba6cb59261f1293162a3f6173626b53cefd388da973adc86'}).base('apppEZ9COxjPRpdCL');
const bot = new TelegramBot('7115871048:AAEf2jTqg13L0xxBeDPbaq5VnArvOeNYUjo', {polling: true});
const usersDataCash = {}; // user data by ChatId


import express from 'express';

const app = express();
const PORT = 3000;

// Handling GET / Request
app.get('/', (req, res) => {
    res.send('Welcome to typescript backend!');
})

// Server setup
app.listen(PORT,() => {
    console.log('The application is listening '
        + 'on port http://localhost:'+PORT);
})


const TABLE_NAMES = {
    USERS: 'Пользователи',
    JOBS: 'Задачи',
    JOBS_EXECUTIONS: 'Отклики по задачам',
    PAYMENTS: 'Оплаты',
}

const USER_CONVERATION_STATES = {
    SET_NAME: 'setName',
    SET_PORTFOLIO: 'setPortfolio',
    SET_HOUR_RATE: 'setRate',
    UDT_RATE: 'udtRate',
    SET_JOB_ESTIMATION_TIME: 'setJobEstimationTime',
};
const USER_STATUSES = {
    NEW_USER: 'Новый пользователь',
    MAKE_TEST_CASE: 'Проверяем тестовое',
    MAKE_DOCS: 'Подпись документов',
    APPROVED: 'Допущен к задачам',
    REJECTED: 'Заявка отклонена',
    ON_PAUSE: 'На паузе',
};

const USERS_TABLE_COLUMNS = {
    NAME: 'Имя и Фамилия',
    STATUS: 'Статус',
    PORTFOLIO: 'Ссылка на портфолио',
    HOUR_RATE: 'Часовая ставка',
    CHAT_ID: '(auto) ChatId',
    TELEGRAM: '(auto) Telegram',
}

initializeServer();

async function initializeServer() {
    try {
        //Bot.writeToChat();
        await initUserData()

        initBot()

    } catch (error) {
        console.error('Initialization error:', error);
    }
}



// save all data from Airtable to usersDataCash
async function initUserData() {
    await base(TABLE_NAMES.USERS).select({})
        .eachPage((records, fetchNextPage) => {
            // Process each page of records
            records.forEach((userAirtableData) => {

                const chatId = userAirtableData.fields[USERS_TABLE_COLUMNS.CHAT_ID];
                if (chatId) {
                    let userData = {};
                    userData.airtableId = userAirtableData.id;
                    userData.chatId = chatId;
                    userData.telegramUsername = userAirtableData.fields[USERS_TABLE_COLUMNS.TELEGRAM];
                    userData.name = userAirtableData.fields[USERS_TABLE_COLUMNS.NAME];
                    userData.portfolio = userAirtableData.fields[USERS_TABLE_COLUMNS.PORTFOLIO];
                    userData.hourRate = userAirtableData.fields[USERS_TABLE_COLUMNS.HOUR_RATE];
                    userData.status = userAirtableData.fields[USERS_TABLE_COLUMNS.STATUS];

                    usersDataCash[chatId] = userData;
                }
            });

            // Fetch the next page of records
            fetchNextPage();
        }
    )
}


function initBot() {
    bot.on('polling_error', (error) => {
        console.error('Tg bot polling error:', error);
        bot.stopPolling();
    });

    const menuCommands = ['/start', '/profile', '/help'];
    bot.setMyCommands([
        {command: "help", description: "Позвать техническую поддержку или тимлидов Pinkman"},
        {command: "profile", description: "Просмотр профиля"},
    ]);


    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 'Привет! \nЭто бот студии pinkman');

        const userData = usersDataCash[chatId];
        if (!userData) {
            startWorkWithNewUser(msg);
        }
    })

    bot.onText(/\/help/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 'По техническим вопросам напиши в телеграм @antonshakirov');
    })

    bot.onText(/\/profile/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 'Здесь будет отображаться информация по твоему профилю');
    })


    bot.on('message', (msg) => {
        const chatId = msg.chat.id;

        if (menuCommands.includes(msg.text)) {
            // ignore commands
            return;
        }

        let userData = usersDataCash[chatId];
        if (userData) {
            switch (userData.status) {
                case USER_STATUSES.NEW_USER:
                    newUserReply(msg, userData);
                    break;

                case USER_STATUSES.MAKE_TEST_CASE:
                    userTestCaseReply(msg, userData);
                    break;

                case USER_STATUSES.MAKE_DOCS:
                    userMakeDocsReply(msg, userData);
                    break;

                case USER_STATUSES.APPROVED:
                    userApprovedReply(msg, userData);
                    break;

                case USER_STATUSES.REJECTED:
                    userRejectedReply(msg, userData);
                    break;

                case USER_STATUSES.ON_PAUSE:
                    userOnPauseReply(msg, userData);
                    break;
            }

        }
    });
}

function startWorkWithNewUser(msg) {
    const chatId = msg.chat.id;

    const fields = {
        [USERS_TABLE_COLUMNS.CHAT_ID]: chatId.toString(),
        [USERS_TABLE_COLUMNS.TELEGRAM]: msg.chat.username.toString(),
    };

    base(TABLE_NAMES.USERS).create(fields, (err, record) => {
        if (err) {
            return;
            bot.sendMessage(chatId, 'Что-то пошло не так. Попробуй еще раз или обратись в поддержку через команду /help');
        }

        try {
            let userData = {};
            usersDataCash[chatId] = userData;

            userData.airtableId = record.id;
            userData.chatId = chatId;
            userData.telegramUsername = record.fields[USERS_TABLE_COLUMNS.TELEGRAM];
            userData.status = USER_STATUSES.NEW_USER;

            tellUserEnterName(userData);

        } catch (e) {
            bot.sendMessage(chatId, 'Что-то пошло не так. Обратись в поддержку через команду /help');
        }
    });
}


function newUserReply(msg, userData) {
    if (userData.conversationState === USER_CONVERATION_STATES.SET_NAME) {
        userEnteredName(msg, userData);
    } else if (!userData.name) {
        tellUserEnterName(userData);
    } else if (userData.conversationState === USER_CONVERATION_STATES.SET_PORTFOLIO) {
        userEnteredPortfolio(msg, userData);
    } else if (!userData.portfolio) {
        tellUserEnterPortfolio(userData);
    } else if (userData.conversationState === USER_CONVERATION_STATES.SET_HOUR_RATE) {
        userEnteredHourRate(msg, userData);
    } else if (!userData.hourRate) {
        tellUserEnterHourRate(userData);
    }
}
function userTestCaseReply(msg, userData) {
    bot.sendMessage(userData.chatId, 'Твое тестовое задание еще на этапе выполнения или проверки. Мы свяжемся с тобой ' +
        'в личные сообщения по тестовому заданию, если еще не связались. Либо сообщим о результатах его выполнения');
}

function userMakeDocsReply(msg, userData) {
    bot.sendMessage(userData.chatId, 'Твои документы еще в процессе подготовки и подписания. Мы свяжемся с тобой ' +
        'в личные сообщения по документам, если еще не связались. Либо сообщим о статусе твоего допуска к выполнению работ');
}

function userApprovedReply(msg, userData) {

}

function userRejectedReply(msg, userData) {
    bot.sendMessage(userData.chatId, 'Сейчас у тебя нет доступа к платформе и заданиям');
}

function userOnPauseReply(msg, userData) {
    bot.sendMessage(userData.chatId, 'Сейчас ты не получаешь уведомлений о новых работах');
}


function tellUserEnterName(userData) {
    userData.conversationState = USER_CONVERATION_STATES.SET_NAME;
    bot.sendMessage(userData.chatId, 'Для начала введи свое имя и фамилию: ');
}
function userEnteredName(msg, userData) {
    const enteredName = msg.text;
    if (enteredName.length <= 3) {
        bot.sendMessage(userData.chatId, 'Имя и фамилия должны быть больше 3 символов. Введите еще раз:');

    } else {
        userData.name = enteredName;
        base(TABLE_NAMES.USERS).update([
            {
                id: userData.airtableId,
                fields: {
                    [USERS_TABLE_COLUMNS.NAME]: enteredName
                }
            }
        ], (err, records) => {
            if (err) {
                bot.sendMessage(userData.chatId, 'Не удалось сохранить информацию в базе. Попробуй еще раз или напиши в поддержку через команду /help');
                return;
            }

            tellUserEnterPortfolio(userData);
        });
    }
}


function tellUserEnterPortfolio(userData) {
    bot.sendMessage(userData.chatId, 'Укажи одну ссылку на свое портфолио.' +
        'Это может быть страница Behance, Notion, личный сайт или любая другая ссылка на собранные работы');
    userData.conversationState = USER_CONVERATION_STATES.SET_PORTFOLIO;
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
        userData.portfolio = enteredPortfolioLink;

        base(TABLE_NAMES.USERS).update([
            {
                id: userData.airtableId,
                fields: {
                    [USERS_TABLE_COLUMNS.PORTFOLIO]: enteredPortfolioLink
                }
            }
        ], (err, records) => {
            if (err) {
                bot.sendMessage(userData.chatId, 'Не удалось сохранить информацию в базе. Попробуй еще раз или напиши в поддержку через команду /help');
                return;
            }

            tellUserEnterHourRate(userData);
        });
    }

}


function tellUserEnterHourRate(userData) {
    bot.sendMessage(userData.chatId, 'Укажи свою часовую ставку в рублях. ' +
        'Введи число без каких-либо символов, с точностью до рубля' +
        '\nВ будущем ее можно будет изменять в профиле, но при откликах на задачи мы будем рассматривать ' +
        'твою текущую ставку в час, укаанную в профиле');
    userData.conversationState = USER_CONVERATION_STATES.SET_HOUR_RATE;
}

function userEnteredHourRate(msg, userData) {
    const enteredRate = msg.text;
    const enteredRateInt = parseInt(enteredRate.replace(' ', ''));

    if (!enteredRateInt || enteredRateInt < 10) {
        bot.sendMessage(userData.chatId, 'Введена некорректная ставка. Укажи еще раз свою часовую ставку в рублях (числом):');

    } else {
        base(TABLE_NAMES.USERS).update([
            {
                id: userData.airtableId,
                fields: {
                    [USERS_TABLE_COLUMNS.HOUR_RATE]: enteredRateInt,
                    [USERS_TABLE_COLUMNS.STATUS]: USER_STATUSES.MAKE_DOCS,
                    [USERS_TABLE_COLUMNS.TELEGRAM]: msg.chat.username.toString(), // upd if it changes on that step
                }
            }
        ], (err, records) => {
            if (err) {
                bot.sendMessage(userData.chatId, 'Не удалось сохранить информацию в базе. Попробуй еще раз или напиши в поддержку через команду /help');
                return;
            }
            userData.telegramUsername = msg.chat.username.toString(); // upd if it changes on that step
            if (userData.status === USER_STATUSES.NEW_USER) {
                userData.status = USER_STATUSES.MAKE_DOCS;
                startMakeUserDocuments(userData);
            }

        });
    }
}

function startMakeUserDocuments(userData) {
    userData.conversationState = null;
    bot.sendMessage(userData.chatId, 'Осталось только подписать документы для работы. Мы напишем тебе в личное сообщение');
}


// Click to option
bot.on('callback_query', (query) => {
    /**
     const chatId = query.message.chat.id;
     const data = query.data;

     // Get the current user's selected options from the query message
     let selectedOptions = query.message.reply_markup.selected_options || [];

     // Toggle the selected state of the clicked option
     const optionIndex = selectedOptions.indexOf(data);
     if (optionIndex === -1) {
     // Option not selected, add it to the list
     selectedOptions.push(data);
     } else {
     // Option already selected, remove it from the list
     selectedOptions.splice(optionIndex, 1);
     }

     // Update the reply markup with the new selection
     const updatedMarkup = {
     inline_keyboard: [
     [{
     text: 'Option 1',
     callback_data: 'option1',
     switch_inline_query_current_chat: selectedOptions.includes('option1')
     }],
     [{
     text: 'Option 2',
     callback_data: 'option2',
     switch_inline_query_current_chat: selectedOptions.includes('option2')
     }],
     [{
     text: 'Option 3',
     callback_data: 'option3',
     switch_inline_query_current_chat: selectedOptions.includes('option3')
     }],
     // Add more buttons/options as needed
     ]
     };

     // Edit the message to update the inline keyboard with the new selection
     bot.editMessageReplyMarkup(updatedMarkup, {
     chat_id: chatId,
     message_id: query.message.message_id
     });
     */
});