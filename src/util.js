export function convertRichTextToHtml(richText) {
    if (!richText) {
        return '';
    } else {
        // Replace bold formatting with HTML <b> tags
        let formattedText = richText.replace(/<em>(.*?)<\/em>/g, '<i>$1</i>');
        formattedText = formattedText.replace(/_(.*?)_/g, '<i>$1</i>');
        formattedText = formattedText.replace(/~~(.*?)~~/g, '<s>$1</s>');
        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        return formattedText;
    }
}

export const log = {
    info: (message) => {
        process.stdout.write(`INFO: ${message}\n`);
    },
    warn: (message) => {
        process.stdout.write(`WARN: ${message}\n`);
    },
    error: (message) => {
        process.stderr.write(`ERROR: ${message}\n`);
    }
};