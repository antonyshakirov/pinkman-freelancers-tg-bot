import {
    DEFAULT_ERROR_MESSAGE_TO_USER, JOBS_EXECUTION_STATUSES,
    JOBS_EXECUTIONS_TABLE_COLUMNS, JOBS_STATUSES, JOBS_TABLE_COLUMNS, OPTION_BUTTON_ACTION, PAYMENTS_TABLE_COLUMNS,
    TABLE_NAMES, USER_CONVERSATION_STATES,
    USER_STATUSES, USERS_TABLE_COLUMNS,
    usersDataCash
} from "./main.js";
import * as Base from "./base.js";
import {createRecordInTable, findRecordInTableById, updateFieldsInTable} from "./base.js";
import {convertRichTextToHtml} from "./util.js";
import {editMessageReplyMarkup, sendPlainTextToChatInHTMLFormat, sendTextWithOptionsToChat} from "./bot.js";


export async function showUserProfileInfo(msg) {
    if (!msg) {
        return;
    }

    const chatId = msg.chat.id;

    try {
        const userData = usersDataCash[chatId];
        if (!userData) {
            // todo log
            await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
            return;
        }

        const userRecord = await findRecordInTableById(TABLE_NAMES.USERS, userData.airtableId);
        if (!userRecord) {
            // todo log
            await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
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

        let moneyAvailable = 0;
        if (userStatus !== USER_STATUSES.NEW_USER) {
            profileInfoMessage += '\n<b>Задач выполнено: </b>' + userRecord.fields[USERS_TABLE_COLUMNS.COUNT_COMPLETED_TASK];

            moneyAvailable = parseInt(userRecord.fields[USERS_TABLE_COLUMNS.MONEY_AVAILABLE]);
            profileInfoMessage += '\n<b>Сколько доступно денег для выплат: </b>' + moneyAvailable.toLocaleString('ru-RU') + '₽';

            profileInfoMessage += '\n<b>Твоя текущая ставка: </b>'
                + userRecord.fields[USERS_TABLE_COLUMNS.HOUR_RATE].toLocaleString('ru-RU') + '₽ в час';
        }

        // send message about profile info

        const inline_keyboard = [];
        if (userData.status === USER_STATUSES.APPROVED) {
            inline_keyboard.push([{
                    text: 'Изменить часовую ставку',
                    callback_data: JSON.stringify({action: OPTION_BUTTON_ACTION.CHANGE_RATE, chatId: chatId})
                }]
            )
        }

        if (moneyAvailable > 0) {
            inline_keyboard.push([{
                text: 'Запросить выплату денег',
                callback_data: JSON.stringify({action: OPTION_BUTTON_ACTION.REQUEST_MONEY, chatId: chatId})
            }])
        }

        const options = {
            reply_markup: JSON.stringify({
                inline_keyboard: inline_keyboard,
            }),
            parse_mode: 'HTML' // Set parse mode to HTML
        };

        await sendTextWithOptionsToChat(userData.chatId, profileInfoMessage, options);


        // refresh user telegram
        const userActualTelegram = msg.chat.username.toString()
        userData.telegramUsername = userActualTelegram;

        const fields = {
            [USERS_TABLE_COLUMNS.TELEGRAM]: userActualTelegram
        };
        await updateFieldsInTable(TABLE_NAMES.USERS, userData.airtableId, fields)

    } catch (err) {
        //todo log
        await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER)
    }
}

