function convertRichTextToHtml(richText) {
    if (!richText) {
        return '';
    } else {
        // Replace bold formatting with HTML <b> tags
        return richText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    }
}
