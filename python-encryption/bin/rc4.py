from Crypto.Cipher import ARC4

def encrypt(data, key, nonce_length):
    cipher = ARC4.new(key)
    ciphertext = cipher.encrypt(data)
    return ciphertext, b''

def decrypt(data, key, nonce):
    cipher = ARC4.new(key)
    return cipher.decrypt(data)