export async function showUserTaskInfo(msg) {
    const chatId = msg.chat.id;
    try {
        const userData = usersDataCash[chatId];
        if (!userData) {
            // todo log
            await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
            return;
        }

        if (userData.status === USER_STATUSES.NEW_USER || userData.status === USER_STATUSES.MAKE_DOCS) {
            await sendPlainTextToChatInHTMLFormat(chatId, 'Пока еще нет доступа к просмотру выполненных задач');
            return;
        }

        const airtableId = userData.airtableId;
        const findUsersSelectFormula = `{${JOBS_EXECUTIONS_TABLE_COLUMNS.USER_ID}} = '${airtableId}'`
        const userTaskRecords = await Base.selectRecordsInTable(TABLE_NAMES.JOBS_EXECUTIONS, findUsersSelectFormula)

        let taskInProcessListText = '';
        let completedTaskListText = '';

        userTaskRecords.forEach(record => {
            const taskNameText = record.fields[JOBS_EXECUTIONS_TABLE_COLUMNS.TASK_NAME] + '.\n';
            switch (record.fields[JOBS_EXECUTIONS_TABLE_COLUMNS.STATUS]) {
                case JOBS_EXECUTION_STATUSES.IN_PROGRESS:
                    taskInProcessListText += taskNameText;
                    break;

                case JOBS_EXECUTION_STATUSES.COMPLETED:
                    completedTaskListText += taskNameText;
                    break;
            }
        })

        let summaryStatusAboutTask = '';
        if (taskInProcessListText.length > 0) {
            summaryStatusAboutTask += '<b>Задачи в процессе работы:</b> \n' + taskInProcessListText + '\n'
        }
        if (completedTaskListText.length > 0) {
            summaryStatusAboutTask += '<b>Завершенные задачи:</b> \n' + completedTaskListText + '\n'
        }

        if (summaryStatusAboutTask.length > 0) {
            await sendPlainTextToChatInHTMLFormat(chatId, summaryStatusAboutTask);
        } else {
            await sendPlainTextToChatInHTMLFormat(chatId, 'Нет активных или выполненных задач');
        }

    } catch (e) {
        // todo log
        await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
    }
}

export async function onMessageEnteredText(msg) {
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
        userData.conversationState = USER_CONVERSATION_STATES.SET_HOUR_RATE;
        await tellUserEnterHourRate(userData);
    }
}

async function userMakeDocsReply(msg, userData) {
    await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Твои документы еще в процессе подготовки и подписания. ' +
        '\nМы свяжемся с тобой по документам, если еще не связались. Либо сообщим о статусе ' +
        'твоего допуска к выполнению работ');
}

async function userApprovedReply(msg, userData) {
    switch (userData.conversationState) {
        case USER_CONVERSATION_STATES.UPD_HOUR_RATE:
            await userEnteredHourRate(msg, userData);
            break;

        case USER_CONVERSATION_STATES.SET_JOB_ESTIMATION_TIME:
            await userEnteredJobEstimationTime(msg, userData);
            break;

        case USER_CONVERSATION_STATES.SET_JOB_REAL_TIME:
            await userEnteredRealTimeForJob(msg, userData);
            break;

        default:
            await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Открой меню чтобы просмотреть и изменить информацию');
            break;
    }

}

async function userRejectedReply(msg, userData) {
    await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Сейчас у тебя нет доступа к платформе и заданиям');
}


async function tellUserEnterName(userData) {
    userData.conversationState = USER_CONVERSATION_STATES.SET_NAME;
    await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Для начала введи свое имя и фамилию: ');

}

async function userEnteredName(msg, userData) {
    const enteredName = msg.text;
    if (enteredName.length <= 3) {
        await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Имя и фамилия должны быть больше 3 символов. Введите еще раз:');


    } else {
        const fields = {
            [USERS_TABLE_COLUMNS.NAME]: enteredName
        };

        Base.updateFieldsInTable(TABLE_NAMES.USERS, userData.airtableId, fields)
            .then(record => {

                userData.name = record.fields[USERS_TABLE_COLUMNS.NAME]
                tellUserEnterPortfolio(userData);
            })
            .catch(async err => {
                //todo log
                await sendPlainTextToChatInHTMLFormat(userData.chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
            })
    }
}


async function tellUserEnterPortfolio(userData) {
    await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Укажи одну ссылку на свое портфолио.' +
        'Это может быть страница Behance, Notion, личный сайт или любая другая ссылка на собранные работы');

    userData.conversationState = USER_CONVERSATION_STATES.SET_PORTFOLIO;
}

