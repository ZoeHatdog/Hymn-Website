import { pool } from "./db/pool.js";

type DbNotification = {
  channel: string;
  payload?: string;
};

type DbClient = {
  processID: number;
  on(event: "notification", listener: (msg: DbNotification) => void): void;
  on(event: "error", listener: (err: Error) => void): void;
};

type FieldDef = { type: string; required?: boolean } | [string, boolean?];

type Model = {
  schema: string;
  table?: string;
  table_name?: string;
  fields: Record<string, FieldDef>;
  primary_key: string;
  default_sort?: string;
  default_order?: string[] | Record<string, string>;
};

type ApiParams = Record<string, unknown> | null | undefined;
type Criteria = Record<string, unknown> | null | undefined;
type OrderInput = string | string[] | Record<string, string> | null | undefined;
type Row = Record<string, unknown>;

type WhereClause = {
  type: "where" | "whereRaw" | "whereArray";
  operator: string;
  value: unknown;
};

type NestedSql = {
  type: "sql";
  value: string;
};

class GoodCursor {
  private verbose = true;

  init(): void {
    pool.connect((err: Error | undefined, client: DbClient, done: () => void) => {
      if (err || !client) {
        console.error(`[db] connect failed: ${err?.message ?? "no client"}`);
        return;
      }

      console.log(`[db] connected pid=${client.processID}`);

      client.on("notification", (msg: DbNotification) => {
        console.log(`[db] notification channel=${msg.channel} payload=${msg.payload ?? ""}`);
      });

      client.on("error", (clientErr: Error) => {
        console.error(`[db] client error pid=${client.processID}: ${clientErr.message}`);
      });

      done();
    });
  }

  toggleVerbose(): void {
    this.verbose = !this.verbose;
  }

  whereGreater(value: unknown): WhereClause {
    return { type: "where", operator: ">", value };
  }

  whereGreaterEqual(value: unknown): WhereClause {
    return { type: "where", operator: ">=", value };
  }

  whereLess(value: unknown): WhereClause {
    return { type: "where", operator: "<", value };
  }

  whereLessEqual(value: unknown): WhereClause {
    return { type: "where", operator: "<=", value };
  }

  whereLike(value: unknown): WhereClause {
    return { type: "where", operator: "ILIKE", value };
  }

  whereNotNull(): WhereClause {
    return { type: "whereRaw", operator: "IS NOT", value: "NULL" };
  }

  whereOr(value: Record<string, unknown> | unknown[]): WhereClause {
    return { type: "whereArray", operator: "OR", value };
  }

  buildNestedQuery(sql: string): NestedSql {
    return { type: "sql", value: sql };
  }

  async getAll(model: Model, apiParams?: ApiParams, qryCriteria?: Criteria, qryOrder?: OrderInput): Promise<Row[]> {
    return this.query(buildSelect(model, apiParams, qryCriteria, qryOrder));
  }

  async getOne(model: Model, apiParams?: ApiParams, qryCriteria?: Criteria, qryOrder?: OrderInput): Promise<Row[]> {
    return this.query(buildSelect(model, apiParams, qryCriteria, qryOrder, 1));
  }

  async getTotals(model: Model, apiParams?: ApiParams, qryCriteria?: Criteria): Promise<Row[]> {
    return this.query(buildSelectTotals(model, apiParams, qryCriteria));
  }

  async getPagerAll(model: Model, apiParams?: ApiParams, qryCriteria?: Criteria, qryOrder?: OrderInput) {
    const rows = await this.query(buildSelect(model, apiParams, qryCriteria, qryOrder, null, true));
    const info = await this.getPagerInfo(model, apiParams, qryCriteria);
    return { rows, grand_totals: info.grand_totals, pager: info.pager };
  }

  async insert(model: Model, qryRows: Row, qryReturnField: string | null = null): Promise<Row[]> {
    const sql = buildInsert(model, qryRows, qryReturnField);
    if (!sql) {
      throw new Error("Insert has no writable fields");
    }
    return this.query(sql);
  }

  async update(model: Model, qryRows: Row, qryCriteria?: Criteria): Promise<Row[]> {
    return this.query(buildUpdate(model, qryRows, qryCriteria));
  }

