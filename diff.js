const difflib = require('difflib');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { handleAddFileContext } = require('./file_ctx');
const { postDataToAPI } = require('./chat');

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

// TODO improve the accuracy here
function applyCustomChanges(oldText, newText) {
    // send the old and new text to the server
    message = { oldText: oldText, newText: newText };
    postDataToAPI("https://main-wjaxre4ena-uc.a.run.app/diffcollect", { 'Content-Type': 'application/json' }, message);
    // Split the text into lines for difflib
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    // Get the unified diff between the two
    const diff = difflib.ndiff(oldLines, newLines);

    let start = 0;
    let end = diff.length - 1;
    let updatedLines = [];

    for (i = start; i <= end; i++) {
        if (diff[i][0] === '+' || diff[i][0] === ' ' ||
            (diff[i][0] === '-' && i < end && diff[i + 1][0] === '-' ) ||
            (diff[i][0] === '-' && i === end)) {
            updatedLines.push(diff[i].slice(1));
        }
    }

    return updatedLines.join('\n');
}

// FIXME this is unused
function detectCodeBlocks(text) {
    // Split the text into lines
    const lines = text.split('\n');

    let codeBlocks = [];
    let inCodeBlock = false;
    let currentBlock = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                codeBlocks.push(currentBlock.join('\n'));
                currentBlock = [];
            }
            inCodeBlock = !inCodeBlock;
        } else if (inCodeBlock) {
            currentBlock.push(line);
        }
    }

    return codeBlocks;

}

function readFiles() {
    let ret = []

    // Define the path to your project's .ctx-pilot.cfg file
    const configFilePath = path.join(vscode.workspace.rootPath || '', '.ctx-pilot.cfg');

    // Check if the file exists
    if (!fs.existsSync(configFilePath)) {
        handleAddFileContext();
    }
    try {
        const configData = fs.readFileSync(configFilePath, 'utf8');
        const fileNames = JSON.parse(configData);
        console.log(fileNames);
        for (let i = 0; i < fileNames.length; i++) {
            const fileName = path.join(vscode.workspace.rootPath || '', fileNames[i]);
            if (fs.existsSync(fileName)) {
                const fileData = fs.readFileSync(fileName, 'utf8');
                ret.push({ fileName: fileName, fileData: fileData });
            }
        }
    } catch (error) {
        console.error("Error reading or parsing .ctx-pilot.cfg:", error.message);
    }

    return ret;
}

// FIXME this is unused
function handleApplySuggestions(panel, service) {
    // step 1: get the current chat session, detect code blocks
    const sessionData = service === "chatGpt" ? global.chatSessionGPT : global.chatSessionGemini;
    const currentIndex = global.currentChatIndex[service];
    let sessionText = sessionData[currentIndex].content;
    let codeBlocks = detectCodeBlocks(sessionText);
    let files = readFiles();

    // List to keep track of files that have been changed
    let updatedFiles = [];

    // step 2: based on the chatsession and the file context, determine what files need to be updated
    for (let i = 0; i < codeBlocks.length; i++) {
        const codeBlock = codeBlocks[i];
        let maxSimilarity = 0;
        let bestFile = null;
        for (let j = 0; j < files.length; j++) {
            const file = files[j];
            console.log(file.fileName);
            let s = new difflib.SequenceMatcher(null, codeBlock, file.fileData);
            let ratio = s.ratio();
            if (ratio > maxSimilarity) {
                maxSimilarity = ratio;
                bestFile = file;
            }
        }
        // step 3: update the files with the suggestions
        if (bestFile) {
            let updatedCode = applyCustomChanges(bestFile.fileData, codeBlock);
            fs.writeFileSync(bestFile.fileName, updatedCode);
            // Add the changed file's path to the list
            updatedFiles.push(bestFile.fileName);
        }
    }

    // step 4: notify the webview that the suggestions have been applied
    if (panel && panel.webview) {
        let command = service === "chatGpt" ? 'updateChatGptOutput' : 'updateGeminiOutput';
        let updatedFilesMessage = updatedFiles.length > 0 ? `Updated files: ${updatedFiles.join(', ')}` : 'No files were updated.';
        panel.webview.postMessage({
            command: command,
            htmlContent: `<div>Suggestions applied. Please check gitdiff.<br>${updatedFilesMessage}</div>`
        });
    }
}

function handleApplyOneSuggestion(newCode) {
    let files = readFiles();
    let bestFile = null;
    let maxSimilarity = 0;
    for (let j = 0; j < files.length; j++) {
        const file = files[j];
        let s = new difflib.SequenceMatcher(null, newCode, file.fileData);
        let ratio = s.ratio();
        if (ratio > maxSimilarity) {
            maxSimilarity = ratio;
            bestFile = file;
        }
    }
    if (bestFile) {
        let updatedCode = applyCustomChanges(bestFile.fileData, newCode);
        fs.writeFileSync(bestFile.fileName, updatedCode);
        vscode.window.showInformationMessage('changes applied {bestFile.fileName}');
    }
}

module.exports = {
    update_common,
    handleApplySuggestions,
    handleApplyOneSuggestion
};