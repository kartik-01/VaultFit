// import Sodium from 'react-native-libsodium';

export class KeyManager {
  /**
   * Generates a random 32-byte Master Key.
   */
  static async generateMasterKey(): Promise<Uint8Array> {
    // TODO: Implement using Libsodium
    // return await Sodium.randombytes_buf(32);
    console.warn('KeyManager.generateMasterKey is a mock');
    return new Uint8Array(32);
  }

  /**
   * Hashes a PIN using Argon2.
   */
  static async hashPin(_pin: string, _salt: Uint8Array): Promise<Uint8Array> {
    // TODO: Implement using Libsodium crypto_pwhash
    console.warn('KeyManager.hashPin is a mock');
    return new Uint8Array(32);
  }

  /**
   * Encrypts the Master Key using the hashed PIN (Key Wrapping).
   */
  static async encryptMasterKey(
    masterKey: Uint8Array,
    _key: Uint8Array,
  ): Promise<Uint8Array> {
    // TODO: Implement using Libsodium crypto_secretbox_easy
    console.warn('KeyManager.encryptMasterKey is a mock');
    return new Uint8Array(masterKey.length + 16); // + MAC size
  }

  /**
   * Decrypts the Master Key using the hashed PIN.
   */
  static async decryptMasterKey(
    _encryptedMasterKey: Uint8Array,
    _key: Uint8Array,
  ): Promise<Uint8Array> {
    // TODO: Implement using Libsodium crypto_secretbox_open_easy
    console.warn('KeyManager.decryptMasterKey is a mock');
    return new Uint8Array(32);
  }
}
