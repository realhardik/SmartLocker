from hashlib import pbkdf2_hmac
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.backends import default_backend

def gen_key(algo,password, salt):
    if algo=="aes128":
        key_len= 16
    elif algo == "aes256":
        key_len= 32
    elif algo == "aesgcm":
        key_len= 32
    elif algo == "arc4":
        key_len= 16
    elif algo == "blowfish":
        key_len= 32
    elif algo == "chacha20poly1305":
        key_len= 32
    elif algo == "des3":
        key_len= 24
    elif algo == "rc4":
        key_len= 16
    elif algo == "salsa20":
        key_len= 32
    elif algo == "shacal":
        key_len= 64
    elif algo == "xchacha20":
        key_len= 32
    password_bytes = password.encode('utf-8')
    salt_bytes = salt.encode('utf-8')
    passkey=pbkdf2_hmac('sha256', password_bytes, salt_bytes, 100000, key_len)
    print("Passkey length:", len(passkey))
    print("Passkey length:",key_len)
    return passkey
    

