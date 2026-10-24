using Torque.Shop;

namespace Torque.Deadlines;

// Torque's timeline, all US Eastern. Each date is the last day something is open, so it
// closes at the 12 AM Eastern after it: design and build ships until Nov 30, build ships
// until Dec 30, and the shop one more week, until Jan 6. TimeZoneInfo applies daylight
// saving, so these land on 5 AM UTC (EST) even though Torque starts in EDT.
public static class ProgramDates
{
    public static readonly DateOnly DesignShipsLastDay = new(2026, 11, 30);
    public static readonly DateOnly BuildShipsLastDay = new(2026, 12, 30);
    public static readonly DateOnly ShopLastDay = new(2027, 1, 6);

    public static readonly DateTime DesignShipsCloseAt = EndOfDayEastern(DesignShipsLastDay);
    public static readonly DateTime BuildShipsCloseAt = EndOfDayEastern(BuildShipsLastDay);
    public static readonly DateTime ShopClosesAt = EndOfDayEastern(ShopLastDay);

    // Past its deadline, a ship sent back by review gets one more try, within this long
    // of that review (see ShipWindowService).
    public static readonly TimeSpan LateFixWindow = TimeSpan.FromDays(3);

    public static DateTime ShipsCloseAt(bool build) => build ? BuildShipsCloseAt : DesignShipsCloseAt;

    public static bool ShopClosed(DateTime? utcNow = null) => (utcNow ?? DateTime.UtcNow) >= ShopClosesAt;

    // Once the last builds are due there's nothing left to keep a streak for.
    public static bool ProgramOver(DateTime? utcNow = null) => (utcNow ?? DateTime.UtcNow) >= BuildShipsCloseAt;

    private static DateTime EndOfDayEastern(DateOnly day) =>
        TimeZoneInfo.ConvertTimeToUtc(day.AddDays(1).ToDateTime(TimeOnly.MinValue), ShopService.Eastern);
}