async function userEnteredPortfolio(msg, userData) {
    const enteredPortfolioLink = msg.text;
    const countOfLink = (enteredPortfolioLink.match(/http/g) || []).length;
    if (countOfLink === 0) {
        await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Кажется введена не корректная ссылка. Укажи еще раз полную ссылку:');

    } else if (countOfLink > 1) {
        await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Указано более одной ссылки. Пришли еще раз одну ссылку на все свое портфолио.' +
            ' Если тебе нужно собрать несколько ссылок вместе, сделать страницу в Notion и пришли на нее единую ссылку');

    } else {

        const fields = {
            [USERS_TABLE_COLUMNS.PORTFOLIO]: enteredPortfolioLink
        };

        Base.updateFieldsInTable(TABLE_NAMES.USERS, userData.airtableId, fields)
            .then(record => {
                userData.portfolio = record.fields[USERS_TABLE_COLUMNS.PORTFOLIO]
                userData.conversationState = USER_CONVERSATION_STATES.SET_HOUR_RATE;
                tellUserEnterHourRate(userData);

            })
            .catch(async err => {
                //todo log
                await sendPlainTextToChatInHTMLFormat(userData.chatId, DEFAULT_ERROR_MESSAGE_TO_USER);

            })
    }
}


async function tellUserEnterHourRate(userData) {
    await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Укажи свою часовую ставку в рублях. ' +
        'Введи число без каких-либо символов, с точностью до рубля.' +
        '\n\nВ будущем ее можно будет изменять в профиле, но при откликах на задачи мы будем рассматривать ' +
        'твою текущую ставку в час, укаанную в профиле');
}

async function tellUserEnterEstimationTime(userData) {
    await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Укажи максимальную оценку в часах для задачи.\n' +
        'По рзавершению работ, если мы тебя выберем под задачу, можно будет указать реально затраченные часы. Но мы оплатим' +
        'не более текущей максимальной оценки');
}

async function tellUserEnterRealTime(userData) {
    await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Укажи, сколько часов ты потратил на задачу:');
}

async function userEnteredHourRate(msg, userData) {
    const enteredRate = msg.text;
    const enteredRateInt = parseInt(enteredRate.replace(' ', ''));

    if (!enteredRateInt || enteredRateInt < 10) {
        await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Введена некорректная ставка. \nУкажи еще раз свою часовую ставку в рублях (числом):');

    } else {
        const fields = {
            [USERS_TABLE_COLUMNS.HOUR_RATE]: enteredRateInt,
            [USERS_TABLE_COLUMNS.TELEGRAM]: msg.chat.username.toString(), // upd if it changes on that step
        };

        if (userData.conversationState === USER_CONVERSATION_STATES.SET_HOUR_RATE) {
            fields[USERS_TABLE_COLUMNS.STATUS] = USER_STATUSES.MAKE_DOCS;
        }

        Base.updateFieldsInTable(TABLE_NAMES.USERS, userData.airtableId, fields)
            .then(async record => {
                userData.hourRate = record.fields[USERS_TABLE_COLUMNS.HOUR_RATE]
                userData.telegramUsername = record.fields[USERS_TABLE_COLUMNS.TELEGRAM]; // upd if it changes on that step

                userData.conversationState = null;
                if (userData.conversationState === USER_CONVERSATION_STATES.SET_HOUR_RATE) {
                    userData.status = USER_STATUSES.MAKE_DOCS;


                    await informUserAboutNewStatus(userData);

                } else {
                    await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Часовая ставка обновлена');
                }

            })
            .catch(async err => {
                //todo log
                await sendPlainTextToChatInHTMLFormat(userData.chatId, DEFAULT_ERROR_MESSAGE_TO_USER);

            })
    }
}

