namespace Torque.Users;

// Exempts an action from EnsureUserExistsFilter's ban block. Use only for endpoints
// that exist specifically to be reachable while banned (e.g. "am I banned?") — never
// for anything that does real work.
[AttributeUsage(AttributeTargets.Method)]
public class AllowBannedAttribute : Attribute;
