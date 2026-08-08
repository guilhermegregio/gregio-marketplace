const DISCORD_EPOCH = 1420070400000n;

export function timestampToSnowflake(timestampMs) {
  const ms = BigInt(Math.max(0, Math.floor(timestampMs)));
  return ((ms - DISCORD_EPOCH) << 22n).toString();
}

export function snowflakeToTimestamp(snowflake) {
  return Number((BigInt(snowflake) >> 22n) + DISCORD_EPOCH);
}