  async delete(model: Model, qryCriteria?: Criteria): Promise<{ rows: Row[] }> {
    const rows = await this.query(buildDelete(model, qryCriteria));
    return { rows };
  }

  private async getPagerInfo(model: Model, apiParams?: ApiParams, qryCriteria?: Criteria) {
    const page = apiParams && apiParams.page != null ? parseInt(String(apiParams.page), 10) : 1;
    const maxrows = apiParams && apiParams.maxrows != null ? parseInt(String(apiParams.maxrows), 10) : 0;
    const result = await this.getTotals(model, apiParams, qryCriteria);
    const grand_totals = result[0] ?? { count: 0 };
    const count = parseInt(String(grand_totals.count ?? 0), 10);
    return {
      grand_totals,
      pager: {
        page: Number.isNaN(page) ? 1 : page,
        totalrows: count,
        totalpages: maxrows > 0 ? Math.ceil(count / maxrows) : 0,
      },
    };
  }

  private async query(sql: string): Promise<Row[]> {
    if (this.verbose) {
      console.log(sql);
    }
    const result = await pool.query(sql);
    return result.rows as Row[];
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && value?.constructor === Object;
}

function isWhereClause(value: unknown): value is WhereClause {
  return isObject(value) && (value.type === "where" || value.type === "whereRaw" || value.type === "whereArray");
}

function isNestedSql(value: unknown): value is NestedSql {
  return isObject(value) && value.type === "sql" && typeof value.value === "string";
}

function fieldType(def: FieldDef): string {
  return Array.isArray(def) ? def[0] : def.type;
}

function sqlLiteral(fields: Record<string, FieldDef>, field: string, value: unknown): string {
  const def = fields[field];
  if (!def) {
    return dollarQuote(value, "gc");
  }
  const type = fieldType(def);
  if (value == null) {
    return "NULL";
  }
  if (type === "integer") {
    const parsed = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isInteger(parsed)) {
      throw new Error("Expected an integer for " + field);
    }
    return String(parsed);
  }
  if (type === "array") {
    const items = Array.isArray(value) ? value : [value];
    if (items.length === 0) {
      return "ARRAY[]::text[]";
    }
    return "ARRAY[" + items.map((item) => dollarQuote(item, "gc")).join(", ") + "]::text[]";
  }
  if (type === "json") {
    return dollarQuote(JSON.stringify(value), "gc_js") + "::jsonb";
  }
  if (type === "date") {
    return dollarQuote(value, "gc") + "::timestamptz";
  }
  return dollarQuote(value, "gc_def");
}

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error("Invalid identifier: " + name);
  }
  if (/[A-Z]/.test(name)) {
    return '"' + name + '"';
  }
  return name;
}

function tableRef(model: Model): string {
  const table = model.table ?? model.table_name;
  if (!table) {
    throw new Error("Model is missing a table name");
  }
  return model.schema + "." + table;
}

function dollarQuote(value: unknown, tag: string): string {
  const text = String(value);
  let use = tag;
  while (text.includes("$" + use + "$")) {
    use = tag + "_" + Math.random().toString(36).slice(2, 8);
  }
  return "$" + use + "$" + text + "$" + use + "$";
}

function allowedOperator(operator: string): string {
  const op = operator.toUpperCase();
  const allowed = ["=", "<>", "!=", ">", ">=", "<", "<=", "ILIKE", "LIKE", "IS", "IS NOT", "AND", "OR"];
  if (!allowed.includes(op)) {
    throw new Error("Unsupported operator: " + operator);
  }
  return op === "!=" ? "<>" : op;
}

function buildFieldValue(fields: Record<string, FieldDef>, qryField: string, qryValue: unknown): string | false {
  if (qryField === "id") {
    return false;
  }
  if (qryValue == null) {
    return "NULL";
  }
  if (isNestedSql(qryValue)) {
    return "(" + qryValue.value + ")";
  }
  if (!Object.prototype.hasOwnProperty.call(fields, qryField)) {
    return false;
  }

  const value = sqlLiteral(fields, qryField, qryValue);

  if (typeof qryValue === "string" && qryValue.length === 0) {
    return "NULL";
  }

  return value;
}

