import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { AppError } from "../../lib/k8s";
import { getDatabasesByApp, getTableData } from "./service";

function parsePositiveInt(value: unknown, defaultVal: number, max: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return defaultVal;
  return Math.min(n, max);
}

const databasesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/databases/:namespace/:app", {
    schema: {
      tags: ["Databases"],
      summary: "Discovery e metadata de bancos de dados",
      description:
        "Detecta conexões de banco de dados nas variáveis de ambiente e Secrets da aplicação (padrões `DB_*`, `DATABASE_URL`, etc.) e retorna metadata das tabelas e schemas encontrados.",
      params: {
        type: "object",
        required: ["namespace", "app"],
        properties: {
          namespace: { type: "string", example: "production" },
          app: { type: "string", example: "payments-api" },
        },
      },
      response: {
        200: {
          description: "Databases descobertos com metadata",
          type: "object",
          properties: {
            namespace: { type: "string" },
            app: { type: "string" },
            discoveredCount: { type: "number", example: 1 },
            inspectedAt: { type: "string", format: "date-time" },
            databases: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  source: {
                    type: "object",
                    properties: {
                      workloadKind: { type: "string", example: "Deployment" },
                      workloadName: { type: "string", example: "payments-api" },
                      containerName: { type: "string", example: "app" },
                    },
                  },
                  inferredEngine: { type: "string", enum: ["postgres", "mysql", "unknown"] },
                  connected: { type: "boolean" },
                  config: {
                    type: "object",
                    properties: {
                      host: { type: "string", nullable: true, example: "postgres-svc" },
                      port: { type: "number", nullable: true, example: 5432 },
                      user: { type: "string", nullable: true, example: "app_user" },
                      password: { type: "string", nullable: true, example: "***" },
                      database: { type: "string", nullable: true, example: "payments" },
                      url: { type: "string", nullable: true },
                      dbString: { type: "string", nullable: true },
                    },
                  },
                  metadata: {
                    type: "object",
                    nullable: true,
                    properties: {
                      engine: { type: "string" },
                      version: { type: "string", nullable: true },
                      schemas: { type: "array", items: { type: "string" } },
                      tables: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            schema: { type: "string", example: "public" },
                            table: { type: "string", example: "transactions" },
                            rowEstimate: { type: "number", nullable: true, example: 123421 },
                            sizeBytes: { type: "number", nullable: true, example: 125829120 },
                          },
                        },
                      },
                    },
                  },
                  warning: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        403: { description: "Namespace não permitido", $ref: "HttpError#" },
        404: { description: "Nenhum banco encontrado para a aplicação", $ref: "HttpError#" },
      },
    },
  }, async (request: any) => {
    return getDatabasesByApp(request.params.namespace, request.params.app);
  });

  fastify.get("/databases/:namespace/:app/tables/:schema/:table/data", {
    schema: {
      tags: ["Databases"],
      summary: "Dados de uma tabela (somente leitura)",
      description: "Retorna linhas de uma tabela descoberta. Apenas visualização, sem operações de escrita.",
      params: {
        type: "object",
        required: ["namespace", "app", "schema", "table"],
        properties: {
          namespace: { type: "string", example: "production" },
          app: { type: "string", example: "payments-api" },
          schema: { type: "string", example: "public" },
          table: { type: "string", example: "users" },
        },
      },
      querystring: {
        type: "object",
        properties: {
          limit: { type: "number", default: 100, description: "Máximo 1000" },
          offset: { type: "number", default: 0 },
        },
      },
      response: {
        200: {
          description: "Dados da tabela",
          type: "object",
          properties: {
            namespace: { type: "string" },
            app: { type: "string" },
            schema: { type: "string" },
            table: { type: "string" },
            rows: { type: "array", items: { type: "object", additionalProperties: true } },
            limit: { type: "number" },
            offset: { type: "number" },
          },
        },
        403: { $ref: "HttpError#" },
        404: { $ref: "HttpError#" },
      },
    },
  }, async (request: any, reply: FastifyReply) => {
    try {
      const limit = parsePositiveInt(request.query?.limit, 100, 1000);
      const offset = parsePositiveInt(request.query?.offset, 0, 1_000_000);
      return getTableData(
        request.params.namespace,
        request.params.app,
        request.params.schema,
        request.params.table,
        limit,
        offset,
      );
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      throw error;
    }
  });
};

export default databasesRoutes;
