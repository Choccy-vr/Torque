using System.Text.Json;
using Torque.Users;

namespace Torque.Auth;

// Copies HCA's userinfo claims onto the users row. Claims that weren't sent (scope not
// granted) leave the stored value alone. Returns whether anything changed.
public static class HcaUserSync
{
    public static bool Apply(User user, JsonElement claims)
    {
        var changed = false;

        void Set(string? value, Func<string> get, Action<string> set)
        {
            if (value is null || get() == value) return;
            set(value);
            changed = true;
        }

        void SetBool(bool? value, Func<bool> get, Action<bool> set)
        {
            if (value is null || get() == value) return;
            set(value.Value);
            changed = true;
        }

        Set(Str(claims, "email"), () => user.Email, v => user.Email = v);
        Set(Str(claims, "name"), () => user.Name, v => user.Name = v);
        Set(Str(claims, "slack_id"), () => user.SlackUserID, v => user.SlackUserID = v);

        var verification = Str(claims, "verification_status");
        SetBool(verification is null ? null : string.Equals(verification, "verified", StringComparison.OrdinalIgnoreCase),
            () => user.VerificationStatus, v => user.VerificationStatus = v);
        SetBool(Bool(claims, "ysws_eligible"), () => user.YswsEligible, v => user.YswsEligible = v);

        return changed;
    }

    public static string? Str(JsonElement claims, string name) =>
        claims.ValueKind == JsonValueKind.Object && claims.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String
            ? el.GetString()
            : null;

    private static bool? Bool(JsonElement claims, string name)
    {
        if (claims.ValueKind != JsonValueKind.Object || !claims.TryGetProperty(name, out var el)) return null;
        return el.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String when bool.TryParse(el.GetString(), out var b) => b,
            _ => null,
        };
    }
}
