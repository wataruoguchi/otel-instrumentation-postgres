import {
  PG_COMPLEXITY_HIGH,
  PG_COMPLEXITY_LOW,
  PG_COMPLEXITY_MEDIUM,
} from "./constants.js";

export function analyzeQuery(sql: string): {
  operation: string;
  table?: string;
  hasWhere: boolean;
  hasJoin: boolean;
  hasOrderBy: boolean;
  hasLimit: boolean;
  parameterCount: number;
  estimatedComplexity: "low" | "medium" | "high";
} {
  // Remove comments and normalize whitespace
  const cleanSql = sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();
  const upperSql = cleanSql.toUpperCase();

  // Determine operation type
  let operation = "UNKNOWN";
  if (upperSql.startsWith("SELECT")) operation = "SELECT";
  else if (upperSql.startsWith("INSERT")) operation = "INSERT";
  else if (upperSql.startsWith("UPDATE")) operation = "UPDATE";
  else if (upperSql.startsWith("DELETE")) operation = "DELETE";
  else if (upperSql.startsWith("CREATE")) operation = "CREATE";
  else if (upperSql.startsWith("ALTER")) operation = "ALTER";
  else if (upperSql.startsWith("DROP")) operation = "DROP";

  // Extract table name (simplified)
  const tableMatch =
    cleanSql.match(/FROM\s+["`]?(\w+)["`]?/i) ||
    cleanSql.match(/INTO\s+["`]?(\w+)["`]?/i) ||
    cleanSql.match(/UPDATE\s+["`]?(\w+)["`]?/i);
  const table = tableMatch?.[1];

  // Analyze query characteristics
  const hasWhere = upperSql.includes("WHERE");
  const hasJoin = upperSql.includes("JOIN");
  const hasOrderBy = upperSql.includes("ORDER BY");
  const hasLimit = upperSql.includes("LIMIT");

  // Count parameters (simplified - looks for ? placeholders)
  const parameterCount = (sql.match(/\?/g) || []).length;

  // Estimate complexity
  let estimatedComplexity: "low" | "medium" | "high" = PG_COMPLEXITY_LOW;
  if (hasJoin || hasOrderBy || parameterCount > 5)
    estimatedComplexity = PG_COMPLEXITY_MEDIUM;
  if (hasJoin && hasOrderBy && hasWhere)
    estimatedComplexity = PG_COMPLEXITY_HIGH;

  return {
    operation,
    ...(table && { table }),
    hasWhere,
    hasJoin,
    hasOrderBy,
    hasLimit,
    parameterCount,
    estimatedComplexity,
  };
}
