const vscode = require('vscode');
const utils = require('./utils');

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

function handleSelect(contextText, isSelected) {
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

  // Decode the context text (if it's encoded)
  contextText = decodeURIComponent(contextText);

  // Find the item with the matching context
  const selectedItem = currentContext.find(item => item.context === contextText);

  if (selectedItem) {
    if (isSelected) {
      // Add to tempContextCode if not already selected
      if (!tempContext.some(item => item.context === contextText)) {
        tempContext.push(selectedItem);
      }
      vscode.window.showInformationMessage(`Selected Context: ${selectedItem.context}`);
    } else {
      // Remove from tempContextCode
      tempContext = tempContext.filter(item => item.context !== contextText);
      vscode.window.showInformationMessage(`Unselected Context: ${selectedItem.context}`);
    }

    // Save the updated tempContextCode
    vscode.workspace.getConfiguration().update('tempContextCode', JSON.stringify(tempContext), vscode.ConfigurationTarget.Global);
  } else {
    vscode.window.showErrorMessage('Context text not found');
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

function updateWebview(panel, currentPage = 1) {
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
      const safeContext = utils.formatMarkdown(item.context, true);
      const safeDefinition = utils.formatMarkdown(item.definition, true);  

    return `<div class="grid-item" data-index="${index}" data-context="${encodeURIComponent(item.context)}">
                <div class="delete-button" onclick="deleteItem(this)">X</div>
                <div class="toggle-size-button" onclick="toggleItemSize(this.parentNode, ${index})">E</div>
                <div style="white-space: pre-wrap;"><strong>Context:</strong> ${safeContext}</div>
                <div>
                  <strong>Definition:</strong>
                  <span class="definition-text">${safeDefinition}</span>
                  <input type="text" class="definition-edit" value="${safeDefinition}" style="display: none;">
                </div>
                <button class="edit-button" onclick="editDefinition(${index})">Edit</button>
                <button class="save-button" onclick="saveDefinition(${index})" style="display: none;">Save</button>
                <input type="checkbox" id="selectItem-${index}" onchange="selectItem('${encodeURIComponent(item.context).replace(/'/g, "\\'")}', this.checked)">
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
                          <button id="showSessionButton" onclick="showSession()" style="flex-grow: 1; margin-right: 5px;">Show Session</button>
                          <button id="clearSessionButton" onclick="clearSession()" style="flex-grow: 1;">Clear Session</button>
                      </div>
                    </div>`;
  
    let rightPanelHtml = `
                    <div class="right-panel">
                      <h3>AI Responses</h3>
                      <div style="display: flex;">
                        <button style="flex: 1;" id="chatGptTab" onclick="showOutput('chatGpt')">ChatGPT</button>
                        <button style="flex: 1;" id="geminiTab" onclick="showOutput('gemini')">Gemini</button>
                      </div>
                      <div id="chatGptOutput" style="padding: 10px; white-space: pre-wrap;">
                        ChatGPT responses will appear here...
                      </div>
                      <div id="geminiOutput" style="padding: 10px; white-space: pre-wrap; display: none;">
                        Gemini responses will appear here...
                      </div>
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
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
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
          grid-column: auto;
        }
        .grid-item.expanded {
          grid-column: span 3;
        }
        .grid-item.narrow {
          grid-column: span 1;
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
        .toggle-size-button {
          position: absolute;
          top: 10px;
          right: 40px; /* Adjusted this value to create space between the V and X buttons */
          cursor: pointer;
          padding: 4px 8px;
          background-color: green;
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
        .active-tab {
          background-color: #007acc;
          color: white;
        } 
        </style>
        <script>
          let activeService = 'chatGpt';
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
  
          function selectItem(contextText, isSelected) {
            vscode.postMessage({
              command: isSelected ? 'select' : 'unselect',
              context: contextText
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
  
          function showOutput(outputId) {
            // Hide all output divs
            document.getElementById('chatGptOutput').style.display = 'none';
            document.getElementById('geminiOutput').style.display = 'none';
          
            // Show selected output div
            document.getElementById(outputId + 'Output').style.display = 'block';
          
            // Update active service and tabs visual state
            activeService = outputId;
            updateActiveServiceTabs();
          }
          
          function updateActiveServiceTabs() {
            // Reset both tabs to inactive state
            document.getElementById('chatGptTab').classList.remove('active-tab');
            document.getElementById('geminiTab').classList.remove('active-tab');
          
            // Set the active tab based on the selected service
            if (activeService === 'chatGpt') {
              document.getElementById('chatGptTab').classList.add('active-tab');
            } else {
              document.getElementById('geminiTab').classList.add('active-tab');
            }
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
            function toggleItemSize(element, index) {
              const gridItems = document.querySelectorAll('.grid-item');
              const isExpanded = element.classList.contains('expanded');
              console.log("toggleItemSize", isExpanded);
          
              // Check if the element is already expanded, if so, collapse it
              if (isExpanded) {
                  element.classList.remove('expanded');
              } else { // Otherwise, expand it and narrow others
                  // Clear all previously expanded items first
                  gridItems.forEach(item => {
                      item.classList.remove('expanded');
                      item.classList.add('narrow');
                  });
          
                  // Now toggle the expanded state for the clicked item
                  element.classList.add('expanded');
                  element.classList.remove('narrow');
              }
          }
        
          window.addEventListener('message', event => {
            const message = event.data; // The JSON data our extension sent
            switch (message.command) {
              case 'updateChatGptOutput':
                updateChatGptOutput(message.htmlContent);
                break;
              case 'updateGeminiOutput':
                updateGeminiOutput(message.htmlContent);
                break;
            }
          });
          updateActiveServiceTabs();
          function updateChatGptOutput(htmlContent) {
            const outputDiv = document.getElementById('chatGptOutput');
            outputDiv.innerHTML = htmlContent;
          }
          function updateGeminiOutput(htmlContent) {
            const outputDiv = document.getElementById('geminiOutput');
            outputDiv.innerHTML = htmlContent;
          }
          function submitInput() {
            const inputText = document.getElementById('inputBox').value;
            vscode.postMessage({
              command: 'submitInput',
              inputText: inputText,
              service: activeService
            });
          }
          function showContext() {
            vscode.postMessage({
              command: 'showContext',
              service: activeService
            });
          }
          function clearContext() {
            vscode.postMessage({
              command: 'clearContext',
              service: activeService
            });
          }
          function showSession() {
            vscode.postMessage({
              command: 'showSession',
              service: activeService
            });
          }
          function clearSession() {
            vscode.postMessage({
              command: 'clearSession',
              service: activeService
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
          function navigateChat(direction) {
            console.log("navigateChat", direction);
            vscode.postMessage({
              command: 'navigateChat',
              direction: direction,
              service: activeService
            });
          }
        </script>
      </body>
      </html>`;
  }

  module.exports = {
    getWebviewContent,
    handleDelete,
    handleSelect,
    handleSaveDefinition,
    updateWebview
};