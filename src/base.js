import {
    JOBS_EXECUTION_STATUSES,
    JOBS_EXECUTIONS_TABLE_COLUMNS,
    JOBS_TABLE_COLUMNS,
    TABLE_NAMES,
    USERS_TABLE_COLUMNS,
    usersDataCash
} from "./main.js";

import Airtable from 'airtable';
import {informUserAboutNewStatus, sendNewJobToUsers, informUserAboutJobExecutionNewStatus} from "./bot.js";

export const base = new Airtable({apiKey: 'patyjyp3D51sr4Xbc.105a1158dc0342d7ba6cb59261f1293162a3f6173626b53cefd388da973adc86'}).base('apppEZ9COxjPRpdCL');


export async function initUserDataByBase() {
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

export async function initBase() {
    await sendNewJobsToUsers();
    setInterval(() => {
        sendNewJobsToUsers();
    }, 7 * 60 * 1000); // each 7 minutes

    await checkUserStatusUpdates();
    setInterval(() => {
        checkUserStatusUpdates();
    }, 3 * 60 * 1000); // each 3 minutes

    await checkJobExecutionsStatusUpdates();
    setInterval(() => {
        checkJobExecutionsStatusUpdates();
    }, 3.5 * 60 * 1000); // each 3.5 minutes
}


async function sendNewJobsToUsers() {
    try {
        const findJobsSelectFormula = `NOT({${JOBS_TABLE_COLUMNS.JOB_WAS_SEND}},'true')`
        const newJobs = await selectRecordsInTable(TABLE_NAMES.JOBS, findJobsSelectFormula);

        newJobs.forEach(jobRecord => {
            sendNewJobToUsers(jobRecord);
        })

    } catch (e) {
        //todo log
    }
}

async function checkUserStatusUpdates() {
    try {
        const findUsersSelectFormula = `{${USERS_TABLE_COLUMNS.STATUS_CHANGED}} = TRUE()`
        const userWithUpdatedStatuses = await selectRecordsInTable(TABLE_NAMES.USERS, findUsersSelectFormula);

        userWithUpdatedStatuses.forEach(userRecord => {
            updateUserStatus(userRecord);

            // refresh changes mark
            updateFieldsInTable(TABLE_NAMES.USERS, userRecord.id, {
                [USERS_TABLE_COLUMNS.STATUS_CHANGED]: false
            })

        })

    } catch (e) {
        //todo log
    }
}

async function updateUserStatus(userRecord) {
    if (!userRecord) {
        return;
    }

    const userData = usersDataCash[userRecord.fields[USERS_TABLE_COLUMNS.CHAT_ID]];
    const newStatus = userRecord.fields[USERS_TABLE_COLUMNS.STATUS];
    if (!userData || userData.status === newStatus) {
        // nothing to change
        return;
    }

    await applyUserNewStatus(userData, newStatus);
}

async function checkJobExecutionsStatusUpdates() {
    try {
        const findJobExecutionSelectFormula = `{${JOBS_EXECUTIONS_TABLE_COLUMNS.STATUS_CHANGED}} = TRUE()`
        const jobExecutionsWithUpdatedStatus = await selectRecordsInTable(TABLE_NAMES.JOBS_EXECUTIONS, findJobExecutionSelectFormula);

        jobExecutionsWithUpdatedStatus.forEach(jobExecutionRecord => {
            informUserAboutJobExecutionNewStatus(jobExecutionRecord);
        })

    } catch (e) {
        //todo log
    }
}


async function applyUserNewStatus(userData, newStatus) {
    userData.status = newStatus;
    await informUserAboutNewStatus(userData);
}

export async function createRecordInTable(tableName, fieldsData) {
    return base(tableName).create(fieldsData);
}

export async function updateFieldsInTable(tableName, recordId, fieldsData) {
    return await base(tableName).update(recordId, fieldsData);
}

export async function selectRecordsInTable(tableName, selectFormula) {
    return await base(tableName).select({filterByFormula: selectFormula}).all();
}

export async function findRecordInTableById(tableName, rowId) {
    return await base(tableName).find(rowId);
}