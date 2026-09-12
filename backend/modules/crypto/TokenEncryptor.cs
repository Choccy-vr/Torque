using System.Security.Cryptography;
using System.Text;

namespace Torque.Crypto;

// AES-256-GCM encryption for small secrets (e.g. third-party access tokens) stored
// at rest in the database. Output layout is [12-byte nonce][ciphertext][16-byte tag],
// base64-encoded as a single string so it fits in a normal `text` column.
public class TokenEncryptor
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    private readonly byte[] _key;

    public TokenEncryptor(string base64Key)
    {
        try
        {
            _key = Convert.FromBase64String(base64Key);
        }
        catch (FormatException e)
        {
            throw new InvalidOperationException("TOKEN_ENCRYPTION_KEY must be base64-encoded", e);
        }

        if (_key.Length != 32)
        {
            throw new InvalidOperationException("TOKEN_ENCRYPTION_KEY must decode to 32 bytes (AES-256)");
        }
    }

    public string Encrypt(string plaintext)
    {
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var plainBytes = Encoding.UTF8.GetBytes(plaintext);
        var cipherBytes = new byte[plainBytes.Length];
        var tag = new byte[TagSize];

        using var aes = new AesGcm(_key, TagSize);
        aes.Encrypt(nonce, plainBytes, cipherBytes, tag);

        var result = new byte[NonceSize + cipherBytes.Length + TagSize];
        Buffer.BlockCopy(nonce, 0, result, 0, NonceSize);
        Buffer.BlockCopy(cipherBytes, 0, result, NonceSize, cipherBytes.Length);
        Buffer.BlockCopy(tag, 0, result, NonceSize + cipherBytes.Length, TagSize);

        return Convert.ToBase64String(result);
    }

    public string Decrypt(string encoded)
    {
        var data = Convert.FromBase64String(encoded);
        if (data.Length < NonceSize + TagSize)
        {
            throw new InvalidOperationException("Ciphertext too short to contain nonce and tag");
        }

        var nonce = data[..NonceSize];
        var tag = data[^TagSize..];
        var cipherBytes = data[NonceSize..^TagSize];
        var plainBytes = new byte[cipherBytes.Length];

        using var aes = new AesGcm(_key, TagSize);
        aes.Decrypt(nonce, cipherBytes, tag, plainBytes);

        return Encoding.UTF8.GetString(plainBytes);
    }
}
