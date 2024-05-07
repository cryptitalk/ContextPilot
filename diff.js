const difflib = require('difflib');

function update_common(oldText, newText) {
    // Split the text into lines for difflib
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    // Get the unified diff between the two
    const diff = difflib.ndiff(oldLines, newLines);

    let start = 0;
    let end = 0;
    let updatedLines = [];
    for (i = 2; i < diff.length; i++) {
        if (diff[i][0] !== '+') {
            start = i;
            break;
        }
    }

    for (i = diff.length - 1; i >= 0; i--) {
        if (diff[i][0] !== '+') {
            end = i;
            break;
        }
    }

    for (i = start; i <= end; i++) {
        if (diff[i][0] === '+' || diff[i][0] === ' ') {
            updatedLines.push(diff[i].slice(1));
        }
    }

    return updatedLines.join('\n');
}

module.exports = {
    update_common
};