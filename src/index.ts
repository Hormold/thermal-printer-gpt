import "dotenv/config";
import { PrinterGPTAssistant } from "./interactive";
import { Printer } from "./printer";

const apiKey = process.env.OPENAI_API_KEY!;
if (!apiKey) {
  console.error("Please set the OPENAI_API_KEY environment variable.");
  process.exit(1);
}

async function main() {
  const VENDOR_ID = 0x28e9;
  const PRODUCT_ID = 0x0289;

  const printer = new Printer(VENDOR_ID, PRODUCT_ID);

  await printer.open();
  await printer.begin();
  await printer.config(10, 140, 4);
  //await printer.font(0x01);
  await printer.print("Hello, world!");
  const app = new PrinterGPTAssistant(apiKey, printer);
  await app.runInteractiveMode();
}

main();
