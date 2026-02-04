import crypto from "crypto";
import { config } from "./config.js";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

function getKey(): Buffer {
  const key = Buffer.from(config.encryptionSecret, "hex");

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `Invalid encryption key length. Expected ${KEY_LENGTH} bytes.`
    );
  }

  return key;
}

export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getKey();

    const cipher = crypto.createCipheriv(ALGO, key, iv);

    const encrypted = Buffer.concat([
      cipher.update(text, "utf8"),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    // Format → iv.tag.data
    return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted.toString(
      "hex"
    )}`;
  } catch (error) {
    throw new Error("Encryption failed");
  }
}

export function decrypt(payload: string): string {
  try {
    const parts = payload.split(".");

    if (parts.length !== 3) {
      throw new Error("Invalid encrypted payload format");
    }

    const [ivHex, tagHex, dataHex] = parts;

    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const encrypted = Buffer.from(dataHex, "hex");

    if (iv.length !== IV_LENGTH) {
      throw new Error("Invalid IV length");
    }

    if (tag.length !== AUTH_TAG_LENGTH) {
      throw new Error("Invalid auth tag length");
    }

    const key = getKey();

    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    throw new Error("Decryption failed or data corrupted");
  }
}
