const vscode = require('vscode');
const axios = require('axios');
const showdown = require('showdown');

let panel;
let currentPage = 1;

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
                handleDelete(message.context);
                break;
              case 'select':
                handleSelect((currentPage - 1) * 5 + message.index, true);
                break;
              case 'unselect':
                handleSelect((currentPage - 1) * 5 + message.index, false);
                break;
              case 'saveDefinition':
                handleSaveDefinition((currentPage - 1) * 5 + message.index, message.newDefinition);
                break;
              case 'changePage':
                currentPage = message.newPage;
                updateWebview(currentPage = currentPage);
                break;
              case 'submitInput':
                handleSubmitInput(message.inputText, context);
                break;
              case 'showContext':
                handleShowContext();
                break;
              case 'clearContext':
                handleClearContext();
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

  let setKeyDisposable = vscode.commands.registerCommand('extension.setOpenAIKey', async () => {
    const openAIKey = await vscode.window.showInputBox({
      prompt: "Enter your OpenAI API key",
      placeHolder: "Type the OpenAI key here...",
      ignoreFocusOut: true
    });

    if (openAIKey) {
      context.globalState.update('openAIKey', openAIKey);
      vscode.window.showInformationMessage('OpenAI key saved successfully!');
    } else {
      vscode.window.showErrorMessage('OpenAI key was not saved.');
    }
  });

  context.subscriptions.push(addDisposable, getDisposable, setKeyDisposable);
}


function handleShowContext() {
  // Retrieve the current contextData
  const contextDataRaw = vscode.workspace.getConfiguration().get('tempContextCode');
  let output = [];

  if (contextDataRaw) {
    try {
      // Parse the JSON string
      const contextData = JSON.parse(contextDataRaw);

      if (Array.isArray(contextData)) {
        // If contextData is an array, map over it and format each item
        output = contextData.map((data) => {
          // Assuming formatMarkdown returns a string in Markdown syntax
          // that should be converted safely to HTML for display in VS Code Webview
          const contextHtml = formatMarkdown(data.context, true); // sanitize this if needed
          const definitionHtml = formatMarkdown(data.definition, true); // sanitize this if needed

          // Return the combined HTML string for each array element
          return `<div><strong>Context:</strong> ${contextHtml}</div> <div><strong>Definition:</strong>${definitionHtml}</div>`;
        });
      }
    } catch (e) {
      console.error('Parsing error:', e);
    }
  }

  // You might want to do something with the output, such as joining it, if it's intended to be a single HTML string
  if (output.length) {
    output = output.join(''); // Join all the HTML strings together.
  }

  if (contextDataRaw) {
    // Display the current contextData 
    panel.webview.postMessage({
      command: 'updateChatGptOutput',
      htmlContent: output
    });
  } else {
    panel.webview.postMessage({
      command: 'updateChatGptOutput',
      htmlContent: `<div>No context found.</div>`
    });
  }
}

function handleClearContext() {
  // Update the contextCode with an empty array
  vscode.workspace.getConfiguration().update('tempContextCode', JSON.stringify([]), vscode.ConfigurationTarget.Global)
    .then(() => {
      vscode.window.showInformationMessage('Context cleared');
      if (panel && panel.webview) {
        panel.webview.postMessage({
          command: 'updateChatGptOutput',
          htmlContent: `<div>Context cleared.</div>`
        });
      }
    }, err => {
      console.error('Error clearing contextCode:', err);
      vscode.window.showErrorMessage('Failed to clear context');
    });
}


async function handleSubmitInput(inputText, context) {
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
  // Retrieve OpenAI API key from global state
  const openAIKey = context.globalState.get('openAIKey');
  if (!openAIKey) {
    vscode.window.showErrorMessage('OpenAI API key is not set. Please set it using "Set OpenAI Key" command.');
    return;
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
        'Authorization': `Bearer ${openAIKey}` // Use the retrieved OpenAI key here
      }
    });

    const chatGptResponse = response.data.choices[0].message.content.trim();

    if (panel && panel.webview) {
      md = formatMarkdown(chatGptResponse, false);
      panel.webview.postMessage({
        command: 'updateChatGptOutput',
        htmlContent: `<div>${md}</div>`
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

function handleDelete(contextText) {
  // Decode the context text
  contextText = decodeURIComponent(contextText);

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

  // Find the item with the matching context and delete it
  const index = currentContext.findIndex(item => item.context === contextText);
  if (index !== -1) {
    currentContext.splice(index, 1);
  }

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
      tempContext = tempContext.filter(item => item.context !== selectedItem.context);
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
  const webviewContent = getWebviewContent(contextData, currentPage = currentPage);
  panel.webview.html = webviewContent;
}

function getWebviewContent(contextData, currentPage = 1) {
  const itemsPerPage = 5; // Number of items per page
  const totalPages = Math.ceil(contextData.length / itemsPerPage);



  // Calculate the slice of data for the current page
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = contextData.slice(startIndex, endIndex);


  let gridHtml = pageData.map((item, index) => {
    const safeContext = formatMarkdown(item.context, true);
    const safeDefinition = formatMarkdown(item.definition, true);

    return `<div class="grid-item" data-index="${index}" data-context="${encodeURIComponent(item.context)}">
              <div class="delete-button" onclick="deleteItem(this)">X</div>
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
                    <input type="text" id="inputBox" placeholder="Enter text" 
                           style="width: 100%; margin-bottom: 10px; box-sizing: border-box;">
                    <div style="display: flex; justify-content: space-between;">
                        <button id="submitButton" onclick="submitInput()" 
                                style="flex-grow: 1; margin-right: 5px;">Submit</button>
                        <button id="showContextButton" onclick="showContext()" 
                                style="flex-grow: 1; margin-right: 5px;">Show Context</button>
                        <button id="clearContextButton" onclick="clearContext()" 
                                style="flex-grow: 1;">Clear Context</button>
                    </div>
                  </div>`;

  let rightPanelHtml = `
                  <div class="right-panel">
                    <h3>AI Responses</h3>
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
        color: #333;
        background-color: #f4f4f4; /* Background color */
        padding: 10px;
        overflow: auto; /* For scrolling */
        border-left: 1px solid #ddd; /* Divider line */
      }
      .grid-item {
        border: 1px solid #ddd;
        border-radius: 4px;
        color: #333;
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

        function deleteItem(element) {
          // Retrieve the context from the data-context attribute of the parent element
          const contextText = element.parentNode.getAttribute('data-context');
        
          // Send a message to the extension to delete the item based on its context
          vscode.postMessage({
            command: 'delete',
            context: contextText
          });

          // Remove the item from the webview
          element.closest('.grid-item').remove();
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
        function showContext() {
          vscode.postMessage({
            command: 'showContext'
          });
        }
        function clearContext() {
          vscode.postMessage({
            command: 'clearContext'
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