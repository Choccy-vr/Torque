namespace Torque.Hackatime;

// Thrown when a Hackatime account turns out to be banned/red-trust at OAuth connect time.
public class HackatimeBannedException(string message) : Exception(message);

// Thrown when Hackatime can't be reached to check an account at connect time, so the
// connection is refused rather than let through without a trust check.
public class HackatimeUnavailableException(string message) : Exception(message);