function buildInsert(model: Model, qryRows: Row, qryReturnField: string | null): string | false {
  const keys: string[] = [];
  const values: string[] = [];

  for (const field of Object.keys(qryRows)) {
    const value = buildFieldValue(model.fields, field, qryRows[field]);
    if (value) {
      keys.push(quoteIdent(field));
      values.push(value);
    }
  }

  if (keys.length === 0) {
    return false;
  }

  const returnKey = quoteIdent(
    qryReturnField && Object.prototype.hasOwnProperty.call(model.fields, qryReturnField)
      ? qryReturnField
      : model.primary_key,
  );

  let sql = "INSERT INTO " + tableRef(model);
  sql += " ( " + keys.join(", ") + " )";
  sql += " VALUES (" + values.join(", ") + ")";
  sql += " RETURNING " + returnKey;
  return sql;
}

function buildUpdate(model: Model, qryRows: Row, qryCriteria?: Criteria): string {
  const assignments: string[] = [];

  for (const field of Object.keys(qryRows)) {
    const value = buildFieldValue(model.fields, field, qryRows[field]);
    if (value) {
      assignments.push(quoteIdent(field) + "=" + value);
    }
  }

  let sql = "UPDATE " + tableRef(model);
  sql += " SET " + assignments.join(", ");
  sql += buildWhere(model, qryCriteria);
  sql += " RETURNING " + quoteIdent(model.primary_key);
  return sql;
}

function buildDelete(model: Model, qryCriteria?: Criteria): string {
  return "DELETE FROM " + tableRef(model) + buildWhere(model, qryCriteria) + " RETURNING " + quoteIdent(model.primary_key);
}

function buildSelect(
  model: Model,
  apiParams?: ApiParams,
  qryCriteria?: Criteria,
  qryOrder?: OrderInput,
  qryLimit?: number | null,
  qryPagination?: boolean,
): string {
  const columns = Object.keys(model.fields).map(quoteIdent);

  let sql = "SELECT " + columns.join(", ");
  sql += buildFrom(model);
  sql += buildWhere(model, qryCriteria);
  sql += buildOrder(model, apiParams, qryOrder);
  sql += buildLimit(apiParams, qryLimit, qryPagination);
  return sql;
}

function buildSelectTotals(model: Model, apiParams?: ApiParams, qryCriteria?: Criteria): string {
  const totals = new Map<string, string>();
  if (apiParams) {
    for (const key of Object.keys(apiParams)) {
      if (!key.startsWith("gt_") || typeof apiParams[key] !== "string") continue;
      const [field, fn] = String(apiParams[key]).split(",");
      if (field && Object.prototype.hasOwnProperty.call(model.fields, field)) {
        totals.set(field, fn ?? "sum");
      }
    }
  }

  const columns = ["COUNT(" + quoteIdent(model.primary_key) + ") as count"];
  for (const [field, fn] of Array.from(totals.entries())) {
    const column = quoteIdent(field);
    if (fn === "avg") {
      columns.push("AVG(" + column + ") as " + column);
    } else {
      columns.push("SUM(" + column + ") as " + column);
    }
  }

  let sql = "SELECT " + columns.join(", ");
  sql += buildFrom(model);
  sql += buildWhere(model, qryCriteria);
  return sql;
}

function buildFrom(model: Model): string {
  return " FROM " + tableRef(model);
}

function buildWhere(model: Model, qryCriteria?: Criteria): string {
  if (!qryCriteria || Object.keys(qryCriteria).length === 0) {
    return "";
  }

  const args: string[] = [];
  for (const key of Object.keys(qryCriteria)) {
    const value = qryCriteria[key];
    if (Array.isArray(value)) {
      const parts = value
        .map((item) => buildWhereArgs(model, key, item))
        .filter((part): part is string => Boolean(part));
      if (parts.length > 0) {
        args.push("(" + parts.join(" AND ") + ")");
      }
    } else {
      const part = buildWhereArgs(model, key, value);
      if (part) {
        args.push(part);
      }
    }
  }

  if (args.length === 0) {
    return "";
  }

  return " WHERE " + args.join(" AND ");
}