async function userEnteredRealTimeForJob(msg, userData) {
    const enteredRate = msg.text;
    const enteredRateInt = parseInt(enteredRate.replace(' ', ''));

    if (!enteredRateInt || enteredRateInt < 0) {
        await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Введено некорректное число. \nВведи еще раз количество затраченных на задачу часов:');

    } else {
        const fields = {
            [JOBS_EXECUTIONS_TABLE_COLUMNS.REAL_HOUR]: enteredRateInt
        };

        const completedJobExecutionRecordId = userData.completedJobExecutionAirtableId;
        if (!completedJobExecutionRecordId) {
            await sendPlainTextToChatInHTMLFormat(userData.chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
            return;
        }

        const jobExecutionRecord = await updateFieldsInTable(TABLE_NAMES.JOBS_EXECUTIONS, completedJobExecutionRecordId, fields);
        if (jobExecutionRecord) {

            userData.completedJobExecutionAirtableId = 0;
            await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Записали. Данная задача учтена для получения выплат. ' +
                '\nТеперь оцени, пожалуйста, работу лида по задаче');

            const leadScoreMessageTitle = "<b>Как ты оцениваешь артдирекшн лида?</b>";

            const options = {
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [{
                            text: '1 - Ужасно',
                            callback_data: JSON.stringify({
                                action: OPTION_BUTTON_ACTION.LEAD_DIRECTION_SCORE,
                                id: completedJobExecutionRecordId,
                                score: 1,
                            })
                        }, {
                            text: '2',
                            callback_data: JSON.stringify({
                                action: OPTION_BUTTON_ACTION.LEAD_DIRECTION_SCORE,
                                id: completedJobExecutionRecordId,
                                score: 2,
                            })
                        }, {
                            text: '3',
                            callback_data: JSON.stringify({
                                action: OPTION_BUTTON_ACTION.LEAD_DIRECTION_SCORE,
                                id: completedJobExecutionRecordId,
                                score: 3
                            })
                        }, {
                            text: '4',
                            callback_data: JSON.stringify({
                                action: OPTION_BUTTON_ACTION.LEAD_DIRECTION_SCORE,
                                id: completedJobExecutionRecordId,
                                score: 4
                            })
                        }, {
                            text: '5',
                            callback_data: JSON.stringify({
                                action: OPTION_BUTTON_ACTION.LEAD_DIRECTION_SCORE,
                                id: completedJobExecutionRecordId,
                                score: 5
                            })
                        }],
                        [{
                            text: '6',
                            callback_data: JSON.stringify({
                                action: OPTION_BUTTON_ACTION.LEAD_DIRECTION_SCORE,
                                id: completedJobExecutionRecordId,
                                score: 6
                            })
                        }, {
                            text: '7',
                            callback_data: JSON.stringify({
                                action: OPTION_BUTTON_ACTION.LEAD_DIRECTION_SCORE,
                                id: completedJobExecutionRecordId,
                                score: 7
                            })
                        }, {
                            text: '8',
                            callback_data: JSON.stringify({
                                action: OPTION_BUTTON_ACTION.LEAD_DIRECTION_SCORE,
                                id: completedJobExecutionRecordId,
                                score: 8
                            })
                        }, {
                            text: '9',
                            callback_data: JSON.stringify({
                                action: OPTION_BUTTON_ACTION.LEAD_DIRECTION_SCORE,
                                id: completedJobExecutionRecordId,
                                score: 9
                            })
                        }, {
                            text: '10',
                            callback_data: JSON.stringify({
                                action: OPTION_BUTTON_ACTION.LEAD_DIRECTION_SCORE,
                                id: completedJobExecutionRecordId,
                                score: 10
                            })
                        }],
                    ]
                }),
                parse_mode: 'HTML' // Set parse mode to HTML
            };

            await sendTextWithOptionsToChat(userData.chatId, leadScoreMessageTitle, options);

        } else {
            await sendPlainTextToChatInHTMLFormat(userData.chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
            // todo log
        }
    }
}

