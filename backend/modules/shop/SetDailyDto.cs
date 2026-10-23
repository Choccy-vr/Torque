namespace Torque.Shop;
// Body for setting today's daily item. Leave ItemId out to reroll at random.
public record SetDailyDto
{
    public Guid? ItemId { get; init; }
}
