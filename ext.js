const vscode = require('vscode');

function activate(context) {
  let addDisposable = vscode.commands.registerCommand('extension.addContext', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.selection) {
      const selectedText = editor.document.getText(editor.selection);
      // Retrieve the current contextCode
      const currentContextRaw = vscode.workspace.getConfiguration().get('contextCode');
      let currentContext = [];

      if (currentContextRaw) {
        try {
          // Parse the existing JSON array if it exists
          currentContext = JSON.parse(currentContextRaw);
        } catch (err) {
          console.error('Error parsing existing contextCode:', err);
          // Fallback to an empty array if parsing fails
          currentContext = [];
        }
      }

      // Create new context object
      const newContextObj = {
        "context": selectedText,
        "definition": ""
      };

      // Add the new context object
      currentContext.push(newContextObj);

      // Update the contextCode with the new array
      vscode.workspace.getConfiguration().update('contextCode', JSON.stringify(currentContext), vscode.ConfigurationTarget.Global)
        .then(() => {
          vscode.window.showInformationMessage('Context added');
        }, err => {
          console.error('Error updating contextCode:', err);
          vscode.window.showErrorMessage('Failed to add context');
        });
    } else {
      vscode.window.showErrorMessage('No text selected');
    }
  });

  let getDisposable = vscode.commands.registerCommand('extension.getContext', () => {
    const contextCode = vscode.workspace.getConfiguration().get('contextCode');
    if (contextCode) {
      // Parse the context code JSON
      try {
        const contextData = JSON.parse(contextCode);

        // Create and show a new webview
        const panel = vscode.window.createWebviewPanel(
          'contextCodeView', // Identifies the type of the webview. Used internally
          'Context Code', // Title of the panel displayed to the user
          vscode.ViewColumn.One, // Editor column to show the new webview panel in.
          {} // Webview options.
        );

        // Set the webview's HTML content
        panel.webview.html = getWebviewContent(contextData);
      } catch (e) {
        vscode.window.showErrorMessage('Failed to parse context code');
        console.error('Error parsing contextCode:', e);
      }
    } else {
      vscode.window.showErrorMessage('No context code found');
    }
  });

  context.subscriptions.push(addDisposable, getDisposable);
}

function getWebviewContent(contextData) {
  let gridHtml = contextData.map(item => {
    return `<div class="grid-item">
              <div><strong>Context:</strong> ${item.context}</div>
              <div><strong>Definition:</strong> ${item.definition}</div>
            </div>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Context Code</title>
      <style>
        .grid-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); /* Responsive grid layout */
          gap: 10px;
          padding: 10px;
        }
        .grid-item {
          padding: 20px;
          border: 1px solid #ddd;
          background-color: #f9f9f9;
          border-radius: 4px;
        }
        .grid-item div {
          margin-bottom: 8px;
        }
      </style>
    </head>
    <body>
      <div class="grid-container">
        ${gridHtml}
      </div>
    </body>
    </html>`;
}

exports.activate = activate;

function deactivate() { }

module.exports = {
  activate,
  deactivate
};