import { getDeviceList, usb, Endpoint, Interface, OutEndpoint } from "usb";

export class Printer {
  private device?: usb.Device;
  private interface?: Interface;
  private endpoint?: OutEndpoint;
  constructor(vendorId: number, productId: number) {
    const devices: usb.Device[] = getDeviceList();
    this.device = devices.find((device) => {
      return (
        device.deviceDescriptor.idVendor === vendorId &&
        device.deviceDescriptor.idProduct === productId
      );
    });
    if (!this.device) {
      throw new Error("Printer not found");
    }
  }

  async open(): Promise<void> {
    if (!this.device) {
      throw new Error("Device not found");
    }
    await this.device.open();
    this.interface = this.device?.interfaces?.[0];
    const endpoint = this.interface?.endpoints[0];
    if (endpoint?.direction !== "out") {
      throw new Error("First endpoint is not an out endpoint");
    }
    this.endpoint = endpoint as OutEndpoint;
    await this.device.setConfiguration(1);
    await this.interface?.claim();
  }

  async write(data: number | number[]): Promise<void> {
    //await new Promise((resolve) => setTimeout(resolve, 500));
    return new Promise((resolve, reject) => {
      if (!this.endpoint) {
        reject(new Error("Printer not connected"));
        return;
      }

      this.endpoint.transfer(
        Buffer.from(Array.isArray(data) ? data : [data]),
        async (err) => {
          // Add sleep

          if (err) reject(err);
          else resolve();
        }
      ); //*/
    });
  }

  async begin(): Promise<void> {
    await this.wake();
    await this.init();
  }

  async wake(): Promise<void> {
    await this.write(0xff);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async init(): Promise<void> {
    await this.write([0x1b, 0x40]); // ESC @
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async font(mode: number): Promise<void> {
    await this.write([0x1b, 0x21, mode]);
  }

  async setCharTable(table: number): Promise<void> {
    await this.write([0x1b, 0x74, table]);
  }

  async beginBitmap(w: number, h: number): Promise<void> {
    await this.write([0x12, 0x2a, h, w]);
  }

  async drawBitmap(bitmap: Buffer, w: number, h: number): Promise<void> {
    w = Math.ceil(w / 8); // round up

    const reader = {
      index: 0,
      read: () => bitmap[reader.index++],
      online: () => reader.index < bitmap.length,
    };

    // Check bitmap.length = w * h
    if (bitmap.length !== w * h) {
      throw new Error("Bitmap size does not match width and height");
    }

    // Send bitmap data
    await this.beginBitmap(w, h);
    const output = [];
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        const bit = reader.read();
        console.log(`Writing bit ${bit}`, reader.index);
        output.push(bit);
      }
    }
    await this.write(output);
  }

  async config(
    dots: number = 7,
    time: number = 80,
    interval: number = 2
  ): Promise<void> {
    await this.write([0x1b, 0x37, dots, time, interval]);
  }

  async sleep(): Promise<void> {
    await this.write([0x1b, 0x38, 1, 0]);
  }

  async statusBack(rts: boolean = true, asb: boolean = false): Promise<void> {
    const value = ((asb ? 1 : 0) << 2) | ((rts ? 1 : 0) << 5);
    await this.write([0x1d, 0x61, value]);
  }

  async print(text: string): Promise<void> {
    const data = Array.from(Buffer.from(text, "utf-8"));
    await this.write(data);
  }

  async close(): Promise<void> {
    if (this.device && this.interface) {
      this.interface.release(true, (err: any) => {
        if (err) console.error("Error releasing interface:", err);
      });
      this.device.close();
    }
  }
}
