import Sodium from 'react-native-libsodium';
import * as SecureStore from 'expo-secure-store';
import * as bip39 from 'bip39';
import {Buffer} from 'buffer';

const MASTER_KEY_STORAGE_KEY = 'vaultfit_master_key_enc';
const SALT_STORAGE_KEY = 'vaultfit_salt';
const SESSION_KEY_STORAGE_KEY = 'vaultfit_session_key_b64';

export class KeyManager {
  /**
   * Generates a 12-word BIP39 mnemonic.
   */
  static async generateMnemonic(): Promise<string> {
    const entropy = await Sodium.randombytes_buf(16);
    return bip39.entropyToMnemonic(Buffer.from(entropy));
  }

  /**
   * Derives the 32-byte Master Key from the mnemonic.
   */
  static async mnemonicToMasterKey(mnemonic: string): Promise<Uint8Array> {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    return new Uint8Array(seed.slice(0, 32));
  }

  /**
   * Encrypts the Master Key with the PIN, stores it, and returns a session key.
   */
  static async initializeVault(mnemonic: string, pin: string): Promise<string> {
    try {
      const masterKey = await KeyManager.mnemonicToMasterKey(mnemonic);
      const salt = await Sodium.randombytes_buf(16);
      const keyHash = await Sodium.crypto_pwhash(
        32,
        pin,
        salt,
        Sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
        Sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
        Sodium.crypto_pwhash_ALG_ARGON2ID13,
      );
      const nonce = await Sodium.randombytes_buf(
        Sodium.crypto_secretbox_NONCEBYTES,
      );
      const encryptedMasterKey = await Sodium.crypto_secretbox_easy(
        masterKey,
        nonce,
        keyHash,
      );
      const combinedEncryptedData = new Uint8Array(
        nonce.length + encryptedMasterKey.length,
      );
      combinedEncryptedData.set(nonce);
      combinedEncryptedData.set(encryptedMasterKey, nonce.length);

      await SecureStore.setItemAsync(
        SALT_STORAGE_KEY,
        Buffer.from(salt).toString('base64'),
      );
      await SecureStore.setItemAsync(
        MASTER_KEY_STORAGE_KEY,
        Buffer.from(combinedEncryptedData).toString('base64'),
      );

      const sessionKeyB64 = await KeyManager.cacheSessionKey(masterKey);
      console.log('[KeyManager] Vault initialized securely.');
      return sessionKeyB64;
    } catch (error) {
      console.error('[KeyManager] Error initializing vault:', error);
      throw error;
    }
  }

  /**
   * Retrieves and decrypts the Master Key using the PIN.
   */
  static async getMasterKey(pin: string): Promise<Uint8Array> {
    try {
      const saltB64 = await SecureStore.getItemAsync(SALT_STORAGE_KEY);
      const encryptedDataB64 = await SecureStore.getItemAsync(
        MASTER_KEY_STORAGE_KEY,
      );

      if (!saltB64 || !encryptedDataB64) {
        throw new Error('Vault not initialized');
      }

      const salt = new Uint8Array(Buffer.from(saltB64, 'base64'));
      const encryptedData = new Uint8Array(
        Buffer.from(encryptedDataB64, 'base64'),
      );
      const nonce = encryptedData.slice(0, Sodium.crypto_secretbox_NONCEBYTES);
      const ciphertext = encryptedData.slice(Sodium.crypto_secretbox_NONCEBYTES);
      const keyHash = await Sodium.crypto_pwhash(
        32,
        pin,
        salt,
        Sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
        Sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
        Sodium.crypto_pwhash_ALG_ARGON2ID13,
      );
      const masterKey = await Sodium.crypto_secretbox_open_easy(
        ciphertext,
        nonce,
        keyHash,
      );
      await KeyManager.cacheSessionKey(masterKey);
      return masterKey;
    } catch (error) {
      console.error('[KeyManager] Error decrypting master key:', error);
      throw new Error('Invalid PIN or corrupted vault');
    }
  }

  static async getSessionKey(): Promise<string | null> {
    return SecureStore.getItemAsync(SESSION_KEY_STORAGE_KEY);
  }

  static async encryptPayload(
    sessionKeyB64: string,
    plaintext: string,
  ): Promise<string> {
    try {
      const key = KeyManager.decodeKey(sessionKeyB64);
      const nonce = await Sodium.randombytes_buf(
        Sodium.crypto_secretbox_NONCEBYTES,
      );
      const message = Buffer.from(plaintext, 'utf-8');
      const ciphertext = await Sodium.crypto_secretbox_easy(
        message,
        nonce,
        key,
      );
      const combined = new Uint8Array(nonce.length + ciphertext.length);
      combined.set(nonce);
      combined.set(ciphertext, nonce.length);
      return Buffer.from(combined).toString('base64');
    } catch (error) {
      console.error('[KeyManager] Failed to encrypt payload', error);
      throw error;
    }
  }

  static async decryptPayload(
    sessionKeyB64: string,
    encrypted: string,
  ): Promise<string> {
    try {
      const key = KeyManager.decodeKey(sessionKeyB64);
      const data = new Uint8Array(Buffer.from(encrypted, 'base64'));
      const nonce = data.slice(0, Sodium.crypto_secretbox_NONCEBYTES);
      const ciphertext = data.slice(Sodium.crypto_secretbox_NONCEBYTES);
      const message = await Sodium.crypto_secretbox_open_easy(
        ciphertext,
        nonce,
        key,
      );
      return Buffer.from(message).toString('utf-8');
    } catch (error) {
      console.error('[KeyManager] Failed to decrypt payload', error);
      throw error;
    }
  }

  private static async cacheSessionKey(masterKey: Uint8Array): Promise<string> {
    const sessionKeyB64 = Buffer.from(masterKey).toString('base64');
    await SecureStore.setItemAsync(SESSION_KEY_STORAGE_KEY, sessionKeyB64);
    return sessionKeyB64;
  }

  private static decodeKey(sessionKeyB64: string): Uint8Array {
    if (!sessionKeyB64) {
      throw new Error('Session key is missing');
    }
    return new Uint8Array(Buffer.from(sessionKeyB64, 'base64'));
  }
}
