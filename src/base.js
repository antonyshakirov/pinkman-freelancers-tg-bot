const tableName = 'Пользователи';

// Replace 'COLUMN_NAME' with the name of the column you want to search
const searchColumnName = '(auto) ChatId';


// Replace 'SEARCH_VALUE' with the value you want to search for in the column
const searchValue = 123;

// Replace 'UPDATE_COLUMN_NAME' with the name of the column you want to update
const updateColumnName = 'Часовая ставка';

// Replace 'NEW_VALUE' with the new value you want to set for the column
const newValue = '123';

// Define a filter to find the row with the desired value in the specified column
const filterByFormula = `{${searchColumnName}} = '${searchValue}'`;

// Fetch records from Airtable based on the filter

export function runBaseTest() {
    console.log('start run base')
    base(tableName).select({
        filterByFormula: filterByFormula
    }).firstPage((err, records) => {
        if (err) {
            console.error('Error fetching records:', err);
            return;
        }

        // Check if records were retrieved
        if (records.length === 0) {
            console.log('No records found matching the criteria.');
            return;
        }

        // Log the retrieved records
        console.log('Retrieved records:', records);

        // Update just the selected column for the first retrieved record
        const record = records[0];

        // Update the value of the specified column directly
        const fieldsToUpdate = {
            [updateColumnName]: parseInt(newValue)
        };

        // Update only the selected column without affecting computed fields
        record.patchUpdate(fieldsToUpdate, (err) => {
            if (err) {
                console.error('Error updating record:', err);
                return;
            }
            console.log('Record updated successfully:', record.id);
        });
    });
}