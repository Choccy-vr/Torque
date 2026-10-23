using Microsoft.AspNetCore.Mvc;
using Torque.Data;
using Torque.Users;

namespace Torque.Auth;

// Hack Club only rewards people whose identity is verified and who are YSWS-eligible
// (18 or under, not banned for fraud), so shipping and shop orders check this first. The
// flags are synced from HCA at sign-in and every 15 minutes; when they say no, HCA is asked
// again live, so someone who was just verified doesn't have to wait for the next sync.
public class YswsEligibility
{
    public const string UnverifiedCode = "identity_unverified";
    public const string PendingCode = "identity_pending";
    public const string IneligibleCode = "ysws_ineligible";

    private readonly AppDbContext _db;
    private readonly HcaClient _hca;
    private readonly HcaOptions _options;

    public YswsEligibility(AppDbContext db, HcaClient hca, HcaOptions options)
    {
        _db = db;
        _hca = hca;
        _options = options;
    }

    // Null when `user` (tracked by this request's AppDbContext) may go ahead, otherwise
    // the 403 `{ error, code }` to return. `action` finishes "...before you {action}".
    public async Task<IActionResult?> DenyAsync(User user, string action, CancellationToken ct = default)
    {
        if (IsEligible(user)) return null;

        var info = await _hca.GetUserInfoAsync(user, ct);
        string? status = null;
        if (info.Claims is { } claims)
        {
            HcaUserSync.Apply(user, claims);
            status = HcaUserSync.Str(claims, "verification_status");
        }
        // Keeps the fresh flags, and any token refresh the lookup did.
        await _db.SaveChangesAsync(ct);

        if (IsEligible(user)) return null;

        if (user.VerificationStatus || string.Equals(status, "ineligible", StringComparison.OrdinalIgnoreCase))
        {
            return Deny(IneligibleCode,
                $"Your Hack Club identity is verified but isn't eligible for YSWS rewards (usually because of your age), so you can't {action}.");
        }
        if (string.Equals(status, "pending", StringComparison.OrdinalIgnoreCase))
        {
            return Deny(PendingCode,
                $"Your identity verification is still being checked on Hack Club Auth. You can {action} once it's approved.");
        }
        return Deny(UnverifiedCode,
            $"Verify your identity on Hack Club Auth ({_options.Authority}) before you {action}.");
    }

    private static bool IsEligible(User user) => user.VerificationStatus && user.YswsEligible;

    private static ObjectResult Deny(string code, string error) =>
        new(new { error, code }) { StatusCode = StatusCodes.Status403Forbidden };
}
