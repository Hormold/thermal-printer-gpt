import axios from "axios";
import { Printer } from "./printer";
import sharp from "sharp";
import { bilinearInterp, blurImage, dither, edges, testImage } from "./utils";
import { readFileSync } from "fs";

export class PrinterGPTAssistant {
  private apiKey: string;
  private printer: Printer;

  constructor(apiKey: string, printer: Printer) {
    this.apiKey = apiKey;
    this.printer = printer;
  }

  async generateImage(prompt: string): Promise<Buffer> {
    const response = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        prompt: prompt,
        n: 1,
        size: "256x256",
        response_format: "b64_json",
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const imageBase64 = response.data.data[0].b64_json;
    return Buffer.from(imageBase64, "base64");
  }

  async askQuestion(question: string): Promise<string> {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Your outputs is printing on thermal paper, be short and concise.
But sometimes write a jokes in receipt format to make it more fun. like this is from restaurant or something.
Supported english/latin letters only. No special characters. Supported: !"#$%&'()*+,-./0123456789:;<=>?@A-Z[\]^_\`a-z{|}~
You can draw in ascii art too. But keep it simple. And max 250 characters, width max - 32 characters.
Emoji, hebrew, arabic, chinese, japanese, korean, cyrillic, etc. not supported. Also hearts, stars, etc. not supported.`,
          },
          { role: "user", content: question },
        ],
        max_tokens: 250,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  }

  async printAnswer(question: string): Promise<void> {
    try {
      const answer = await this.askQuestion(question);
      await this.printer.print(`${answer}\n\n`);
    } catch (error) {
      console.error("Error asking or printing answer:", error);
      throw error;
    }
  }

  async printLocalImage(path: string): Promise<void> {
    try {
      const imageBuffer = readFileSync(path);
      const printerHeight = 384; // Adjust based on your printer's capabilities
      const {
        buffer: bitmapData,
        width,
        height,
      } = await this.convertToBitmap(imageBuffer, printerHeight);
      console.log(
        `Printing image with dimensions: ${width}x${height}`,
        bitmapData
      );
      const test = testImage;
      await this.printer.beginBitmap(16, 16);
      await this.printer.write(0b1000100);
      await this.printer.print("\n\n"); // Add some space after the image
      //await this.printer.drawBitmap(test, 64, 128);
      console.log("Image printed successfully.");
      await this.printer.print("\n\n"); // Add some space after the image
    } catch (error) {
      console.error("Error generating or printing image:", error);
      throw error;
    }
  }

  async printImage(
    prompt: string,
    applyBlur: boolean = false,
    applyEdges: boolean = false
  ): Promise<void> {
    try {
      const imageBuffer = await this.generateImage(prompt);
      const printerHeight = 384; // Adjust based on your printer's capabilities
      const {
        buffer: bitmapData,
        width,
        height,
      } = await this.convertToBitmap(
        imageBuffer,
        printerHeight,
        applyBlur,
        applyEdges
      );

      await this.printer.drawBitmap(bitmapData, height, width);
      await this.printer.print("\n\n"); // Add some space after the image
    } catch (error) {
      console.error("Error generating or printing image:", error);
      throw error;
    }
  }

  async getPrinterStatus(): Promise<string> {
    // This is a placeholder. In a real implementation, you'd query the printer's status.
    return "Printer is ready.";
  }

  async runInteractiveMode(): Promise<void> {
    console.log("Welcome to the Printer GPT Assistant!");
    console.log("Ask questions about the printer or type 'exit' to quit.");

    while (true) {
      const question = await this.prompt("Your question: ");
      if (question.toLowerCase() === "exit") {
        break;
      }

      if (question.toLowerCase() === "test") {
        console.log(`Printing test message...`);
        await this.printLocalImage("photo.jpeg");
        break;
      }

      try {
        if (
          question.toLowerCase().startsWith("!draw ") ||
          question.toLowerCase().startsWith("!image ")
        ) {
          console.log(`Generating and printing image for: "${question}"`);
          await this.printImage(question);
          console.log("Image printed successfully.");
        } else {
          const answer = await this.askQuestion(question);
          console.log(`\nAnswer: ${answer}\n`);
          await this.printer.print(
            `====================\n${answer}\n\n====================\n\n`
          );
        }
      } catch (error) {
        console.error("Error:", error);
      }
    }

    console.log("Thank you for using the Printer GPT Assistant!");
  }

  private prompt(question: string): Promise<string> {
    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      readline.question(question, (answer: string) => {
        readline.close();
        resolve(answer);
      });
    });
  }

  async convertToBitmap(
    imageBuffer: Buffer,
    height: number,
    applyBlur: boolean = false,
    applyEdges: boolean = false
  ): Promise<{ buffer: Buffer; width: number; height: number }> {
    let image = sharp(imageBuffer);
    const { width: originalWidth, height: originalHeight } =
      await image.metadata();

    if (!originalWidth || !originalHeight) {
      throw new Error("Invalid image dimensions");
    }

    // Resize

    const width = Math.round((height * originalWidth) / originalHeight);

    image = image.resize(width, height);

    const rawImage = await image.raw().toBuffer();

    // Resize image
    const resized = bilinearInterp(
      new Uint8Array(rawImage),
      originalWidth,
      originalHeight,
      width,
      height
    );

    // Apply optional processing
    let processed = resized;
    if (applyBlur) {
      processed = blurImage(processed, width, height);
    }
    if (applyEdges) {
      processed = edges(processed, width, height);
    }
    processed = dither(processed, width, height);

    // Convert to 1-bit bitmap
    const bitmapData = Buffer.alloc(Math.ceil((width * height) / 8));
    let idx = 0;
    for (let x = 0; x < width; x++) {
      let y = height;
      while (y) {
        let b = 0;
        let i = 8;
        while (i--) {
          y--;
          b <<= 1;
          b |= processed[x + y * width] < 128 ? 1 : 0;
        }
        bitmapData[idx++] = b;
      }
    }

    return { buffer: bitmapData, width, height };
  }
}
