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


type Model = {
  schema: string;
  table: string;
  defaultSort: string;
}


class GoodCursor {
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
  async getAll(): Promise<any[]>{
    const query = `SELECT * FROM users`;
    const result = await pool.query(query);
    return result.rows;
  }
}


function buildSelect(tblName: Model, params: any, qryCriteria: any, qryOrder: string, qryLimit: number, qryPagination: any) {
  const tbl_fields: string[] = [];

  for (const [key, value] of Object.entries(tblName)) {
    tbl_fields.push(key);
  }

  let sql_statement = "SELECT";
  sql_statement += " " + tbl_fields.join(", ");
  sql_statement += " FROM " + tblName.schema + "." + tblName.table;
  
  //building the where clause 

  sql_statement += buildWhere(Model, qryCriteria);
  
}

function buildWhere(mdl: Model, qryCriteria: any){

  if (!qryCriteria){

    return '';

  }
  
  
}


export const goodCursor = new GoodCursor();