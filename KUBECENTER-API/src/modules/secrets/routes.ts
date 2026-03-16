import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { AppError } from "../../lib/k8s";
import { getApplicationSecrets, getSecretValues, getSecretValueForKey } from "./service";


const sendError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(error.toJSON());
  }
  return reply.status(500).send({ error: "UNEXPECTED_ERROR", message: "Unexpected error." });
};

const secretsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/secrets/:namespace/:app", {
    schema: {
      tags: ["Secrets"],
      summary: "Secrets de uma aplicação",
      description:
        "Lista os Secrets referenciados pela aplicação. Por padrão retorna apenas as **chaves** (sem valores), protegendo dados sensíveis.",
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
          description: "Secrets encontrados (apenas keys)",
          type: "object",
          properties: {
            app: { type: "string" },
            namespace: { type: "string" },
            count: { type: "number", example: 1 },
            secrets: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", example: "payments-api-db-secret" },
                  found: { type: "boolean" },
                  type: { type: "string", nullable: true, example: "Opaque" },
                  usage: { type: "array", items: { type: "string" }, example: ["envFrom:app"] },
                  keys: { type: "array", items: { type: "string" }, example: ["DB_HOST", "DB_PASSWORD"] },
                  entries: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        key: { type: "string" },
                        value: { type: "string", description: "Sempre *** por padrão. Use GET /secrets/:ns/:name/values/:key para revelar." },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        403: { $ref: "HttpError#" },
        404: { $ref: "HttpError#" },
      },
    },
  }, async (request: any, reply) => {
    try {
      return await getApplicationSecrets(request.params.namespace, request.params.app);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/secrets/:namespace/:secretName/values", {
    schema: {
      tags: ["Secrets"],
      summary: "Valores de um Secret (decodificados)",
      description:
        "Retorna os valores decodificados (base64 → texto) de um Secret específico. Use com cautela — expõe dados sensíveis.",
      params: {
        type: "object",
        required: ["namespace", "secretName"],
        properties: {
          namespace: { type: "string", example: "production" },
          secretName: { type: "string", example: "payments-api-db-secret" },
        },
      },
      response: {
        200: {
          description: "Valores decodificados do Secret",
          type: "object",
          properties: {
            name: { type: "string" },
            namespace: { type: "string" },
            type: { type: "string", nullable: true },
            values: {
              type: "object",
              additionalProperties: { type: "string" },
              example: { DB_HOST: "postgres-svc", DB_PASSWORD: "s3cr3t" },
            },
          },
        },
        403: { $ref: "HttpError#" },
        404: { $ref: "HttpError#" },
      },
    },
  }, async (request: any, reply) => {
    try {
      return await getSecretValues(request.params.namespace, request.params.secretName);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/secrets/:namespace/:secretName/values/:key", {
    schema: {
      tags: ["Secrets"],
      summary: "Valor de uma chave de Secret",
      description: "Retorna o valor decodificado de uma chave específica. Use com cautela.",
      params: {
        type: "object",
        required: ["namespace", "secretName", "key"],
        properties: {
          namespace: { type: "string", example: "production" },
          secretName: { type: "string", example: "payments-api-db-secret" },
          key: { type: "string", example: "DB_HOST" },
        },
      },
      response: {
        200: {
          description: "Valor da chave",
          type: "object",
          properties: {
            key: { type: "string" },
            value: { type: "string" },
          },
        },
        403: { $ref: "HttpError#" },
        404: { $ref: "HttpError#" },
      },
    },
  }, async (request: any, reply) => {
    try {
      return await getSecretValueForKey(
        request.params.namespace,
        request.params.secretName,
        request.params.key,
      );
    } catch (error) {
      return sendError(reply, error);
    }
  });
};

export default secretsRoutes;
