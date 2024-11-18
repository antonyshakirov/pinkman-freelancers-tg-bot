import {
    JOBS_EXECUTION_STATUSES,
    JOBS_EXECUTIONS_TABLE_COLUMNS,
    JOBS_TABLE_COLUMNS,
    TABLE_NAMES,
    USERS_TABLE_COLUMNS,
    usersDataCash
} from "./main.js";

import Airtable from 'airtable';
import {
    sendNewJobToUsers,
    informUserAboutJobExecutionNewStatus,
    applyUserNewStatus, startWorkWithInputJobEstimationTime
} from "./bot-actions.js";

export let isTestMode = process.env.IS_TEST === 'true';
const baseApiKey = isTestMode ? 'patyjyp3D51sr4Xbc.105a1158dc0342d7ba6cb59261f1293162a3f6173626b53cefd388da973adc86' : 'patyjyp3D51sr4Xbc.105a1158dc0342d7ba6cb59261f1293162a3f6173626b53cefd388da973adc86';
const baseId = isTestMode ? 'appLgnXHx5wVfGzdy' : 'apppEZ9COxjPRpdCL';
export const base = new Airtable({apiKey: baseApiKey}).base(baseId);


export async function initUserDataByBase() {
    try {
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

    } catch (e) {
        console.error(e);
    }
}

export async function initBase() {
    try {
        await sendNewJobsToUsers();
        setInterval(async () => {
            await sendNewJobsToUsers();
        }, 1 * 60 * 1000); // each 1 minutes

        await checkUserStatusUpdates();
        setInterval(async () => {
            await checkUserStatusUpdates();
        }, 1 * 60 * 1000); // each 1 minutes

        await checkJobExecutionsStatusUpdates();
        setInterval(async () => {
            await checkJobExecutionsStatusUpdates();
        }, 1.5 * 60 * 1000); // each 1.5 minutes

        /**
        await checkJobExecutionsWithoutEstimationTime();
        setInterval(async () => {
            await checkJobExecutionsWithoutEstimationTime();
        }, 1.5 * 60 * 1000); // each 1.5 minutes
        */

    } catch (e) {
        console.error(e);
    }
}


async function sendNewJobsToUsers() {
    try {
        const findJobsSelectFormula = `NOT({${JOBS_TABLE_COLUMNS.JOB_WAS_SEND}},'true')`
        const newJobs = await selectRecordsInTable(TABLE_NAMES.JOBS, findJobsSelectFormula);

        newJobs.forEach(jobRecord => {
            sendNewJobToUsers(jobRecord);
        })

    } catch (e) {
        console.error(e);
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
        console.error(e);
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

        for (const jobExecutionRecord of jobExecutionsWithUpdatedStatus) {
            await informUserAboutJobExecutionNewStatus(jobExecutionRecord);
        }

        // when user don't input real time after server reload
        const findCompletedJobExecutionSelectFormula = `AND({${JOBS_EXECUTIONS_TABLE_COLUMNS.STATUS}} = '${JOBS_EXECUTION_STATUSES.COMPLETED}',
         NOT({${JOBS_EXECUTIONS_TABLE_COLUMNS.REAL_HOUR}}),
         NOT({${JOBS_EXECUTIONS_TABLE_COLUMNS.STATUS_CHANGED}}))`;
        const completedJobExecutionsWithoutRealTime = await selectRecordsInTable(TABLE_NAMES.JOBS_EXECUTIONS, findCompletedJobExecutionSelectFormula);

        for (const jobExecutionRecord of completedJobExecutionsWithoutRealTime) {
            await informUserAboutJobExecutionNewStatus(jobExecutionRecord);
        }

    } catch (e) {
        console.error(e);
    }
}

async function checkJobExecutionsWithoutEstimationTime() {
    try {
        const findJobExecutionsSelectFormula = `NOT({${JOBS_EXECUTIONS_TABLE_COLUMNS.ESTIMATION_HOUR}})`
        const jobExecutionRecords = await selectRecordsInTable(TABLE_NAMES.JOBS_EXECUTIONS, findJobExecutionsSelectFormula);

        for (const jobExecutionRecord of jobExecutionRecords) {
            await startWorkWithInputJobEstimationTime(
                jobExecutionRecord.fields[JOBS_EXECUTIONS_TABLE_COLUMNS.USER_CHAT_ID],
                null,
                jobExecutionRecord.id,
                jobExecutionRecord.fields[JOBS_EXECUTIONS_TABLE_COLUMNS.JOB_NAME]
            );
        }

    } catch (e) {
        console.error(e);
    }
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