export async function startWorkWithNewUser(msg) {
    const chatId = msg.chat.id;

    try {
        const fields = {
            [USERS_TABLE_COLUMNS.CHAT_ID]: chatId.toString(),
            [USERS_TABLE_COLUMNS.TELEGRAM]: msg.chat.username.toString(),
        };

        const airtableRecord = await Base.createRecordInTable(TABLE_NAMES.USERS, fields);
        if (!airtableRecord) {
            // todo log
            await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
            return;
        }

        let userData = {};
        userData.chatId = chatId;
        userData.airtableId = airtableRecord.id;
        userData.telegramUsername = airtableRecord.fields[USERS_TABLE_COLUMNS.TELEGRAM];
        userData.status = USER_STATUSES.NEW_USER;

        usersDataCash[chatId] = userData;
        await tellUserEnterName(userData);

    } catch (e) {
        // todo log
        await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
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

    await sendTextWithOptionsToChat(userData.chatId, htmlJobDescription, options);
}

async function userEnteredJobEstimationTime(msg, userData) {
    const enteredTime = msg.text;
    const enteredTimeInt = parseInt(enteredTime.replace(' ', ''));

    if (!enteredTimeInt || enteredTimeInt <= 0) {
        await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Введено некорректное время. \nУкажи в часах максимлаьную оценку в часах на задачу:');

    } else {
        const jobResponseField = {
            [JOBS_EXECUTIONS_TABLE_COLUMNS.USER_ID]: [userData.airtableId],
            [JOBS_EXECUTIONS_TABLE_COLUMNS.JOB]: [userData.selectedJobAirtableId],
            [JOBS_EXECUTIONS_TABLE_COLUMNS.ESTIMATION_HOUR]: [enteredTimeInt],
        };
        const jobResponseRecord = await createRecordInTable(TABLE_NAMES.JOBS_EXECUTIONS, jobResponseField);

        if (jobResponseRecord) {
            userData.selectedJobAirtableId = null;
            await sendPlainTextToChatInHTMLFormat(userData.chatId, 'Отклик отправлен. Позже мы сообщим о том, будем ли работать по ' +
            'задаче с тобой или выбрали кого-то другого');
        }
    }
}


async function userSetLeadDirectionScore(chatId, responseData, callbackQuery) {
    const jobExecutionAirtableId = responseData.id;
    const score = responseData.score;

    if (!jobExecutionAirtableId || !score) {
        // todo log
        await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
        return;
    }

    const fields = {
        [JOBS_EXECUTIONS_TABLE_COLUMNS.LEAD_DIRECTION_SCORE]: score,
    };
    const updatedRecord = await updateFieldsInTable(TABLE_NAMES.JOBS_EXECUTIONS, jobExecutionAirtableId, fields);
    if (updatedRecord) {
        await sendPlainTextToChatInHTMLFormat(chatId, "Оценка сохранена. Теперь оцени коммуникацию лида");
        await editMessageReplyMarkup(chatId, callbackQuery.message.message_id, []);

        const completedJobExecutionRecordId = updatedRecord.id;
        const leadScoreMessageTitle = "<b>Как ты оцениваешь коммуникацию лида?</b>";

        const options = {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [{
                        text: '1 - Ужасно',
                        callback_data: JSON.stringify({
                            action: OPTION_BUTTON_ACTION.LEAD_COMMUNICATION_SCORE,
                            id: completedJobExecutionRecordId,
                            score: 1
                        })
                    }, {
                        text: '2',
                        callback_data: JSON.stringify({
                            action: OPTION_BUTTON_ACTION.LEAD_COMMUNICATION_SCORE,
                            id: completedJobExecutionRecordId,
                            score: 2
                        })
                    }, {
                        text: '3',
                        callback_data: JSON.stringify({
                            action: OPTION_BUTTON_ACTION.LEAD_COMMUNICATION_SCORE,
                            id: completedJobExecutionRecordId,
                            score: 3
                        })
                    }, {
                        text: '4',
                        callback_data: JSON.stringify({
                            action: OPTION_BUTTON_ACTION.LEAD_COMMUNICATION_SCORE,
                            id: completedJobExecutionRecordId,
                            score: 4
                        })
                    }, {
                        text: '5',
                        callback_data: JSON.stringify({
                            action: OPTION_BUTTON_ACTION.LEAD_COMMUNICATION_SCORE,
                            id: completedJobExecutionRecordId,
                            score: 5
                        })
                    }],
                    [{
                        text: '6',
                        callback_data: JSON.stringify({
                            action: OPTION_BUTTON_ACTION.LEAD_COMMUNICATION_SCORE,
                            id: completedJobExecutionRecordId,
                            score: 6
                        })
                    }, {
                        text: '7',
                        callback_data: JSON.stringify({
                            action: OPTION_BUTTON_ACTION.LEAD_COMMUNICATION_SCORE,
                            id: completedJobExecutionRecordId,
                            score: 7
                        })
                    }, {
                        text: '8',
                        callback_data: JSON.stringify({
                            action: OPTION_BUTTON_ACTION.LEAD_COMMUNICATION_SCORE,
                            id: completedJobExecutionRecordId,
                            score: 8
                        })
                    }, {
                        text: '9',
                        callback_data: JSON.stringify({
                            action: OPTION_BUTTON_ACTION.LEAD_COMMUNICATION_SCORE,
                            id: completedJobExecutionRecordId,
                            score: 9
                        })
                    }, {
                        text: '10',
                        callback_data: JSON.stringify({
                            action: OPTION_BUTTON_ACTION.LEAD_COMMUNICATION_SCORE,
                            id: completedJobExecutionRecordId,
                            score: 10
                        })
                    }],
                ]
            }),
            parse_mode: 'HTML' // Set parse mode to HTML
        };

        await sendTextWithOptionsToChat(chatId, leadScoreMessageTitle, options);


    } else {
        await sendPlainTextToChatInHTMLFormat(chatId, 'Не удалось сохранить оценку');
    }
}

