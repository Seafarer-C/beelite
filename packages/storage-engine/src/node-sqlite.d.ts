/** Node.js `node:sqlite`（stable）类型占位；与运行时 DatabaseSync API 对齐 */
declare module "node:sqlite" {
  export interface StatementSync {
    run(...params: unknown[]): { changes: number; lastInsertRowid?: bigint | number };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown;
  }

  export class DatabaseSync {
    constructor(
      path: string,
      options?: { enableForeignKeyConstraints?: boolean; timeout?: number }
    );
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
