export function convertRichTextToHtml(richText) {
    if (!richText) {
        return '';
    } else {
        // Replace bold formatting with HTML <b> tags
        return richText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
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