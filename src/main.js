import * as Bot from "./bot.js";
import * as Base from "./base.js";

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
    SET_HOUR_RATE: 'setRate',
    UPD_RATE: 'updRate',
    SET_JOB_ESTIMATION_TIME: 'setJobEstimationTime',
    SET_JOB_REAL_TIME: 'setJobRealTime',
};
export const USER_STATUSES = {
    NEW_USER: 'Новый пользователь',
    MAKE_DOCS: 'Подпись документов',
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
    DESCRIPTION: 'Подробное описание задачи',
    DEADLINE_DATE: 'Крайняя дата рассмотрения откликов',
    JOB_WAS_SEND: '(auto) Задача отправлена пользователям',
}

export const JOBS_STATUSES = {
    OPEN: 'Публикация и подбор специалистов',
}

export const JOBS_EXECUTIONS_TABLE_COLUMNS = {
    USER: 'Исполнитель',
    JOB: 'Задача',
    STATUS: 'Статус',
    TASK_NAME: '(auto) Название задачи',
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


export const OPTION_BUTTON_ACTION = {
    JOB_RESPONSE: 'jobResponse',
}

export const DEFAULT_ERROR_MESSAGE_TO_USER = 'Что-то пошло не так. Попробуй еще раз или обратись в поддержку через команду /help';

export async function initializeServer() {
    try {
        await Base.initUserDataByBase();
        await Base.initBase();
        await Bot.initBot();

        console.log("Server was initialized")
        // todo log

    } catch (error) {
        console.error('Initialization error: ', error);
        // todo log
    }
}