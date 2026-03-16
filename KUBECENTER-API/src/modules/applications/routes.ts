import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { AppError } from "../../lib/k8s";
import { getApplicationDetail, getDeploymentRevisions, listApplications } from "./service";

const nsAppParams = {
  type: "object",
  required: ["namespace", "app"],
  properties: {
    namespace: { type: "string", description: "Nome do namespace", example: "production" },
    app: { type: "string", description: "Nome da aplicação (Deployment)", example: "payments-api" },
  },
};


const sendError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(error.toJSON());
  }
  return reply.status(500).send({ error: "UNEXPECTED_ERROR", message: "Unexpected error." });
};

const applicationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/applications", {
    schema: {
      tags: ["Applications"],
      summary: "Listar aplicações",
      description: "Retorna todas as aplicações (Deployments) nos namespaces monitorados.",
      response: {
        200: {
          description: "Lista de aplicações",
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", example: "payments-api" },
              namespace: { type: "string", example: "production" },
              replicas: { type: "number", example: 3 },
              availableReplicas: { type: "number", example: 3 },
              image: { type: "string", nullable: true, example: "company/payments-api:v2.1.3" },
              services: { type: "array", items: { type: "string" }, example: ["payments-api-svc"] },
              status: { type: "string", enum: ["healthy", "degraded", "scaled-down"] },
            },
          },
        },
        500: { $ref: "HttpError#" },
      },
    },
  }, async (_, reply) => {
    try {
      return await listApplications();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/applications/:namespace/:app", {
    schema: {
      tags: ["Applications"],
      summary: "Detalhe de uma aplicação",
      description:
        "Retorna spec completo de um Deployment: containers, env vars, services vinculados, ingress, referências a ConfigMaps e Secrets.",
      params: nsAppParams,
      response: {
        200: {
          description: "Detalhe da aplicação",
          type: "object",
          properties: {
            name: { type: "string" },
            namespace: { type: "string" },
            deployment: {
              type: "object",
              properties: {
                replicas: { type: "number" },
                availableReplicas: { type: "number" },
                strategy: { type: "string" },
                selector: { type: "object", additionalProperties: { type: "string" } },
                updatedAt: { type: "string", nullable: true },
              },
            },
            containers: { type: "array", items: { type: "object", additionalProperties: true } },
            services: { type: "array", items: { type: "string" } },
            ingress: { type: "array", items: { type: "object", additionalProperties: true } },
            configmaps: { type: "array", items: { type: "string" } },
            secrets: { type: "array", items: { type: "string" } },
            hpa: {
              type: "object",
              nullable: true,
              properties: {
                name: { type: "string" },
                minReplicas: { type: "number" },
                maxReplicas: { type: "number" },
                currentReplicas: { type: "number" },
                desiredReplicas: { type: "number" },
                metrics: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      name: { type: "string" },
                      currentAverageUtilization: { type: "number", nullable: true },
                      currentAverageValue: { type: "string", nullable: true },
                      targetAverageUtilization: { type: "number", nullable: true },
                      targetAverageValue: { type: "string", nullable: true },
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
      return await getApplicationDetail(request.params.namespace, request.params.app);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/applications/:namespace/:app/revisions", {
    schema: {
      tags: ["Applications"],
      summary: "Histórico de revisões de um Deployment",
      description:
        "Retorna a lista de ReplicaSets (revisões) vinculados ao Deployment, ordenados da mais recente para a mais antiga.",
      params: nsAppParams,
      response: {
        200: {
          description: "Lista de revisões",
          type: "array",
          items: {
            type: "object",
            properties: {
              revision: { type: "number", example: 5 },
              image: { type: "string", example: "company/api:v2.1.3" },
              createdAt: { type: "string", example: "2025-06-01T12:00:00Z" },
              replicas: { type: "number", example: 3 },
              isActive: { type: "boolean", example: true },
            },
          },
        },
        403: { $ref: "HttpError#" },
        404: { $ref: "HttpError#" },
      },
    },
  }, async (request: any, reply) => {
    try {
      return await getDeploymentRevisions(request.params.namespace, request.params.app);
    } catch (error) {
      return sendError(reply, error);
    }
  });
};

export default applicationsRoutes;