async function userSetLeadCommunicationScore(chatId, responseData, callbackQuery) {
    const jobExecutionAirtableId = responseData.id;
    const score = responseData.score;

    if (!jobExecutionAirtableId || !score) {
        // todo log
        await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
        return;
    }

    const fields = {
        [JOBS_EXECUTIONS_TABLE_COLUMNS.LEAD_COMMUNICATION_SCORE]: score,
    };
    const updatedRecord = await updateFieldsInTable(TABLE_NAMES.JOBS_EXECUTIONS, jobExecutionAirtableId, fields);
    if (updatedRecord) {
        await sendPlainTextToChatInHTMLFormat(chatId, 'Данные сохранены, спасибо');
        await editMessageReplyMarkup(chatId, callbackQuery.message.message_id, []);

    } else {
        await sendPlainTextToChatInHTMLFormat(chatId, 'Не удалось сохранить оценку');
    }
}

export async function callbackHandler(callbackQuery) {
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
            await responseToJobCallbackHandler(chatId, responseData, callbackQuery);
            break;

        case OPTION_BUTTON_ACTION.CHANGE_RATE:
            await sayUserChangeRate(chatId);
            break;

        case OPTION_BUTTON_ACTION.REQUEST_MONEY:
            await requestMoneyForUser(chatId, responseData, callbackQuery);
            break;

        case OPTION_BUTTON_ACTION.LEAD_DIRECTION_SCORE:
            await userSetLeadDirectionScore(chatId, responseData, callbackQuery);
            break;

        case OPTION_BUTTON_ACTION.LEAD_COMMUNICATION_SCORE:
            await userSetLeadCommunicationScore(chatId, responseData, callbackQuery);
            break;
    }
}


async function responseToJobCallbackHandler(chatId, responseData, callbackQuery) {
    const jobAirtableId = responseData.jobId;

    try {
        const jobRecord = await findRecordInTableById(TABLE_NAMES.JOBS, jobAirtableId);
        if (jobRecord) {
            if (jobRecord.fields[JOBS_TABLE_COLUMNS.STATUS] === JOBS_STATUSES.OPEN) {

                const userData = usersDataCash[chatId];
                if (userData && userData.status === USER_STATUSES.APPROVED) {

                    userData.selectedJobAirtableId = jobAirtableId;
                    userData.conversationState = USER_CONVERSATION_STATES.SET_JOB_ESTIMATION_TIME;
                    await tellUserEnterEstimationTime(userData);

                } else {
                    await sendPlainTextToChatInHTMLFormat(chatId, "Кажется у тебя еще нет доступа для отклика на задачи");
                }

            } else {
                //todo console
                await sendPlainTextToChatInHTMLFormat(chatId, "Срок отклика истек или мы уже закрыли запрос на задачу");
            }
        }

        // remove buttons
        await editMessageReplyMarkup(chatId, callbackQuery.message.message_id, []);

    } catch (e) {
        //todo log
        await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
    }
}

async function sayUserChangeRate(chatId) {
    const userData = usersDataCash[chatId];
    if (!userData) {
        return;
    }

    userData.conversationState = USER_CONVERSATION_STATES.UPD_HOUR_RATE;
    await tellUserEnterHourRate(userData);
}

