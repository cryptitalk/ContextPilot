# ContextPilot

![Alt Text](https://storage.googleapis.com/cryptitalk/gemini_fast.gif)

A Visual Studio Code extension that helps manage contextual information within the editor, allowing users to interact with an AI service for enhanced coding experiences.

## Features

- **Context Management**: Easily add, view, and modify context from your code editor.
- **Clipboard Integration**: Add text directly from your clipboard to the extension's context.
- **AI-Enhanced Coding**: Use AI-powered services to interpret the context and provide coding insights.
- **Support for Multiple AI Services**: Configurable settings to integrate with OpenAI and Google Gemini AI services.

## Requirements

This extension don't requires an API key to interact with AI services. Compatible services include both OpenAI (including ChatGPT plus) and Google Gemini and others if they are supported in the future.

## Installation

To install ContextPilot:

1. Go to the Visual Studio Code Market Place.
2. Search for "ContextPilot".
3. Install the extension.

## Usage

After installing the extension, the following commands will be available:

- `Add Selected Context`: Add the currently selected text in the editor to the context.
- `Add Clipboard Context`: Add text from your clipboard to the context.
- `Get Context`: Retrieve and display the stored context, and interact with AI.

## Configuration

You can configure the extension by going to the extension settings in Visual Studio Code and setting the following:

- `contextCode`: For storing the context data to be persistent across sessions.
- `tempContextCode`: For temporarily holding context information to be sent to the AI service.

## Extension Settings

This extension contributes the following settings:

- `context-pilot.contextCode`: A setting for storing the context data.
- `context-pilot.tempContextCode`: A setting for temporarily holding context information.

## Known Issues

Currently, there are no known issues. If you encounter any bugs, please report them on the project's GitHub issues page.

## Contributing

We welcome contributions! Please refer to our contribution guidelines for details on how to make a pull request.

## Change Log

Detailed changes for each release are documented in the [release notes](https://github.com/your-username/context-pilot/releases).

## License

This project is licensed under the [MIT License](LICENSE).

## Credits

Developed by [CryptiTalk](https://github.com/cryptitalk).

## Contact

If you have any questions or feedback, please create an issue on the project's [GitHub issues page](https://github.com/your-username/context-pilot/issues).
