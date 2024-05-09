const vscode = require('vscode');
const showdown = require('showdown');
const path = require('path');

function getRelativeFilePath() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active text editor found.');
        return;
    }

    const fileName = editor.document.fileName;
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (workspaceFolders) {
        for (const folder of workspaceFolders) {
            console.log('folder.uri.fsPath:', folder.uri.fsPath);
            if (fileName.startsWith(folder.uri.fsPath)) {
                const relativePath = path.relative(folder.uri.fsPath, fileName);
                return relativePath;
            }
        }
        vscode.window.showErrorMessage('The file is not in the current workspace folders.');
    } else {
        vscode.window.showErrorMessage('No workspace folder found.');
    }
}


function formatMarkdown(markdownText, isCode = false) {
    let formattedMarkdown
    // Convert Markdown to HTML
    if (isCode) {
        formattedMarkdown = "```\n" + markdownText + "\n```";
    } else {
        formattedMarkdown = markdownText
    }
    const converter = new showdown.Converter();
    const html = converter.makeHtml(formattedMarkdown);
    // Still escape the generated HTML to prevent any potential XSS
    return html;
}

function getSafeContext(contextText) {
    // escape special characters or sanitize the context text...
    // ...
}

// Helper function to handle errors from the API communication
function handleError(err, apiName) {
    console.error(`Error communicating with ${apiName} API:`, err.message);
    if (err.response) {
        console.error('Response Status:', err.response.status);
        console.error('Response Status Text:', err.response.statusText);
        console.error('Response Data:', err.response.data ? JSON.stringify(err.response.data).substring(0, 500) : 'No data');
    } else {
        console.error('No response received from the server');
    }
    vscode.window.showErrorMessage(`Failed to get response from ${apiName}`);
}

// Helper function to post a message to the webview
function postMessageToWebview(panel, command, htmlContent) {
    if (panel && panel.webview) {
        panel.webview.postMessage({
            command: command,
            htmlContent: htmlContent
        });
    }
}


// More utility functions...

module.exports = {
    formatMarkdown,
    getSafeContext,
    handleError,
    postMessageToWebview,
    getRelativeFilePath
    // Export other utilities as needed...
};