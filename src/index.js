const TelegramBot = require('node-telegram-bot-api');
const Airtable = require('airtable');

const bot = new TelegramBot('7115871048:AAEf2jTqg13L0xxBeDPbaq5VnArvOeNYUjo', { polling: true });
const base = new Airtable({ apiKey: 'patyjyp3D51sr4Xbc.105a1158dc0342d7ba6cb59261f1293162a3f6173626b53cefd388da973adc86' }).base('apppEZ9COxjPRpdCL');

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
    // Stop the bot gracefully
    bot.stopPolling();
});


// MAIN CODE


// Handle the /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    // Define the inline keyboard markup with multi-select options
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Option 1', callback_data: 'option1' }],
                [{ text: 'Option 2', callback_data: 'option2' }],
                [{ text: 'Option 3', callback_data: 'option3' }],
                // Add more buttons/options as needed
            ]
        }
    };

    // Send a message with the inline keyboard menu
    bot.sendMessage(chatId, 'Welcome! Please select one or more options:', keyboard);
})

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    console.log('start help');
})

bot.setMyCommands([
    { command: "start", description: "start description" },
    { command: "help", description: "help description"},
    { command: "list", description: "list description"},
]);


// Welcome message with the menu
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const messageText = 'Welcome! Please select one or more options:';

    // Ignore messages with command prefixes
    if (msg.text.startsWith('/') && !msg.text.startsWith('/start') && !msg.text.startsWith('/help')) {
        // Ignore command messages, do not process them
        return;
    }

    // Define the inline keyboard markup with multi-select options
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Option 1', callback_data: 'option1' }],
                [{ text: 'Option 2', callback_data: 'option2' }],
                [{ text: 'Option 3', callback_data: 'option3' }],
                // Add more buttons/options as needed
            ]
        }
    };

    // Send a message with the inline keyboard menu
    bot.sendMessage(chatId, messageText, keyboard);
});

// Handle button clicks
bot.on('callback_query', (query) => {
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
            [{ text: 'Option 1', callback_data: 'option1', switch_inline_query_current_chat: selectedOptions.includes('option1') }],
            [{ text: 'Option 2', callback_data: 'option2', switch_inline_query_current_chat: selectedOptions.includes('option2') }],
            [{ text: 'Option 3', callback_data: 'option3', switch_inline_query_current_chat: selectedOptions.includes('option3') }],
            // Add more buttons/options as needed
        ]
    };

    // Edit the message to update the inline keyboard with the new selection
    bot.editMessageReplyMarkup(updatedMarkup, {
        chat_id: chatId,
        message_id: query.message.message_id
    });
});




// Fetch records from the specified table where the checkbox field is checked
base('Users').select({
    filterByFormula: `{Level} = 'L1'`, // Assuming '1' represents checked in Airtable
    // Optionally specify parameters here, such as fields to retrieve
    // For example: fields: ['Name', 'Email']
}).all()
    .then(records => {
        // Process fetched records
        records.forEach(record => {
            console.log('Retrieved:', record.id, record.fields);
        });
    })
    .catch(err => {
        console.error('Error fetching records:', err);
    });