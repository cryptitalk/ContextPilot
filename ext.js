const vscode = require('vscode');
const axios = require('axios');

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
            retainContextWhenHidden: true, // Add this line to retain the context
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
                updateWebview(currentPage = currentPage);
                break;
              case 'submitInput':
                handleSubmitInput(message.inputText);
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


async function handleSubmitInput(inputText) {
  // Retrieve the current tempContextCode
  const tempContextRaw = vscode.workspace.getConfiguration().get('tempContextCode');
  let tempContext = tempContextRaw ? JSON.parse(tempContextRaw) : [];

  // Combine the context and the input text to form the prompt
  const prompt = tempContext.map(item => `${item.context}: ${item.definition}`).join('\n') + '\n' + inputText;
  if (panel && panel.webview) {
    panel.webview.postMessage({
      command: 'updateChatGptOutput',
      htmlContent: '<div class="loading"><img src="https://storage.googleapis.com/cryptitalk/loading.gif" alt="Loading..."></div>'
    });
  }
  try {
    // Send the prompt to ChatGPT API
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4-1106-preview", // Replace with the correct chat model identifier
      messages: [{
        role: "system",
        content: "I am a code writer."
      }, {
        role: "user",
        content: prompt
      }],
      // Additional parameters as needed
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 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' // Replace with your actual API key
      }
    });

    const chatGptResponse = response.data.choices[0].message.content.trim();

    if (panel && panel.webview) {
      panel.webview.postMessage({
        command: 'updateChatGptOutput',
        htmlContent: `<div>${chatGptResponse}</div>`
      });
    }
  } catch (err) {
    console.error('Error communicating with ChatGPT API:', err.message);
    if (err.response) {
      console.error('Response Status:', err.response.status);
      console.error('Response Status Text:', err.response.statusText);
      console.error('Response Data:', err.response.data ? JSON.stringify(err.response.data).substring(0, 500) : 'No data');
    } else {
      console.error('No response received from the server');
    }
    vscode.window.showErrorMessage('Failed to get response from ChatGPT');
  } finally {
    // Clear the tempContextCode after the API call
    await vscode.workspace.getConfiguration().update('tempContextCode', null, true);
  }
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
  currentContext[currentPage * 5 + index].definition = newDefinition;

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
  const webviewContent = getWebviewContent(contextData, currentPage = currentPage);
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
              <div style="white-space: pre-wrap;"><strong>Context:</strong> ${safeContext}</div>
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

  let inputHtml = `<div class="input-container">
                     <input type="text" id="inputBox" placeholder="Enter text">
                     <button id="submitButton" onclick="submitInput()">Submit</button>
                   </div>`;

  let rightPanelHtml = `
                  <div class="right-panel">
                    <h3>ChatGPT Responses</h3>
                    <div id="chatGptOutput" style="white-space: pre-wrap;">Responses will appear here...</div>
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
      .content {
        display: flex;
        flex-direction: row; /* Change to row layout */
        height: 100vh;
      }
      .main-content {
        width: 70%;
        display: flex;
        flex-direction: column;
        /* ... styles for main content ... */
      }
      .grid-container {
        flex-grow: 1;
        overflow: auto;
        display: grid;
        grid-template-columns: repeat(5, 1fr); /* 5 equal columns */
        gap: 10px;
        padding: 10px;
      }
      .right-panel {
        width: 30%; /* Width for the right panel */
        background-color: #f4f4f4; /* Background color */
        padding: 10px;
        overflow: auto; /* For scrolling */
        border-left: 1px solid #ddd; /* Divider line */
      }
      .grid-item {
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: #fff;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        padding: 15px;
        position: relative;
        height: 100%;
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
      .pagination-controls {
        text-align: center;
        padding: 10px;
      }
      .input-container {
        width: 100%; /* Full width */
        height: 20%;
        padding: 10px;
        box-sizing: border-box;
        background-color: #f0f0f0;
      }
      #inputBox {
        width: 80%; /* Adjust width as per your need */
        height: 90%;
        padding: 8px;
      }
      #submitButton {
        padding: 8px 15px;
      }
      .loading {
        text-align: center;
        padding: 20px;
      }
      .loading img {
        width: auto; /* Adjust width as needed, 'auto' keeps the aspect ratio */
        height: 50px; /* Example height, adjust as needed */
        display: block; /* Centers the image in the div */
        margin: 0 auto; /* Centers the image horizontally */
      }
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
      <div class="content">
        <div class="main-content">
          <div class="grid-container">
            ${gridHtml}
          </div>
          ${paginationHtml}
          <div class="input-container">
            ${inputHtml}
          </div>
        </div>
        ${rightPanelHtml}
      </div>
      <script>
        window.addEventListener('message', event => {
          const message = event.data; // The JSON data our extension sent
          switch (message.command) {
            case 'updateChatGptOutput':
              updateChatGptOutput(message.htmlContent);
              break;
          }
        });
        function updateChatGptOutput(htmlContent) {
          const outputDiv = document.getElementById('chatGptOutput');
          outputDiv.innerHTML = htmlContent;
        }
        function submitInput() {
          const inputText = document.getElementById('inputBox').value;
          vscode.postMessage({
            command: 'submitInput',
            inputText: inputText
          });
        }
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