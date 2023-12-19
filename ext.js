const vscode = require('vscode');

let panel;

function activate(context) {
  let addDisposable = vscode.commands.registerCommand('extension.addContext', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.selection) {
      let selectedText = editor.document.getText(editor.selection);

      // Escape special characters or sanitize the selected text
      // This can be adjusted based on the specific requirements
      selectedText = selectedText.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

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
        panel = vscode.window.createWebviewPanel(
          'contextCodeView', // Identifies the type of the webview. Used internally
          'Context Code', // Title of the panel displayed to the user
          vscode.ViewColumn.One, // Editor column to show the new webview panel in.
          {
            enableScripts: true,
            sandboxOptions: {
              allowScripts: true
            }
          } // Webview options.
        );

        // Set the webview's HTML content
        panel.webview.html = getWebviewContent(contextData);

        panel.webview.onDidReceiveMessage(
          message => {
            switch (message.command) {
              case 'delete':
                handleDelete(message.index);
                break;
              case 'select':
                handleSelect(message.index, true);
                break;
              case 'unselect':
                handleSelect(message.index, false);
                break;
              case 'saveDefinition':
                handleSaveDefinition(message.index, message.newDefinition);
                break;
              case 'changePage':
                currentPage = message.newPage;
                updateWebview(currentPage=currentPage);
                break;
            }
          },
          undefined,
          context.subscriptions
        );
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

function handleDelete(index) {
  // Retrieve the current contextCode
  const currentContextRaw = vscode.workspace.getConfiguration().get('contextCode');
  let currentContext = [];

  if (currentContextRaw) {
    try {
      currentContext = JSON.parse(currentContextRaw);
    } catch (err) {
      console.error('Error parsing existing contextCode:', err);
      return;
    }
  }

  // Delete the item at the specified index
  currentContext.splice(index, 1);

  // Update the contextCode with the new array
  vscode.workspace.getConfiguration().update('contextCode', JSON.stringify(currentContext), vscode.ConfigurationTarget.Global)
    .then(() => {
      vscode.window.showInformationMessage('Context deleted');
    }, err => {
      console.error('Error updating contextCode after delete:', err);
      vscode.window.showErrorMessage('Failed to delete context');
    });
}

function handleSelect(index, isSelected) {
  // Retrieve the current contextCode
  const currentContextRaw = vscode.workspace.getConfiguration().get('contextCode');
  let currentContext = [];

  // Retrieve the current tempContextCode
  const tempContextRaw = vscode.workspace.getConfiguration().get('tempContextCode');
  let tempContext = tempContextRaw ? JSON.parse(tempContextRaw) : [];

  if (currentContextRaw) {
    try {
      currentContext = JSON.parse(currentContextRaw);
    } catch (err) {
      console.error('Error parsing existing contextCode:', err);
      return;
    }
  }

  if (index >= 0 && index < currentContext.length) {
    const selectedItem = currentContext[index];

    if (isSelected) {
      // Add to tempContextCode
      tempContext.push(selectedItem);
      vscode.window.showInformationMessage(`Selected Context: ${selectedItem.context}`);
    } else {
      // Remove from tempContextCode
      tempContext = tempContext.filter(item => item !== selectedItem);
      vscode.window.showInformationMessage(`Unselected Context: ${selectedItem.context}`);
    }

    // Save the updated tempContextCode
    vscode.workspace.getConfiguration().update('tempContextCode', JSON.stringify(tempContext), vscode.ConfigurationTarget.Global);
  } else {
    vscode.window.showErrorMessage('Invalid context selection');
  }
}

function handleSaveDefinition(index, newDefinition) {
  // Retrieve the current contextCode
  const currentContextRaw = vscode.workspace.getConfiguration().get('contextCode');
  let currentContext = [];

  if (currentContextRaw) {
    try {
      currentContext = JSON.parse(currentContextRaw);
    } catch (err) {
      console.error('Error parsing existing contextCode:', err);
      return;
    }
  }

  // Check if the index is valid
  if (index < 0 || index >= currentContext.length) {
    console.error('Invalid index for updating definition');
    vscode.window.showErrorMessage('Failed to update definition: Invalid index');
    return;
  }

  // Update the definition of the item at the specified index
  currentContext[index].definition = newDefinition;

  // Update the contextCode with the modified array
  vscode.workspace.getConfiguration().update('contextCode', JSON.stringify(currentContext), vscode.ConfigurationTarget.Global)
    .then(() => {
      vscode.window.showInformationMessage('Definition updated successfully');
    }, err => {
      console.error('Error updating contextCode after saving definition:', err);
      vscode.window.showErrorMessage('Failed to update definition');
    });
}

function updateWebview(currentPage = 1) {
  console.log("updateWebview", currentPage)
  // Retrieve the context data from the workspace configuration
  const contextDataRaw = vscode.workspace.getConfiguration().get('contextCode');
  let contextData = [];

  // Check and parse the context data
  if (contextDataRaw) {
    try {
      contextData = JSON.parse(contextDataRaw);
    } catch (err) {
      console.error('Error parsing contextData:', err);
      vscode.window.showErrorMessage('Error loading context data.');
      return;
    }
  }

  // Generate and display the webview content with the loaded context data
  const webviewContent = getWebviewContent(contextData, currentPage=currentPage);
  panel.webview.html = webviewContent;
}

function getWebviewContent(contextData, currentPage = 1) {
  const itemsPerPage = 5; // Number of items per page
  const totalPages = Math.ceil(contextData.length / itemsPerPage);
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Calculate the slice of data for the current page
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = contextData.slice(startIndex, endIndex);


  let gridHtml = pageData.map((item, index) => {
    const safeContext = escapeHtml(item.context);
    const safeDefinition = escapeHtml(item.definition);

    return `<div class="grid-item" data-index="${index}">
              <div class="delete-button" onclick="deleteItem(${index})">X</div>
              <div><strong>Context:</strong> ${safeContext}</div>
              <div>
                <strong>Definition:</strong>
                <span class="definition-text">${safeDefinition}</span>
                <input type="text" class="definition-edit" value="${safeDefinition}" style="display: none;">
              </div>
              <button class="edit-button" onclick="editDefinition(${index})">Edit</button>
              <button class="save-button" onclick="saveDefinition(${index})" style="display: none;">Save</button>
              <input type="checkbox" id="selectItem-${index}" onchange="selectItem(${index}, this.checked)">
              <label for="selectItem-${index}">Select</label>
            </div>`;
  }).join('');

  let paginationHtml = `
    <div class="pagination-controls">
      <button id="prevButton" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
      <span>Page ${currentPage} of ${totalPages}</span>
      <button id="nextButton" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    </div>
  `;

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
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 10px;
        padding: 10px;
      }
      .grid-item {
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: #fff;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        padding: 15px;
        position: relative;
        height: 50vh; /* Set the height to 50% of the viewport height */
        overflow: auto; /* Optional: Add a scrollbar if the content overflows */
      }
      .delete-button {
        position: absolute;
        top: 10px;
        right: 10px;
        cursor: pointer;
        padding: 4px 8px;
        background-color: red;
        color: white;
        font-weight: bold;
        border-radius: 50%;
      }
      /* Your existing styles */
      </style>
      <script>
        const vscode = acquireVsCodeApi();

        function deleteItem(index) {
          // Send a message to the extension to delete the item
          vscode.postMessage({
            command: 'delete',
            index: index
          });

          // Remove the item from the webview
          const itemToDelete = document.querySelector('.grid-item[data-index="' + index + '"]');
          if (itemToDelete) {
            itemToDelete.remove();
          }
        }

        function selectItem(index, isSelected) {
          vscode.postMessage({
            command: isSelected ? 'select' : 'unselect',
            index: index
          });
        }

        function editDefinition(index) {
          const item = document.querySelector('.grid-item[data-index="' + index + '"]');
          item.querySelector('.definition-text').style.display = 'none';
          item.querySelector('.definition-edit').style.display = 'inline';
          item.querySelector('.edit-button').style.display = 'none';
          item.querySelector('.save-button').style.display = 'inline';
        }

        function saveDefinition(index) {
          const item = document.querySelector('.grid-item[data-index="' + index + '"]');
          const newDefinition = item.querySelector('.definition-edit').value;

          vscode.postMessage({
            command: 'saveDefinition',
            index: index,
            newDefinition: newDefinition
          });

          item.querySelector('.definition-text').textContent = newDefinition;
          item.querySelector('.definition-text').style.display = 'inline';
          item.querySelector('.definition-edit').style.display = 'none';
          item.querySelector('.edit-button').style.display = 'inline';
          item.querySelector('.save-button').style.display = 'none';
        }
      </script>
    </head>
    <body>
      <div class="grid-container">
        ${gridHtml}
      </div>
      ${paginationHtml}
      <script>
        // ... existing JavaScript functions ...
        // Adding Event Listeners to Buttons
        document.getElementById('prevButton').addEventListener('click', function() {
          changePage(${currentPage}, ${totalPages}, -1);
        });
  
        document.getElementById('nextButton').addEventListener('click', function() {
          changePage(${currentPage}, ${totalPages}, 1);
        });
        // Pagination JavaScript
        function changePage(currentPage, totalPages, step) {
          console.log("change page");
          const newPage = currentPage + step;
          if (newPage > 0 && newPage <= totalPages) {
            vscode.postMessage({
              command: 'changePage',
              newPage: newPage
            });
          }
        }
      </script>
    </body>
    </html>`;
}

exports.activate = activate;

function deactivate() { }

module.exports = {
  activate,
  deactivate
};