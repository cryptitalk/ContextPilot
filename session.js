const vscode = require('vscode');
const utils = require('./utils');

function handleShowSession(panel, service) {
    let sessionText = "";
    // Join the chat session into one string with line breaks
    let command = service == "chatGpt" ? 'updateChatGptOutput' : 'updateGeminiOutput';
    if (service == "chatGpt") {
      sessionText = global.chatSessionGPT.map(entry => `${entry.role}: ${entry.content}`).join('\\n\\n');
    } else if (service == "gemini") {
      sessionText = global.chatSessionGemini.map(entry => `${entry.role}: ${entry.parts.text}`).join('\\n\\n');
    }
    if (sessionText == "") {
      sessionText = "Session is empty.";
    }
    // Send the sessionText to the webview to be displayed
    if (panel && panel.webview) {
      const sessionHtml = utils.formatMarkdown(sessionText, true);
      panel.webview.postMessage({
        command: command,
        htmlContent: `<div>${sessionHtml}</div>`
      });
    }
  }
  
  function handleClearSession(panel, service) {
    // Clear the chat session array
    let command = service == "chatGpt" ? 'updateChatGptOutput' : 'updateGeminiOutput';
    if (service == "chatGpt") {
      global.chatSessionGPT = [];
    } else if (service == "gemini") {
      global.chatSessionGemini = [];
    }
    // Notify the webview that the session has been cleared
    if (panel && panel.webview) {
      panel.webview.postMessage({
        command: command,
        htmlContent: `<div>Session cleared.</div>`
      });
    }
    vscode.window.showInformationMessage('Session cleared');
  }

  module.exports = {
    handleShowSession,
    handleClearSession
  };