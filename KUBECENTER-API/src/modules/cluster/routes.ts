import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../../lib/k8s";
import { getClusterOverview, getNamespaceOverview } from "./service";

const sendError = (reply: import("fastify").FastifyReply, error: unknown) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(error.toJSON());
  }
  return reply.status(500).send({ error: "UNEXPECTED_ERROR", message: "Unexpected error." });
};

const clusterRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", {
    schema: {
      tags: ["Cluster"],
      summary: "Visão geral do cluster",
      description:
        "Retorna informações gerais do cluster: nós, namespaces monitorados, totais de pods, deployments e services.",
      response: {
        200: {
          description: "Sucesso",
          type: "object",
          properties: {
            watchedNamespaces: { type: "array", items: { type: "string" }, example: ["default", "production"] },
            nodes: {
              type: "object",
              properties: {
                total: { type: "number", example: 2 },
                ready: { type: "number", example: 2 },
                notReady: { type: "number", example: 0 },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", example: "hz-dev-server-1" },
                      status: { type: "string", enum: ["Ready", "NotReady", "Unknown"] },
                      roles: { type: "array", items: { type: "string" }, example: ["control-plane"] },
                      kubeletVersion: { type: "string", example: "v1.32.3+k3s1" },
                      os: { type: "string", example: "Ubuntu 24.04.1 LTS" },
                      arch: { type: "string", example: "amd64" },
                      cpu: { type: "string", example: "12" },
                      memory: { type: "string", example: "131813272Ki" },
                    },
                  },
                },
              },
            },
            namespaces: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  status: { type: "string", example: "Active" },
                  deployments: { type: "number" },
                  pods: { type: "number" },
                  runningPods: { type: "number" },
                },
              },
            },
            totals: {
              type: "object",
              properties: {
                deployments: { type: "number" },
                pods: { type: "number" },
                runningPods: { type: "number" },
                services: { type: "number" },
              },
            },
            collectedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
  }, async () => {
    return getClusterOverview();
  });

  fastify.get("/namespaces/:namespace/overview", {
    schema: {
      tags: ["Cluster"],
      summary: "Visão geral de um namespace",
      description:
        "Retorna informações detalhadas de um namespace: deployments, pods, services, ingresses, eventos e uso de recursos.",
      params: {
        type: "object",
        required: ["namespace"],
        properties: {
          namespace: { type: "string", description: "Nome do namespace", example: "production" },
        },
      },
      response: {
        200: {
          description: "Visão geral do namespace",
          type: "object",
          properties: {
            name: { type: "string" },
            status: { type: "string" },
            deployments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  replicas: { type: "number" },
                  availableReplicas: { type: "number" },
                  image: { type: "string", nullable: true },
                  status: { type: "string", enum: ["healthy", "degraded", "scaled-down"] },
                },
              },
            },
            pods: {
              type: "object",
              properties: {
                total: { type: "number" },
                running: { type: "number" },
                pending: { type: "number" },
                failed: { type: "number" },
                succeeded: { type: "number" },
              },
            },
            services: { type: "number" },
            ingresses: { type: "number" },
            events: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  reason: { type: "string" },
                  message: { type: "string" },
                  timestamp: { type: "string", nullable: true },
                  involvedObject: {
                    type: "object",
                    properties: {
                      kind: { type: "string" },
                      name: { type: "string" },
                    },
                  },
                },
              },
            },
            resourceUsage: {
              type: "object",
              properties: {
                available: { type: "boolean" },
                cpuUsage: { type: "string" },
                memoryUsage: { type: "string" },
                cpuNanoCores: { type: "number" },
                memoryBytes: { type: "number" },
              },
            },
          },
        },
        403: { $ref: "HttpError#" },
      },
    },
  }, async (request: any, reply) => {
    try {
      return await getNamespaceOverview(request.params.namespace);
    } catch (error) {
      return sendError(reply, error);
    }
  });
};

export default clusterRoutes;