function buildWhereArgs(model: Model, qryField: string, qryValue: unknown): string | false {
  if (qryValue != null && isWhereClause(qryValue)) {
    switch (qryValue.type) {
      case "whereRaw":
        return quoteIdent(qryField) + " " + allowedOperator(qryValue.operator) + " " + String(qryValue.value);
      case "whereArray": {
        const parts: string[] = [];
        if (isObject(qryValue.value)) {
          for (const key of Object.keys(qryValue.value)) {
            const part = buildWhereArgs(model, key, qryValue.value[key]);
            if (part) parts.push(part);
          }
        } else if (Array.isArray(qryValue.value)) {
          for (const item of qryValue.value) {
            parts.push(quoteIdent(qryField) + " = " + sqlLiteral(model.fields, qryField, item));
          }
        }
        return "(" + parts.join(" " + allowedOperator(qryValue.operator) + " ") + ")";
      }
      case "where":
      default:
        return quoteIdent(qryField) + " " + allowedOperator(qryValue.operator) + " " + sqlLiteral(model.fields, qryField, qryValue.value);
    }
  }

  if (qryValue == null && Object.prototype.hasOwnProperty.call(model.fields, qryField)) {
    return quoteIdent(qryField) + " IS NULL";
  }

  if (Object.prototype.hasOwnProperty.call(model.fields, qryField)) {
    return quoteIdent(qryField) + " = " + sqlLiteral(model.fields, qryField, qryValue);
  }

  return false;
}

function orderFragments(model: Model, raw: OrderInput): string[] {
  const items = Array.isArray(raw)
    ? raw.map(String)
    : raw && typeof raw === "object"
      ? Object.values(raw).map(String)
      : typeof raw === "string" && raw.length > 0
        ? [raw]
        : [];

  const out: string[] = [];
  for (const item of items) {
    const [field, direction] = item.trim().split(/\s+/);
    if (!field || !Object.prototype.hasOwnProperty.call(model.fields, field)) continue;
    const dir = (direction ?? "ASC").toUpperCase();
    if (dir !== "ASC" && dir !== "DESC") continue;
    out.push(quoteIdent(field) + " " + dir);
  }
  return out;
}

function buildOrder(model: Model, apiParams?: ApiParams, qryOrder?: OrderInput): string {
  let fragments: string[] = [];

  if (apiParams && typeof apiParams.sortby === "string") {
    const fields = apiParams.sortby.split(",");
    const dirs = typeof apiParams.sortdir === "string" ? apiParams.sortdir.split(",") : [];
    fragments = fields.flatMap((field, index) => {
      const name = field.trim();
      if (!Object.prototype.hasOwnProperty.call(model.fields, name)) return [];
      const dir = (dirs[index] ?? "ASC").trim().toUpperCase();
      if (dir !== "ASC" && dir !== "DESC") return [];
      return [quoteIdent(name) + " " + dir];
    });
  }

  if (fragments.length === 0) {
    fragments = orderFragments(model, qryOrder ?? model.default_order ?? model.default_sort ?? model.primary_key);
  }

  if (fragments.length === 0) {
    return "";
  }

  return " ORDER BY " + fragments.join(", ");
}

function buildLimit(apiParams: ApiParams, qryLimit?: number | null, qryPagination?: boolean): string {
  let limit = 0;
  if (qryLimit) {
    limit = parseInt(String(qryLimit), 10);
  } else if (apiParams && apiParams.maxrows != null) {
    limit = parseInt(String(apiParams.maxrows), 10);
  }

  if (!limit || Number.isNaN(limit)) {
    return "";
  }

  let sql = " LIMIT " + limit;
  if (qryPagination && apiParams && apiParams.page != null) {
    const page = parseInt(String(apiParams.page), 10);
    const offset = limit * ((Number.isNaN(page) ? 1 : page) - 1);
    sql += " OFFSET " + offset;
  }
  return sql;
}

export const goodCursor = new GoodCursor();
