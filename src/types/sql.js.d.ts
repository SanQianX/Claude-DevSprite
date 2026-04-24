declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number | string>) => Database;
  }

  interface Database {
    run(sql: string, params?: any[]): Database;
    exec(sql: string, params?: any[]): any[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  interface Statement {
    bind(params?: any[] | Record<string, any>): boolean;
    step(): boolean;
    getAsObject(params?: any[]): Record<string, any>;
    getColumnNames(): string[];
    free(): void;
    reset(): Statement;
  }

  interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export type { Database, Statement, SqlJsStatic, SqlJsConfig };
  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
