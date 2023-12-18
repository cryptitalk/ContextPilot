const vscode = require('vscode');

function activate(context) {
  let addDisposable = vscode.commands.registerCommand('extension.addContext', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const selectedText = editor.document.getText(editor.selection);
      vscode.workspace.getConfiguration().update('contextCode', selectedText, vscode.ConfigurationTarget.Global)
        .then(() => {
          vscode.window.showInformationMessage('Code added to context');
        }, err => {
          console.error('Error updating contextCode:', err);
          vscode.window.showErrorMessage('Failed to add code to context');
        });
    } else {
      vscode.window.showErrorMessage('No code selected');
    }
  });

  let getDisposable = vscode.commands.registerCommand('extension.getContext', () => {
    const contextCode = vscode.workspace.getConfiguration().get('contextCode');
    if (contextCode) {
      vscode.window.showInformationMessage(`Context Code: ${contextCode}`);
    } else {
      vscode.window.showErrorMessage('No context code found');
      console.log('Failed to retrieve contextCode. Current configuration:', vscode.workspace.getConfiguration().get('contextCode'));
    }
  });

  context.subscriptions.push(addDisposable, getDisposable);
}

exports.activate = activate;

function deactivate() {}

module.exports = {
 activate,
 deactivate
};