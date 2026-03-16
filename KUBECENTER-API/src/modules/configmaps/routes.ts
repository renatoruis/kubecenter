import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { AppError } from "../../lib/k8s";
import { getApplicationConfigMaps } from "./service";


const sendError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(error.toJSON());
  }
  return reply.status(500).send({ error: "UNEXPECTED_ERROR", message: "Unexpected error." });
};

const configMapsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/configmaps/:namespace/:app", {
    schema: {
      tags: ["ConfigMaps"],
      summary: "ConfigMaps de uma aplicação",
      description:
        "Retorna todos os ConfigMaps referenciados por volumes, envFrom ou variáveis de ambiente do Deployment.",
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
          description: "ConfigMaps encontrados",
          type: "object",
          properties: {
            app: { type: "string" },
            namespace: { type: "string" },
            count: { type: "number", example: 2 },
            configMaps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", example: "payments-api-config" },
                  found: { type: "boolean" },
                  usage: { type: "array", items: { type: "string" }, example: ["envFrom:app", "volume:config"] },
                  data: { type: "object", additionalProperties: { type: "string" } },
                  binaryDataKeys: { type: "array", items: { type: "string" } },
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
      return await getApplicationConfigMaps(request.params.namespace, request.params.app);
    } catch (error) {
      return sendError(reply, error);
    }
  });
};

export default configMapsRoutes;
