import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { AppError } from "../../lib/k8s";
import { listPods, describePod } from "./service";


const sendError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(error.toJSON());
  }
  return reply.status(500).send({ error: "UNEXPECTED_ERROR", message: "Unexpected error." });
};

const podItemSchema = {
  type: "object",
  properties: {
    name: { type: "string", example: "payments-api-abc123" },
    namespace: { type: "string", example: "production" },
    node: { type: "string", nullable: true, example: "hz-dev-server-2" },
    status: { type: "string", example: "Running" },
    restartCount: { type: "number", example: 0 },
    images: { type: "array", items: { type: "string" }, example: ["company/payments-api:v2.1.3"] },
    resources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          container: { type: "string" },
          requests: { type: "object", additionalProperties: { type: "string" } },
          limits: { type: "object", additionalProperties: { type: "string" } },
        },
      },
    },
  },
};

const podsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/pods", {
    schema: {
      tags: ["Pods"],
      summary: "Listar pods",
      description: "Lista pods com filtros opcionais por namespace e aplicação.",
      querystring: {
        type: "object",
        properties: {
          namespace: { type: "string", description: "Filtrar por namespace", example: "production" },
          app: { type: "string", description: "Filtrar pelo nome do Deployment", example: "payments-api" },
        },
      },
      response: {
        200: { description: "Lista de pods", type: "array", items: podItemSchema },
        403: { $ref: "HttpError#" },
        404: { $ref: "HttpError#" },
      },
    },
  }, async (request: any, reply) => {
    try {
      return await listPods(request.query);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/pods/:namespace/:app", {
    schema: {
      tags: ["Pods"],
      summary: "Pods de uma aplicação",
      description: "Lista todos os pods de um Deployment específico.",
      params: {
        type: "object",
        required: ["namespace", "app"],
        properties: {
          namespace: { type: "string", example: "production" },
          app: { type: "string", example: "payments-api" },
        },
      },
      response: {
        200: { description: "Lista de pods", type: "array", items: podItemSchema },
        403: { $ref: "HttpError#" },
        404: { $ref: "HttpError#" },
      },
    },
  }, async (request: any, reply) => {
    try {
      return await listPods({ namespace: request.params.namespace, app: request.params.app });
    } catch (error) {
      return sendError(reply, error);
    }
  });
  fastify.get("/pods/:namespace/describe/:pod", {
    schema: {
      tags: ["Pods"],
      summary: "Describe de um pod",
      description: "Retorna informações detalhadas do pod similar ao kubectl describe.",
      params: {
        type: "object",
        required: ["namespace", "pod"],
        properties: {
          namespace: { type: "string", example: "production" },
          pod: { type: "string", example: "payments-api-abc123-xyz" },
        },
      },
      response: {
        200: {
          description: "Describe do pod",
          type: "object",
          properties: {
            name: { type: "string" },
            namespace: { type: "string" },
            node: { type: "string", nullable: true },
            status: { type: "string" },
            startTime: { type: "string", nullable: true },
            ip: { type: "string", nullable: true },
            qosClass: { type: "string", nullable: true },
            conditions: { type: "array", items: { type: "object" } },
            containers: { type: "array", items: { type: "object" } },
            volumes: { type: "array", items: { type: "object" } },
            events: { type: "array", items: { type: "object" } },
            labels: { type: "object" },
            annotations: { type: "object" },
          },
        },
        403: { $ref: "HttpError#" },
        404: { $ref: "HttpError#" },
      },
    },
  }, async (request: any, reply) => {
    try {
      return await describePod(request.params.namespace, request.params.pod);
    } catch (error) {
      return sendError(reply, error);
    }
  });
};

export default podsRoutes;
