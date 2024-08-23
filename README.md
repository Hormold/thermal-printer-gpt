# Thermal Printer GPT

This fun project combines a thermal printer with GPT to create an interactive Q&A experience. It's built using Node.js and is designed to work with specific thermal printer models.

## Supported Printers

The current implementation supports the thermal printer model:

- Model: QR204
- P/W: 58mm
- Baud Rate 9600
- Power: DC 5-9V/2A
- Vendor ID: 0x28e9
- Product ID: 0x0289

This is a small, white thermal printer that uses 58mm wide paper rolls.

## Features

- Direct printing from Node.js to supported thermal printers
- Interactive GPT-based Q&A functionality
- Simple configuration for text size and printing width

## Requirements

- Node.js
- OpenAI API key
- Supported thermal printer (LQR02-M or compatible models)

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/hormold/thermal-printer-gpt.git
   ```

2. Install dependencies:
   ```
   cd thermal-printer-gpt
   npm install
   ```

3. Create a `.env` file in the project root and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

## Usage

Run the main script to start the interactive mode:

```
node index.js
```

This will initialize the printer and start the GPT-based Q&A session. You can type your questions, and the answers will be printed on the thermal printer.

## Contributing

This project is open for contributions! Here are some areas where help is needed:

- Image printing support
- Additional printer model support
- Improved error handling and printer connection management

Feel free to open issues or submit pull requests.

## Disclaimer

This is a just-for-fun project to experiment with thermal printers and GPT. It may not be suitable for production use.

## License

[MIT License](LICENSE)