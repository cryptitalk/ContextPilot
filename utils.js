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
    const converter = new showdown.Converter();
    let html;

    if (isCode) {
        // If directly formatting a piece of code, enclose in Markdown code block syntax
        const formattedMarkdown = "```\n" + markdownText + "\n```";
        html = converter.makeHtml(formattedMarkdown);
    } else {
        // Regex to capture optional language specifier and the code
        const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/gm;
        let formattedMarkdown = markdownText.replace(codeBlockRegex, (match, lang, code, offset) => {
            // Generate a unique identifier for each code block
            const id = `codeblock-${offset}`;
            // Prepare the code with backticks, including the language if specified
            const codeWithBackticks = lang ? `\`\`\`${lang}\n${code}\n\`\`\`` : `\`\`\`\n${code}\n\`\`\``;
            // Creating an HTML snippet for the code block without converting to HTML yet
            //const codeSnippet = `<pre><code>${codeWithBackticks}</code></pre>`;
            // Adding a button after the code block for applying suggestions
            const buttonHtml = `<button onclick="applyOneSuggestion('${id}')">Apply Suggestion</button>`;
            // Storing the original code block in a hidden div
            const hiddenCodeBlock = `<div id="${id}" style="display: none;">${code}</div>`;
            return codeWithBackticks + buttonHtml + hiddenCodeBlock;
        });
        // Convert the entire prepared Markdown content to HTML at once
        html = converter.makeHtml(formattedMarkdown);
    }
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