async function requestMoneyForUser(chatId, responseData, callbackQuery) {
    const userData = usersDataCash[chatId];
    if (!userData) {
        //todo log
        //todo find and create
        return;
    }

    try {
        const userRecord = await findRecordInTableById(TABLE_NAMES.USERS, userData.airtableId);
        if (!userRecord) {
            // todo log
            await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
            return;
        }

        // check available money
        const availableMoney = userRecord.fields[USERS_TABLE_COLUMNS.MONEY_AVAILABLE];
        if (availableMoney && availableMoney > 0) {
            const moneyRequestField = {
                [PAYMENTS_TABLE_COLUMNS.USER]: [userData.airtableId],
                [PAYMENTS_TABLE_COLUMNS.PAYMENT_AMOUNT]: availableMoney,
            };
            const paymentRecord = await createRecordInTable(TABLE_NAMES.PAYMENTS, moneyRequestField);

            if (paymentRecord) {
                await sendPlainTextToChatInHTMLFormat(chatId, 'Запрос на выплату отправлен');
            } else {
                await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
            }

        } else {
            await sendPlainTextToChatInHTMLFormat(chatId, 'Все деньги за закрытые задачи выплачены');
        }

    } catch (e) {
        // todo log
        await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
    }
}


export async function informUserAboutNewStatus(userData) {
    switch (userData.status) {

        case USER_STATUSES.MAKE_DOCS:
            await sendPlainTextToChatInHTMLFormat(userData.chat_id, 'Нужно подписать документы. Мы свяжемся с тобой в ' +
                'личных сообщениях в ближайшие рабочие дни');
            break;

        case USER_STATUSES.APPROVED:
            await sendPlainTextToChatInHTMLFormat(userData.chat_id, 'Доступ открыт. Теперь ты будешь получать все задачи');
            break;

        case USER_STATUSES.REJECTED:
            await sendPlainTextToChatInHTMLFormat(userData.chat_id, 'Доступ заблокирован');
            break;
    }
}

export async function informUserAboutJobExecutionNewStatus(jobExecutionRecord) {
    const chatIdArray = jobExecutionRecord.fields[JOBS_EXECUTIONS_TABLE_COLUMNS.USER_CHAT_ID];
    const chatId = chatIdArray ? chatIdArray[0] : null;
    try {
        const userData = usersDataCash[chatId];
        const newStatus = jobExecutionRecord.fields[JOBS_EXECUTIONS_TABLE_COLUMNS.STATUS];

        if (!chatId || !userData || !newStatus) {
            return;
        }

        const infoTitleAboutTask = '<b>Изменился статус по задаче \"'
            + jobExecutionRecord.fields[JOBS_EXECUTIONS_TABLE_COLUMNS.TASK_NAME] + '\":</b>\n'


        switch (newStatus) {
            case JOBS_EXECUTION_STATUSES.IN_PROGRESS:
                await sendPlainTextToChatInHTMLFormat(chatId, infoTitleAboutTask + "Ты выбран испонителем. Скоро сы свяжемся с тобой для начала работ");
                break;

            case JOBS_EXECUTION_STATUSES.STUDIO_REFUSED:
                await sendPlainTextToChatInHTMLFormat(chatId, infoTitleAboutTask + "Студия прекратила работу с тобой по задаче. Лид напишет тебе по деталям");
                break;

            case JOBS_EXECUTION_STATUSES.USER_REFUSED:
                await sendPlainTextToChatInHTMLFormat(chatId, infoTitleAboutTask + "Отказ от задачи по твоей инициативе");
                break;

            case JOBS_EXECUTION_STATUSES.COMPLETED:
                await sendPlainTextToChatInHTMLFormat(chatId, infoTitleAboutTask + "Задача успешно выполнена и закрыта");
                userData.conversationState = USER_CONVERSATION_STATES.SET_JOB_REAL_TIME;
                userData.completedJobExecutionAirtableId = jobExecutionRecord.id;
                await tellUserEnterRealTime(userData);

                break;
        }

        // refresh changes mark
        await updateFieldsInTable(TABLE_NAMES.JOBS_EXECUTIONS, jobExecutionRecord.id, {
            [JOBS_EXECUTIONS_TABLE_COLUMNS.STATUS_CHANGED]: false
        })

    } catch (e) {
        //todo log
        await sendPlainTextToChatInHTMLFormat(chatId, DEFAULT_ERROR_MESSAGE_TO_USER);
    }
}