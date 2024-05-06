const vscode = require('vscode');
const axios = require('axios');
const EventSource = require('eventsource');
const utils = require('./utils');

let chatGptResponse = '';
let chatGeminiResponse = '';

// Helper function to manage chat session entries
function manageChatSessionEntries(chatSession, maxSessionLength) {
    while (chatSession.length >= maxSessionLength) {
      if (chatSession.length === maxSessionLength && chatSession[1].role === "user") {
        chatSession.splice(1, 2); // Remove the oldest user-system pair
      } else {
        chatSession.splice(1, 1); // Remove the oldest entry
      }
    }
  }
  
  
  // Helper function to create the prompt
  function createPrompt(tempContext, inputText) {
    return tempContext.map(item => `${item.context}: ${item.definition}`).join('\\n') + '\\n' + inputText;
  }
  
  // Helper function to post data to an API
  async function postDataToAPI(apiEndpoint, headers, body) {
    const messageJsonString = JSON.stringify(body);
    return axios.post(apiEndpoint, { message_json: messageJsonString }, {
      headers: headers
    });
  }
  
  async function initEventStream(panel, endpoint, message, command, chatResponse, chatSession, handleResponseFunc) {
    let respose = await postDataToAPI(endpoint.replace('streamchat', 'streaminit'), { 'Content-Type': 'application/json' }, message);
  
    // Initialize the EventSource with the encoded JSON in the URL query parameter
    let eventSource = new EventSource(`${endpoint}?session_id=${respose.data.session_id}`);
    eventSource.onmessage = function (event) {
      var messageData = JSON.parse(event.data);
      chatResponse += messageData.text;
      const md = utils.formatMarkdown(chatResponse, false);
      utils.postMessageToWebview(panel, command, `<div>${md}</div>`);
      if (messageData.finish_reason) {
        eventSource.close();
        handleResponseFunc(chatResponse, chatSession);
      }
    };
  
    // Define error handling
    eventSource.onerror = function (event) {
      console.error('EventSource failed:', event);
      eventSource.close();
    };
    return eventSource;
  }
  
  async function handleChatAPIInput(panel, apiInfo, inputText, context, chatSession, chatResponse) {
    const tempContextRaw = vscode.workspace.getConfiguration().get('tempContextCode');
    let tempContext = tempContextRaw ? JSON.parse(tempContextRaw) : [];
  
    const { maxSessionLength, constructBodyFunc, handleResponseFunc, apiName } = apiInfo;
  
    if (chatSession.length === 0) {
      if (apiName == "Gemini") {
        chatSession.push({
          role: "user",
          parts: { text: "I am a software engineer." }
        });
        chatSession.push({
          role: "model",
          parts: { text: "I am a software engineer advisor." }
        });
      } else {
        chatSession.push({
          role: "system",
          content: "I am a software engineer advisor."
        });
      }
    }
  
    manageChatSessionEntries(chatSession, maxSessionLength);
  
    // Add the new user input to the chatSession
    const prompt = createPrompt(tempContext, inputText);
    if (apiName == "Gemini") {
      chatSession.push({
        role: 'user',
        parts: { text: prompt }
      });
    } else {
      chatSession.push({
        role: 'user',
        content: prompt
      });
    }
    let command = apiName == "Gemini" ? 'updateGeminiOutput' : 'updateChatGptOutput';
    utils.postMessageToWebview(panel, command, '<div class="loading"><img src="https://storage.googleapis.com/cryptitalk/loading.gif" alt="Loading..."></div>');
  
    try {
      const requestBody = constructBodyFunc(chatSession);
      await initEventStream(panel, apiInfo.endpoint, requestBody, command, chatResponse, chatSession, handleResponseFunc);
    } catch (err) {
      utils.handleError(err, apiName);
    } finally {
      // Clear the tempContextCode after the API call
      await vscode.workspace.getConfiguration().update('tempContextCode', null, true);
    }
  }
  
  // Re-usable function to handle the GPT API input
  async function handleGPTSubmitInput(panel, inputText, context) {
    chatGptResponse = '';
    const apiInfo = {
      maxSessionLength: 10,
      constructBodyFunc: (chatSessionGPT) => ({
        model: "gpt-4-turbo-preview",
        message: chatSessionGPT
      }),
      handleResponseFunc: async (response, chatSessionGPT) => {
        const chatGptResponse = response
        chatSessionGPT.push({
          role: "system",
          content: chatGptResponse
        });
      },
      apiName: "GPT",
      endpoint: "https://main-wjaxre4ena-uc.a.run.app/streamchat"
    };
  
    await handleChatAPIInput(panel, apiInfo, inputText, context, global.chatSessionGPT, chatGptResponse);
  }
  
  
  async function handleGeminiSubmitInput(panel, inputText, context) {
    const apiInfo = {
      maxSessionLength: 10,
      constructBodyFunc: (chatSessionGemini) => ({
        model: "gemini",
        message: chatSessionGemini
      }),
      handleResponseFunc: async (response, chatSessionGemini) => {
        const geminiResponseContent = response;
        chatSessionGemini.push({
          role: "model",
          parts: { text: geminiResponseContent }
        });
      },
      apiName: "Gemini",
      endpoint: "https://main-wjaxre4ena-uc.a.run.app/streamchat"
    };
    await handleChatAPIInput(panel, apiInfo, inputText, context, global.chatSessionGemini, chatGeminiResponse);
  }

  module.exports = {
    handleGPTSubmitInput,
    handleGeminiSubmitInput
  };