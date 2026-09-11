namespace Torque.Hackatime;

// Thrown when a Hackatime account turns out to be banned/red-trust at OAuth connect time.
public class HackatimeBannedException(string message) : Exception(message);
