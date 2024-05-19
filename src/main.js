import * as Bot from "./bot.js";
import * as Base from "./base.js";


import HTTP from "http";
import {botIsWorking} from "./bot.js";
import {log} from "./util.js";

export const usersDataCash = {}; // user data by ChatId

export const TABLE_NAMES = {
    USERS: 'Пользователи',
    JOBS: 'Задачи',
    JOBS_EXECUTIONS: 'Отклики по задачам',
    PAYMENTS: 'Оплаты',
}

export const USER_CONVERSATION_STATES = {
    SET_NAME: 'setName',
    SET_PORTFOLIO: 'setPortfolio',
    SET_HOUR_RATE: 'setHourRate',
    UPD_HOUR_RATE: 'updHourRate',
    SET_JOB_ESTIMATION_TIME: 'setJobEstimationTime',
    SET_JOB_REAL_TIME: 'setJobRealTime',
};

export const USER_STATUSES = {
    NEW_USER: 'Новый пользователь',
    WAITING_APPROVE: 'Рассмотрение допуска к работе',
    APPROVED: 'Допущен к задачам',
    REJECTED: 'Заявка отклонена',
};

export const USERS_TABLE_COLUMNS = {
    NAME: 'Имя и Фамилия',
    STATUS: 'Статус',
    PORTFOLIO: 'Ссылка на портфолио',
    HOUR_RATE: 'Часовая ставка',
    COUNT_COMPLETED_TASK: '(auto) Количество выполненных задач',
    MONEY_AVAILABLE: '(auto) Сколько не выплачено за готовые работы',
    CHAT_ID: '(auto) ChatId',
    TELEGRAM: '(auto) Telegram',
    STATUS_CHANGED: '(auto) Статус изменился',
}

export const JOBS_TABLE_COLUMNS = {
    STATUS: 'Статус задачи',
    NAME: 'Название задачи',
    DESCRIPTION: 'Подробное описание задачи',
    DEADLINE_DATE: 'Крайняя дата рассмотрения откликов',
    JOB_WAS_SEND: '(auto) Задача отправлена пользователям',
}

export const JOBS_STATUSES = {
    OPEN: 'Публикация и подбор специалистов',
}

export const JOBS_EXECUTIONS_TABLE_COLUMNS = {
    USER_RECORD_ID: '(auto) UserID',
    JOB_RECORD_ID: 'Задача',
    JOB_NAME: '(auto) Название задачи',
    STATUS: 'Статус',
    TASK_NAME: '(auto) Название задачи',
    ESTIMATION_HOUR: 'Оценка в часах (максимум)',
    REAL_HOUR: 'Фактическое количество часов',
    LEAD_DIRECTION_SCORE: 'Артдирекшен лида',
    LEAD_COMMUNICATION_SCORE: 'Оценка коммуникации лида',
    STATUS_CHANGED: '(auto) Статус изменился',
    USER_CHAT_ID: '(auto) ChatId',
}

export const JOBS_EXECUTION_STATUSES = {
    NEW: 'Публикация и подбор специалистов',
    IN_PROGRESS: 'В процессе работ',
    STUDIO_REFUSED: 'Отказались по нашей причине',
    USER_REFUSED: 'Исполнитель отказался',
    COMPLETED: 'Задача выполнена и закрыта',

}

export const PAYMENTS_TABLE_COLUMNS = {
    USER: 'Пользователь',
    PAYMENT_AMOUNT: 'Сумма оплаты',
}

export const OPTION_BUTTON_ACTION = {
    APPROVE_SERVICE_CONDITIONS: 'approveServiceConditions',
    JOB_RESPONSE: 'jobResponse',
    CHANGE_RATE: 'changeRate',
    REQUEST_MONEY: 'requestMoney',
    LEAD_DIRECTION_SCORE: 'dirScore',
    LEAD_COMMUNICATION_SCORE: 'commScore',
}

export const DEFAULT_ERROR_MESSAGE_TO_USER = 'Что-то пошло не так. Попробуй еще раз или обратись в поддержку через команду /help';
export const DEFAULT_MESSAGE_ABOUT_QUESTION_ABOVE = 'Введи ответ на вопрос выше:';


export async function initializeServer() {
    try {
        log.info('Start initialize server');

        await Base.initUserDataByBase();
        await Base.initBase();
        await Bot.initBot();

        log.info('Server was initialized');

    } catch (error) {
        log.error('Server initialization error: ', error);
    }
}

// check server
const port = 3000;
const server = HTTP.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health' && botIsWorking) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({status: 'ok'}));

    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Not Found\n');
    }
});

server.listen(port, () => {
    log.info("Server HTTP running at port " + port);
});
